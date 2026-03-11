"""
DhanwantariAI — Bedrock Proxy Lambda
POST /escalate

Responsibilities (v2.2 §11.3, §9.2, §10.3):
  1. Validate input shape / sizes
  2. Server-side PII strip (defence-in-depth — mobile already strips)
  3. BedrockCostController: daily cap 10,000 / monthly budget $15
  4. Invoke Claude 3 Haiku in ap-south-1
  5. Emit CloudWatch metrics
  6. Log queryCost / tier / latencyMs — no PII
"""

import json
import re
import time
import os
import logging
import boto3
from datetime import date, datetime
from decimal import Decimal

from verification import verify_response
from auto_judge import judge_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION           = "ap-south-1"
MODEL_ID         = "anthropic.claude-3-haiku-20240307-v1:0"
DAILY_QUERY_CAP  = 10_000
MONTHLY_BUDGET   = Decimal("15.00")   # USD
HAIKU_INPUT_CPM  = Decimal("0.00025") # $0.25 per 1,000 input tokens  → per-token
HAIKU_OUTPUT_CPM = Decimal("0.00125") # $1.25 per 1,000 output tokens → per-token
# Per-token cost = CPM / 1000
COST_PER_INPUT_TOKEN  = HAIKU_INPUT_CPM  / Decimal("1000")
COST_PER_OUTPUT_TOKEN = HAIKU_OUTPUT_CPM / Decimal("1000")

MAX_QUERY_LEN    = 2_000  # characters
MAX_CONTEXT_LEN  = 4_000  # characters

# Bedrock Guardrails (create via AWS console / IaC — set env vars)
GUARDRAIL_ID      = os.environ.get("GUARDRAIL_ID", "")
GUARDRAIL_VERSION = os.environ.get("GUARDRAIL_VERSION", "DRAFT")

# Clients (reused across warm invocations)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)
dynamodb        = boto3.resource("dynamodb", region_name=REGION)
cloudwatch      = boto3.client("cloudwatch", region_name=REGION)

USAGE_TABLE_NAME = os.environ.get("USAGE_TABLE", "bedrock_usage")

# ---------------------------------------------------------------------------
# PII Stripper (server-side, §11.3 defence-in-depth)
# ---------------------------------------------------------------------------

