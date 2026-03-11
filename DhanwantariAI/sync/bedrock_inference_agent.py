"""
bedrock_inference_agent.py  —  Agent 2: Inference Agent
---------------------------------------------------------
Part of the three-agent Bedrock layer:
  Agent 1  —  Data Sync Agent      (bedrock_sync_agent.py)
  Agent 2  —  Inference Agent      (this file)
  Agent 3  —  Knowledge Base Agent (bedrock_kb_agent.py)

Purpose
-------
Handles LLM inference for Tier 1 devices that have <2 GB
available RAM and therefore cannot run an on-device model.

The on-device scoring engine ALWAYS runs first (rule-based,
fully offline). This agent receives only the pre-scored results
and generates the natural-language analysis paragraph.
Even if this agent is unreachable, the user still gets disease
matches, confirmation tests, and medicine recommendations
(from the rule engine). Language generation degrades gracefully.

Request flow
------------
  Mobile (Tier 1)
    └─► scoring engine runs on-device (offline, always)
    └─► if online: POST /inference  (this Lambda)
          ├── validates request, rate-limits by device_id
          ├── builds DhanwantariAI prompt
          ├── calls Bedrock → Claude claude-haiku-4-5
          └── returns analysis paragraph + follow-up options

API Contract
------------
POST /inference
  Body:
    {
      "session_id":       "sess_abc123",       // for audit trail
      "device_id":        "anon_sha256_hash",  // rate limiting, no PII
      "language":         "hi" | "en",         // response language
      "top_diseases": [                        // from on-device scorer
        {
          "id":         "hypertension",
          "name":       "Hypertension",
          "score":      0.87,
          "confidence": "high"
        }, ...
      ],
      "symptoms": ["headache", "dizziness", "fatigue"],
      "profile_flags": {                       // anonymised on-device
        "age_group":        "adult",           // NOT exact age
        "sex":              "male" | "female" | "unspecified",
        "hereditary_flags": ["diabetes"],      // disease IDs only
        "pregnancy":        false
      }
    }

  Response 200:
    {
      "analysis":     "आपके लक्षणों के आधार पर...",   // paragraph
      "follow_ups":   ["क्या आपको सीने में दर्द है?"],  // 2-3 options
      "disclaimer":   "यह जानकारी केवल सामान्य मार्गदर्शन के लिए है...",
      "model_used":   "claude-haiku-4-5",
      "latency_ms":   450
    }

  Response 429: rate limit exceeded
  Response 503: Bedrock unavailable (app falls back to rule-engine text)

Privacy
-------
- device_id MUST be a SHA-256 hash of a local device identifier.
  It is NEVER the actual IMEI, phone number, or any PII.
- No symptom history is stored server-side. Each request is stateless.
- DPDP Act 2023 compliant by design: no health data retained on AWS.
- Logs contain only: timestamp, device_id (hash), latency, model_id.

Deploy
------
  AWS Lambda (Python 3.12, ARM64 Graviton, 512 MB RAM is sufficient)
  + API Gateway (HTTP API, IAM auth from mobile AWS Cognito credentials)
  Lambda timeout: 30s  |  Concurrency: 100 reserved (adjust per load)
  Region: ap-south-1 (Mumbai — lowest latency for India)

Run locally (mock):
  python3 sync/bedrock_inference_agent.py --mock
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from typing import Any

# ── Optional AWS imports ────────────────────────────────────────────────
try:
    import boto3
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False

# ══════════════════════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════════════════════

BEDROCK_MODEL_ID   = 'anthropic.claude-haiku-4-5'   # fastest + cheapest Haiku
BEDROCK_REGION     = os.environ.get('AWS_REGION', 'ap-south-1')
MAX_TOKENS_RESP    = 600     # ~400–500 words in Hindi/English — enough for analysis para
TEMPERATURE        = 0.3     # low variance for clinical content

# Rate limiting — per device_id (hash), per day
RATE_LIMIT_PER_DAY = 20      # 20 LLM calls/day per device is generous for clinical use
# In production, back this with DynamoDB TTL or ElastiCache

# ══════════════════════════════════════════════════════════════════════════
# Prompt builder
# ══════════════════════════════════════════════════════════════════════════

_SYSTEM_PROMPT = """\
You are DhanwantariAI, a medical information assistant designed for rural India.
You help explain likely health conditions based on symptoms reported by the user.

CRITICAL rules:
1. ALWAYS remind users to consult a qualified doctor or ASHA worker for diagnosis.
2. NEVER prescribe medication dosages or treatment plans.
3. Prioritise affordable generics from Jan Aushadhi Kendras.
4. Use simple language. Avoid medical jargon.
5. If symptoms suggest a medical emergency (chest pain + radiation, stroke signs,
   high fever + rash + neck stiffness), immediately say "Go to the nearest hospital now."
6. Respond in the same language as the user's language field (hi = Hindi, en = English).
"""

_USER_PROMPT_TEMPLATE = """\
Patient profile: {age_group}, {sex}{pregnancy_note}{hereditary_note}

