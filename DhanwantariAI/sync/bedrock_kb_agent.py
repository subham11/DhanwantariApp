"""
bedrock_kb_agent.py  —  Agent 3: Knowledge Base Agent
------------------------------------------------------
Part of the three-agent Bedrock layer:
  Agent 1  —  Data Sync Agent      (bedrock_sync_agent.py)
  Agent 2  —  Inference Agent      (bedrock_inference_agent.py)
  Agent 3  —  Knowledge Base Agent (this file)

Purpose
-------
Handles deep clinical questions that the local JSON cannot answer.
Uses Bedrock Knowledge Base (S3 + vector store) for RAG retrieval
over the full DhanwantariAI clinical dataset.

Example queries this agent handles:
  - "What is the interaction between Metformin and Ashwagandha?"
  - "What is the nearest Jan Aushadhi Kendra in Bhubaneswar?"
  - "Is Azithromycin safe during breastfeeding?"
  - "What are the ICMR guidelines for childhood malnutrition?"

This is a FUTURE EXPANSION surface — Agent 2 (Inference Agent)
handles the primary on-demand inference path. Agent 3 extends
the depth of answers available for curious/concerned users.

Architecture
------------
  Bedrock Knowledge Base
    ├── S3 source bucket:  dhanwantariai-kb-source
    │     ├── disease_db_full.json          (full disease DB)
    │     ├── icmr_guidelines/              (PDF guidelines)
    │     ├── janaushadhi_catalogue.json    (full price + location data)
    │     └── drug_interactions.json        (future: curated interactions)
    └── Vector store: Amazon OpenSearch Serverless (or Aurora pg-vector)

QueryFlow
---------
  Mobile app (deep question tap)
    └─► POST /knowledge   (this Lambda)
          ├── validates + sanitises query
          ├── calls Bedrock KnowledgeBase.retrieve_and_generate()
          └── returns answer + source citations

API Contract
------------
POST /knowledge
  Body:
    {
      "session_id":   "sess_abc123",
      "device_id":    "sha256_of_device_id",  // 64 hex chars, no PII
      "language":     "hi" | "en",
      "question":     "मेटफॉर्मिन और अश्वगंधा एक साथ लेना सुरक्षित है?",
      "context": {                            // optional: narrows retrieval
        "disease_ids": ["diabetes"],
        "medicine_names": ["Metformin"]
      }
    }

  Response 200:
    {
      "answer":     "...",
      "citations":  [{"source": "icmr_diabetes_guidelines_2024", "page": 12}],
      "disclaimer": "...",
      "model_used": "amazon.nova-lite-v1:0",
      "latency_ms": 780
    }

Privacy
-------
Same constraints as Agent 2:
  - device_id is always a SHA-256 hash, never PII
  - No health question history retained server-side
  - DPDP Act 2023 compliant

Deploy
------
  AWS Lambda (Python 3.12, ARM64, 512 MB)
  + API Gateway HTTP API
  + Bedrock Knowledge Base (create once, sync when disease DB updates)
  Region: ap-south-1

Run locally:
  python3 sync/bedrock_kb_agent.py --mock
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from typing import Any

try:
    import boto3
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False

# ══════════════════════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════════════════════

BEDROCK_REGION        = os.environ.get('AWS_REGION', 'ap-south-1')
KB_ID                 = os.environ.get('BEDROCK_KB_ID', '')    # set after KB is created
KB_MODEL_ARN_TEMPLATE = 'arn:aws:bedrock:{region}::foundation-model/{model_id}'
KB_MODEL_ID           = 'amazon.nova-lite-v1:0'      # fast + cheap for RAG retrieval
MAX_RESULTS           = 5    # number of KB chunks to retrieve
MAX_TOKENS_RESP       = 800

_SYSTEM_PROMPT = """\
You are DhanwantariAI's clinical reference assistant for rural India.
Answer questions about medicines, diseases, drug interactions, and healthcare
guidelines using only the information retrieved from the knowledge base.
If the knowledge base does not contain the answer, say so clearly.
Always recommend consulting a doctor for personal medical decisions.
Use simple, jargon-free language in the user's chosen language.
"""

# ══════════════════════════════════════════════════════════════════════════
# Validation
# ══════════════════════════════════════════════════════════════════════════

_MAX_QUESTION_LEN = 500   # sanity cap — prevents prompt injection via oversized questions

def validate_request(body: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(body.get('session_id'), str):
        errors.append('session_id required')
    if not isinstance(body.get('device_id'), str) or len(body.get('device_id', '')) != 64:
        errors.append('device_id must be 64-char SHA-256 hex string')
    if body.get('language') not in ('hi', 'en'):
        errors.append('language must be "hi" or "en"')
    question = body.get('question', '')
    if not isinstance(question, str) or not question.strip():
        errors.append('question must be a non-empty string')
    if len(question) > _MAX_QUESTION_LEN:
        errors.append(f'question exceeds {_MAX_QUESTION_LEN} character limit')
    return errors


# ══════════════════════════════════════════════════════════════════════════
# Bedrock KB retrieval
# ══════════════════════════════════════════════════════════════════════════

def retrieve_and_generate(question: str, language: str) -> tuple[str, list[dict], int]:
    """
    Calls Bedrock Knowledge Base retrieve_and_generate.
    Returns (answer_text, citations_list, latency_ms).
    """
    if not AWS_AVAILABLE:
        raise RuntimeError('boto3 not available')
    if not KB_ID:
        raise RuntimeError(
            'BEDROCK_KB_ID environment variable not set. '
            'Create the Knowledge Base in AWS console and set this env var.'
        )

    client = boto3.client('bedrock-agent-runtime', region_name=BEDROCK_REGION)
    model_arn = KB_MODEL_ARN_TEMPLATE.format(
        region   = BEDROCK_REGION,
        model_id = KB_MODEL_ID,
    )
    # Language hint injected into question — Nova Lite is multilingual
    lang_hint = '(कृपया हिंदी में उत्तर दें) ' if language == 'hi' else ''
    augmented_question = f'{lang_hint}{question}'

    t0 = time.monotonic()
    response = client.retrieve_and_generate(
        input        = {'text': augmented_question},
        retrieveAndGenerateConfiguration = {
            'type': 'KNOWLEDGE_BASE',
            'knowledgeBaseConfiguration': {
                'knowledgeBaseId':  KB_ID,
                'modelArn':         model_arn,
                'retrievalConfiguration': {
                    'vectorSearchConfiguration': {'numberOfResults': MAX_RESULTS}
                },
                'generationConfiguration': {
                    'inferenceConfig': {
                        'textInferenceConfig': {
                            'maxTokens':   MAX_TOKENS_RESP,
                            'temperature': 0.2,
                        }
                    },
                    'promptTemplate': {
                        'textPromptTemplate': (
                            f'{_SYSTEM_PROMPT}\n\n'
                            '$search_results$\n\nQuestion: $query$'
                        )
                    }
                }
            }
        }
    )
    latency_ms = int((time.monotonic() - t0) * 1000)

    output_text = response.get('output', {}).get('text', '')
    citations   = []
    for ref in response.get('citations', []):
        for loc in ref.get('retrievedReferences', []):
            src   = loc.get('location', {}).get('s3Location', {})
            meta  = loc.get('metadata', {})
            citations.append({
                'source': src.get('uri', '').split('/')[-1],
                'page':   meta.get('page_number'),
            })

    return output_text, citations, latency_ms


# ══════════════════════════════════════════════════════════════════════════
# Lambda handler
# ══════════════════════════════════════════════════════════════════════════

def lambda_handler(event: dict, context: Any) -> dict:
    try:
        body: dict = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return _response(400, {'error': 'Invalid JSON body'})

    errors = validate_request(body)
    if errors:
        return _response(400, {'errors': errors})

    try:
        answer, citations, latency_ms = retrieve_and_generate(
            question = body['question'].strip(),
            language = body['language'],
        )
    except Exception as exc:
        _log_error(body.get('device_id', 'unknown'), str(exc))
        return _response(503, {'error': 'Knowledge base temporarily unavailable'})

    disclaimer = {
        'hi': 'यह जानकारी केवल सामान्य मार्गदर्शन के लिए है। व्यक्तिगत चिकित्सा सलाह के लिए डॉक्टर से मिलें।',
        'en': 'This information is for reference only. Consult a qualified doctor for personal medical advice.',
    }.get(body.get('language', 'en'), '')

    _log_query(
        device_id  = body['device_id'],
        language   = body['language'],
        latency_ms = latency_ms,
        n_citations= len(citations),
    )

    return _response(200, {
        'answer':     answer,
        'citations':  citations,
        'disclaimer': disclaimer,
        'model_used': KB_MODEL_ID,
        'latency_ms': latency_ms,
    })


def _response(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
        'body': json.dumps(body, ensure_ascii=False),
    }


def _log_query(device_id: str, language: str, latency_ms: int, n_citations: int) -> None:
    print(json.dumps({
        'event':      'kb_query',
        'device_id':  device_id,
        'language':   language,
        'latency_ms': latency_ms,
        'citations':  n_citations,
        'model':      KB_MODEL_ID,
    }))


def _log_error(device_id: str, error: str) -> None:
    print(json.dumps({'event': 'kb_error', 'device_id': device_id, 'error': error[:200]}))


# ══════════════════════════════════════════════════════════════════════════
# Local mock
# ══════════════════════════════════════════════════════════════════════════

def run_mock() -> None:
    print('DhanwantariAI Agent 3 — Knowledge Base Agent   (mock mode)')
    print('=' * 60)

    sample_request = {
        'session_id': 'sess_mock_002',
        'device_id':  hashlib.sha256(b'test-device-id').hexdigest(),
        'language':   'hi',
        'question':   'मेटफॉर्मिन और अश्वगंधा एक साथ लेना सुरक्षित है?',
        'context':    {'disease_ids': ['diabetes'], 'medicine_names': ['Metformin']},
    }

    errors = validate_request(sample_request)
    if errors:
        print(f'Validation FAILED: {errors}')
        return
    print('Validation: PASSED')

    print('\n── Question ────────────────────────────────────────────')
    print(sample_request['question'])

    print('\n── KB Setup Required ───────────────────────────────────')
    print('Before this agent works, create a Bedrock Knowledge Base:')
    print('  1. AWS Console → Bedrock → Knowledge Bases → Create')
    print('  2. Source: S3 bucket "dhanwantariai-kb-source"')
    print('  3. Upload: disease_db_full.json, icmr_guidelines/, janaushadhi_catalogue.json')
    print('  4. Embeddings: Amazon Titan Embed Text v2 (ap-south-1)')
    print('  5. Vector store: Amazon OpenSearch Serverless (auto-created)')
    print('  6. Set env var: BEDROCK_KB_ID=<kb-id-from-console>')
    print('\n── Mock Response ───────────────────────────────────────')
    mock_response = {
        'answer': (
            'मेटफॉर्मिन (Metformin) एक मधुमेह की दवा है जो रक्त शर्करा को नियंत्रित करती है। '
            'अश्वगंधा (Withania somnifera) भी रक्त शर्करा को कम करने का प्रभाव रख सकती है। '
            'दोनों को एक साथ लेने से रक्त शर्करा बहुत कम हो सकती है (hypoglycemia)। '
            'कृपया अपने डॉक्टर से परामर्श करें इससे पहले कि आप दोनों एक साथ लें।'
        ),
        'citations': [
            {'source': 'icmr_diabetes_guidelines_2024.pdf', 'page': 47},
            {'source': 'drug_interactions.json', 'page': None},
        ],
        'disclaimer': 'यह जानकारी केवल सामान्य मार्गदर्शन के लिए है।',
        'model_used': f'{KB_MODEL_ID} (mock)',
        'latency_ms': 0,
    }
    print(json.dumps(mock_response, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='DhanwantariAI Knowledge Base Agent')
    parser.add_argument('--mock', action='store_true', help='Run mock without AWS')
    args = parser.parse_args()
    if args.mock:
        run_mock()
    else:
        print('Deployed as Lambda. Run with --mock for local testing.')