def _strip_pii(text: str) -> str:
    """Remove common Indian PII patterns from text."""
    # Aadhaar: 12-digit number (with optional spaces/hyphens)
    text = re.sub(r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b', '[AADHAAR]', text)
    # Indian mobile numbers: 10-digit starting 6-9, or with +91 / 0 prefix
    text = re.sub(r'(\+91[\s\-]?|0)?[6-9]\d{9}\b', '[PHONE]', text)
    # PIN codes: 6-digit starting 1-9
    text = re.sub(r'\b[1-9]\d{5}\b', '[PIN]', text)
    # Names preceded by common Hindi/English salutations
    text = re.sub(
        r'\b(Shri|Smt|Mr|Mrs|Ms|Dr|Kumar|Kumari|Bai)\s+[A-Z][a-zA-Z]+(\s+[A-Z][a-zA-Z]+)?\b',
        '[NAME]',
        text,
        flags=re.IGNORECASE,
    )
    # Village/address markers
    text = re.sub(
        r'\b(village|vill|gram|gaon|ward|mohalla|tola)\s*:?\s*[A-Za-z\u0900-\u097F]+',
        '[LOCATION]',
        text,
        flags=re.IGNORECASE,
    )
    return text


# ---------------------------------------------------------------------------
# Cost Controller (§9.2)
# ---------------------------------------------------------------------------

def _can_escalate(table) -> tuple[bool, str]:
    """
    Check daily query count and monthly spend.
    Returns (allowed: bool, reason: str).
    """
    today_key = str(date.today())
    month_key  = today_key[:7]  # "YYYY-MM"

    try:
        resp = table.get_item(Key={"pk": f"daily#{today_key}"})
        daily_count = int(resp.get("Item", {}).get("count", 0))
    except Exception as e:
        logger.warning("DynamoDB daily read failed: %s", e)
        daily_count = 0

    if daily_count >= DAILY_QUERY_CAP:
        return False, "daily_limit"

    try:
        resp = table.get_item(Key={"pk": f"monthly#{month_key}"})
        monthly_spend = Decimal(resp.get("Item", {}).get("spend", "0"))
    except Exception as e:
        logger.warning("DynamoDB monthly read failed: %s", e)
        monthly_spend = Decimal("0")

    if monthly_spend >= MONTHLY_BUDGET:
        return False, "budget_exceeded"

    return True, "ok"


def _record_usage(table, input_tokens: int, output_tokens: int) -> None:
    """Increment daily count and monthly spend atomically."""
    today_key = str(date.today())
    month_key  = today_key[:7]
    cost = (COST_PER_INPUT_TOKEN * input_tokens
            + COST_PER_OUTPUT_TOKEN * output_tokens)

    try:
        table.update_item(
            Key={"pk": f"daily#{today_key}"},
            UpdateExpression="ADD #c :inc",
            ExpressionAttributeNames={"#c": "count"},
            ExpressionAttributeValues={":inc": 1},
        )
        table.update_item(
            Key={"pk": f"monthly#{month_key}"},
            UpdateExpression="ADD spend :cost",
            ExpressionAttributeValues={":cost": cost},
        )
    except Exception as e:
        logger.error("DynamoDB usage write failed: %s", e)


# ---------------------------------------------------------------------------
# CloudWatch Metrics (§17.2)
# ---------------------------------------------------------------------------

NAMESPACE = "DhanwantariAI"

def _emit_metric(name: str, value: float, unit: str = "Count",
                 dimensions: list | None = None) -> None:
    try:
        dim = dimensions or [{"Name": "Service", "Value": "BedrockProxy"}]
        cloudwatch.put_metric_data(
            Namespace=NAMESPACE,
            MetricData=[{"MetricName": name, "Value": value,
                         "Unit": unit, "Dimensions": dim}],
        )
    except Exception as e:
        logger.warning("CloudWatch emit failed: %s", e)


# ---------------------------------------------------------------------------
# System prompt (safety-aligned, ASHA scope)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are DhanwantariAI, a clinical decision support assistant for ASHA "
    "workers in rural India. You provide evidence-based guidance aligned with "
    "WHO IMCI, NHM protocols, and ICMR guidelines. "
    "RULES: "
    "1. Never say 'I diagnose' or 'you have [disease]'. "
    "2. Never prescribe specific dosages outside NLEM 2022. "
    "3. Always recommend referral to PHC/CHC for serious symptoms. "
    "4. Always end clinical responses with: "
    "   'This is clinical decision support only. Verify with a qualified doctor.'"
)


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------