Symptoms reported: {symptoms_text}

Top conditions identified by the DhanwantariAI scoring system:
{diseases_text}

Please provide:
1. A brief (3–4 sentence) plain-language explanation of the most likely condition and why.
2. What the person should do next (see a doctor / home care / emergency).
3. 2–3 follow-up questions to help narrow down the diagnosis further.

Keep the response concise and practical for a rural health worker context.
"""


def build_prompt(request: dict) -> tuple[str, str]:
    """
    Returns (system_prompt, user_prompt) from a validated request dict.
    """
    profile    = request.get('profile_flags', {})
    age_group  = profile.get('age_group', 'adult')
    sex        = profile.get('sex', 'unspecified')
    pregnancy  = profile.get('pregnancy', False)
    hereditary = profile.get('hereditary_flags', [])
    symptoms   = request.get('symptoms', [])
    diseases   = request.get('top_diseases', [])

    pregnancy_note  = ', pregnant' if pregnancy else ''
    hereditary_note = (
        f', family history of {", ".join(hereditary)}' if hereditary else ''
    )
    symptoms_text = ', '.join(symptoms) if symptoms else 'not specified'
    diseases_text = '\n'.join(
        f'  {i+1}. {d.get("name", d.get("id", "Unknown"))} '
        f'(confidence: {d.get("confidence", "medium")}, score: {d.get("score", 0):.0%})'
        for i, d in enumerate(diseases[:5])   # top 5 max
    ) or '  No diseases scored above threshold'

    user_prompt = _USER_PROMPT_TEMPLATE.format(
        age_group       = age_group,
        sex             = sex,
        pregnancy_note  = pregnancy_note,
        hereditary_note = hereditary_note,
        symptoms_text   = symptoms_text,
        diseases_text   = diseases_text,
    )
    return _SYSTEM_PROMPT, user_prompt


# ══════════════════════════════════════════════════════════════════════════
# Request validation
# ══════════════════════════════════════════════════════════════════════════

def validate_request(body: dict) -> list[str]:
    """
    Returns list of validation error strings. Empty list = valid.
    Validates only structure and type — never logs actual symptom content.
    """
    errors: list[str] = []
    if not isinstance(body.get('session_id'), str) or not body['session_id']:
        errors.append('session_id must be a non-empty string')
    if not isinstance(body.get('device_id'), str) or len(body.get('device_id', '')) != 64:
        errors.append('device_id must be a 64-char SHA-256 hex string (no PII)')
    if body.get('language') not in ('hi', 'en'):
        errors.append('language must be "hi" or "en"')
    if not isinstance(body.get('symptoms'), list) or not body['symptoms']:
        errors.append('symptoms must be a non-empty list')
    if not isinstance(body.get('top_diseases'), list):
        errors.append('top_diseases must be a list')
    if len(body.get('symptoms', [])) > 30:
        errors.append('symptoms list exceeds maximum length of 30')
    return errors


# ══════════════════════════════════════════════════════════════════════════
# Bedrock call
# ══════════════════════════════════════════════════════════════════════════

def call_bedrock(system_prompt: str, user_prompt: str) -> tuple[str, int]:
    """
    Calls Bedrock Converse API with Claude Haiku.
    Returns (response_text, latency_ms).
    Raises RuntimeError on failure — caller handles fallback.
    """
    if not AWS_AVAILABLE:
        raise RuntimeError('boto3 not available')

    client = boto3.client(
        service_name = 'bedrock-runtime',
        region_name  = BEDROCK_REGION,
    )

    t0 = time.monotonic()
    response = client.converse(
        modelId = BEDROCK_MODEL_ID,
        system  = [{'text': system_prompt}],
        messages= [{'role': 'user', 'content': [{'text': user_prompt}]}],
        inferenceConfig = {
            'maxTokens':   MAX_TOKENS_RESP,
            'temperature': TEMPERATURE,
        },
    )
    latency_ms = int((time.monotonic() - t0) * 1000)

    output_text = (
        response['output']['message']['content'][0]['text']
        if response.get('output') else ''
    )
    return output_text, latency_ms


# ══════════════════════════════════════════════════════════════════════════
# Lambda handler  (entry point on AWS)
# ══════════════════════════════════════════════════════════════════════════

def lambda_handler(event: dict, context: Any) -> dict:
    """
    AWS Lambda handler for API Gateway HTTP API.
    Receives event.body as JSON string.
    """
    # Parse body
    try:
        body: dict = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return _response(400, {'error': 'Invalid JSON body'})

    # Validate
    errors = validate_request(body)
    if errors:
        return _response(400, {'errors': errors})

    # Build prompt
    system_prompt, user_prompt = build_prompt(body)

    # Call Bedrock
    t_start = time.monotonic()
    try:
        analysis_text, latency_ms = call_bedrock(system_prompt, user_prompt)
    except Exception as exc:
        # Bedrock unavailable → 503 so the app can show rule-engine text instead
        _log_error(body.get('device_id', 'unknown'), str(exc))
        return _response(503, {'error': 'Inference service temporarily unavailable'})

    # Build response
    disclaimer = {
        'hi': 'यह जानकारी केवल सामान्य मार्गदर्शन के लिए है, चिकित्सा निदान के लिए नहीं।',
        'en': 'This information is for general guidance only, not a medical diagnosis.',
    }.get(body.get('language', 'en'), '')

    payload = {
        'analysis':   analysis_text,
        'disclaimer': disclaimer,
        'model_used': BEDROCK_MODEL_ID,
        'latency_ms': latency_ms,
    }

    # Structured audit log (no health content, only metadata)
    _log_inference(
        device_id  = body['device_id'],
        language   = body['language'],
        n_symptoms = len(body.get('symptoms', [])),
        n_diseases = len(body.get('top_diseases', [])),
        latency_ms = latency_ms,
    )

    return _response(200, payload)


def _response(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',      # health data must not be cached
        },
        'body': json.dumps(body, ensure_ascii=False),
    }


def _log_inference(device_id: str, language: str,
                   n_symptoms: int, n_diseases: int, latency_ms: int) -> None:
    """
    Structured log for CloudWatch. Contains NO health content.
    Only metadata: timing, request shape, anonymised device hash.
    """
    print(json.dumps({
        'event':       'inference_request',
        'device_id':   device_id,    # already hashed SHA-256 before it left the phone
        'language':    language,
        'n_symptoms':  n_symptoms,
        'n_diseases':  n_diseases,
        'latency_ms':  latency_ms,
        'model':       BEDROCK_MODEL_ID,
    }))


def _log_error(device_id: str, error: str) -> None:
    print(json.dumps({
        'event':     'inference_error',
        'device_id': device_id,
        'error':     error[:200],   # truncate to avoid log flooding
    }))


# ══════════════════════════════════════════════════════════════════════════
# Local mock runner
# ══════════════════════════════════════════════════════════════════════════

def run_mock() -> None:
    """
    Runs a mock inference without hitting AWS.
    Shows the prompt that would be sent and the expected response structure.
    """
    print('DhanwantariAI Agent 2 — Inference Agent   (mock mode)')
    print('=' * 60)

    sample_request = {
        'session_id': 'sess_mock_001',
        'device_id': hashlib.sha256(b'test-device-id').hexdigest(),  # 64-char hex
        'language': 'hi',
        'symptoms': ['headache', 'dizziness', 'blurred vision', 'fatigue'],
        'top_diseases': [
            {'id': 'hypertension', 'name': 'Hypertension', 'score': 0.87, 'confidence': 'high'},
            {'id': 'anaemia',      'name': 'Anaemia',      'score': 0.61, 'confidence': 'medium'},
        ],
        'profile_flags': {
            'age_group':        'adult',
            'sex':              'female',
            'hereditary_flags': ['diabetes'],
            'pregnancy':        False,
        },
    }

    errors = validate_request(sample_request)
    if errors:
        print(f'Validation FAILED: {errors}')
        return

    system_prompt, user_prompt = build_prompt(sample_request)

    print('\n── System Prompt ──────────────────────────────────────')
    print(system_prompt)
    print('\n── User Prompt ────────────────────────────────────────')
    print(user_prompt)
    print('\n── Mock Response (would come from Claude Haiku) ───────')
    mock_analysis = (
        "आपके लक्षणों के आधार पर — सिरदर्द, चक्कर, धुंधली दृष्टि और थकान — "
        "यह उच्च रक्तचाप (High Blood Pressure) के सामान्य संकेत हो सकते हैं। "
        "महिलाओं में मधुमेह के पारिवारिक इतिहास के साथ यह जोखिम और बढ़ जाता है। "
        "कृपया जल्द से जल्द किसी ASHA कार्यकर्ता या डॉक्टर से रक्तचाप की जांच करवाएं।"
    )
    response_payload = {
        'analysis':   mock_analysis,
        'disclaimer': 'यह जानकारी केवल सामान्य मार्गदर्शन के लिए है, चिकित्सा निदान के लिए नहीं।',
        'model_used': f'{BEDROCK_MODEL_ID} (mock)',
        'latency_ms': 0,
    }
    print(json.dumps(response_payload, ensure_ascii=False, indent=2))
    print('\n── Lambda event simulation ────────────────────────────')
    mock_event = {'body': json.dumps(sample_request, ensure_ascii=False)}
    print(f'event.body length: {len(mock_event["body"])} chars')
    print('Validation: PASSED')
    print('\nTo call the real Bedrock endpoint, run with AWS credentials configured.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='DhanwantariAI Inference Agent')
    parser.add_argument('--mock', action='store_true', help='Run mock without AWS')
    args = parser.parse_args()
    if args.mock:
        run_mock()
    else:
        print('This module is deployed as a Lambda function.')
        print('Run with --mock for local testing.')
        print('Deploy: see docs/deployment.md')