def handler(event: dict, context) -> dict:
    start_ms = int(time.time() * 1000)

    # --- Parse body ---
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "invalid_json"})

    query       = str(body.get("query",       "")).strip()[:MAX_QUERY_LEN]
    ctx_text    = str(body.get("context",     "")).strip()[:MAX_CONTEXT_LEN]
    patient_tier = str(body.get("patientTier", "3")).strip()
    is_reanswer = bool(body.get("feedbackRetry", False))
    original_response = str(body.get("originalResponse", "")).strip()[:MAX_CONTEXT_LEN]

    if not query:
        return _response(400, {"error": "query_required"})

    # --- Server-side PII strip ---
    query    = _strip_pii(query)
    ctx_text = _strip_pii(ctx_text)

    # --- Cost gate ---
    table = dynamodb.Table(USAGE_TABLE_NAME)
    allowed, reason = _can_escalate(table)
    if not allowed:
        _emit_metric("EscalationBlocked", 1)
        return _response(429, {"allowed": False, "reason": reason})

    # --- Build Bedrock message ---
    user_content = query
    if is_reanswer and original_response:
        user_content = (
            f"The user was unsatisfied with the following response and asked "
            f"for a better answer.\n\n"
            f"Original response:\n{_strip_pii(original_response)}\n\n"
            f"Original question:\n{query}\n\n"
            f"Please provide a more thorough, accurate, and helpful response."
        )
    elif ctx_text:
        user_content = f"Context:\n{ctx_text}\n\nQuestion:\n{query}"

    messages = [{"role": "user", "content": user_content}]

    risk_level = body.get("riskLevel")  # sent by mobile client after RuleEngine

    # --- Invoke model (with Bedrock Guardrails if configured) ---
    invoke_start = int(time.time() * 1000)
    try:
        invoke_params = {
            "modelId": MODEL_ID,
            "contentType": "application/json",
            "accept": "application/json",
            "body": json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "system": SYSTEM_PROMPT,
                "max_tokens": 1024,
                "messages": messages,
            }),
        }
        # Attach Bedrock Guardrails if configured
        if GUARDRAIL_ID:
            invoke_params["guardrailIdentifier"] = GUARDRAIL_ID
            invoke_params["guardrailVersion"] = GUARDRAIL_VERSION

        resp = bedrock_runtime.invoke_model(**invoke_params)
    except Exception as e:
        logger.error("Bedrock invoke error: %s", e)
        _emit_metric("BedrockInvokeError", 1)
        return _response(502, {"error": "bedrock_unavailable"})

    invoke_ms = int(time.time() * 1000) - invoke_start
    bedrock_body = json.loads(resp["body"].read())

    answer       = bedrock_body["content"][0]["text"]
    input_tokens  = bedrock_body["usage"]["input_tokens"]
    output_tokens = bedrock_body["usage"]["output_tokens"]
    query_cost    = float(
        COST_PER_INPUT_TOKEN  * input_tokens
        + COST_PER_OUTPUT_TOKEN * output_tokens
    )

    # --- Guardrail action (if guardrail intervened) ---
    guardrail_action = bedrock_body.get("amazon-bedrock-guardrailAction")

    # --- Server-side verification ---
    verification = verify_response(
        answer=answer,
        risk_level=risk_level,
    )
    verified_answer = verification["safe_response"]

    # --- Auto-Judge (inline, ~$0.001 cost) ---
    auto_judge = None
    if verification["overall"] != "BLOCK":
        try:
            auto_judge = judge_response(
                query=query,
                response=answer,
                context=ctx_text,
                bedrock_client=bedrock_runtime,
                model_id=MODEL_ID,
            )
            # Add judge token cost to total
            judge_tokens = auto_judge.get("_judge_tokens", {})
            judge_input = judge_tokens.get("input", 0)
            judge_output = judge_tokens.get("output", 0)
            input_tokens += judge_input
            output_tokens += judge_output
            query_cost += float(
                COST_PER_INPUT_TOKEN * judge_input
                + COST_PER_OUTPUT_TOKEN * judge_output
            )
        except Exception as e:
            logger.warning("Auto-Judge failed (non-blocking): %s", e)

    # --- Record usage ---
    _record_usage(table, input_tokens, output_tokens)

    # --- Metrics ---
    latency_ms = int(time.time() * 1000) - start_ms
    _emit_metric("EscalationRate",   1)
    _emit_metric("BedrockCost",      query_cost, "None")
    _emit_metric("BedrockLatencyMs", latency_ms, "Milliseconds")

    # --- Audit log — no PII (§10.3) ---
    logger.info(json.dumps({
        "event":           "escalation",
        "feedbackRetry":   is_reanswer,
        "queryCost":       round(query_cost, 6),
        "inputTokens":     input_tokens,
        "outputTokens":    output_tokens,
        "patientTier":     patient_tier,
        "latencyMs":       latency_ms,
        "bedrockLatencyMs": invoke_ms,
        "model":           MODEL_ID,
        "timestamp":       datetime.utcnow().isoformat() + "Z",
    }))

    return _response(200, {
        "answer":       verified_answer,
        "rawAnswer":    answer if verification["overall"] != "PASS" else None,
        "inputTokens":  input_tokens,
        "outputTokens": output_tokens,
        "model":        MODEL_ID,
        "queryCostUsd": round(query_cost, 6),
        "verification": {
            "overall":  verification["overall"],
            "stages":   verification["stages"],
        },
        "autoJudge": {
            "overall":        auto_judge.get("overall") if auto_judge else None,
            "recommendation": auto_judge.get("recommendation") if auto_judge else None,
            "flags":          auto_judge.get("flags", []) if auto_judge else [],
        } if auto_judge else None,
        "guardrailAction": guardrail_action,
    })


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
        },
        "body": json.dumps(body),
    }
