"""
DhanwantariAI — DiseaseIntel Shared Utilities
aws/lambda/diseaseintel/shared.py

Shared constants and helpers used across all DiseaseIntel Lambda action groups.
Per DhanwantariAI_Agent_Services_Spec.md §3, §4, §8.
"""

import json
import logging
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION           = os.environ.get("AWS_REGION", "ap-south-1")
KB_BUCKET        = os.environ.get("KB_BUCKET", "dhanwantari-kb-ap-south-1")
DISEASES_TABLE   = os.environ.get("DISEASES_TABLE", "dhanwantari-diseases")
SYMPTOMS_TABLE   = os.environ.get("SYMPTOMS_TABLE", "dhanwantari-symptom-mappings")
BMI_TABLE        = os.environ.get("BMI_TABLE", "dhanwantari-bmi-matrix")
AGENT_RUNS_TABLE = os.environ.get("AGENT_RUNS_TABLE", "dhanwantari-agent-runs")
CW_NAMESPACE     = "DhanwantariAgents"

# Model IDs
HAIKU_MODEL  = "anthropic.claude-3-haiku-20240307-v1:0"    # For parsing
SONNET_MODEL = "anthropic.claude-3-sonnet-20240229-v1:0"   # For reasoning

# ── Trusted Source URLs (§3.3) ────────────────────────────────────────────────

TRUSTED_SOURCES = {
    "who":     "https://who.int/news-room/fact-sheets/detail/{slug}",
    "icmr":    "https://icmr.gov.in/guidelines",
    "nvbdcp":  "https://nvbdcp.gov.in",
    "nhm":     "https://nhm.gov.in",
    "pubmed":  "https://pubmed.ncbi.nlm.nih.gov/?term={query}+India&filter=pubt.guideline",
    "medline": "https://medlineplus.gov/ency/article/{id}.htm",
    "icd_who": "https://icd.who.int/browse10",
    "nfhs":    "https://rchiips.org/nfhs",
}

ALLOWED_SOURCE_DOMAINS = [
    "who.int",
    "icmr.gov.in",
    "mohfw.gov.in",
    "ayush.gov.in",
    "nvbdcp.gov.in",
    "nhm.gov.in",
    "janaushadhi.gov.in",
    "pubmed.ncbi.nlm.nih.gov",
    "icd.who.int",
    "rchiips.org",
    "medlineplus.gov",
]


def is_url_allowed(url: str) -> bool:
    """Check that a URL belongs to a whitelisted domain."""
    try:
        host = urlparse(url).hostname or ""
        return any(
            host == domain or host.endswith(f".{domain}")
            for domain in ALLOWED_SOURCE_DOMAINS
        )
    except Exception:
        return False


# ── ICMR India BMI Cut-offs (§3.5 AG2) ───────────────────────────────────────

INDIA_BMI_CUTOFFS = {
    "underweight":   {"range": [0, 18.5],    "label": "Underweight"},
    "normal":        {"range": [18.5, 23.0], "label": "Normal"},
    "overweight":    {"range": [23.0, 25.0], "label": "Overweight (India)"},
    "obese_class_1": {"range": [25.0, 27.5], "label": "Obese Class I (India)"},
    "obese_class_2": {"range": [27.5, 32.5], "label": "Obese Class II (India)"},
    "obese_class_3": {"range": [32.5, 999],  "label": "Obese Class III"},
}

WHO_BMI_CUTOFFS = {
    "underweight": {"range": [0, 18.5]},
    "normal":      {"range": [18.5, 25.0]},
    "overweight":  {"range": [25.0, 30.0]},
    "obese":       {"range": [30.0, 999]},
}

# ── Common Symptom Baselines (population prevalence for lift ratio) ───────────

SYMPTOM_BASELINE = {
    "fever": 8.0,
    "headache": 15.0,
    "cough": 12.0,
    "fatigue": 20.0,
    "nausea": 5.0,
    "vomiting": 3.0,
    "diarrhoea": 4.0,
    "abdominal_pain": 6.0,
    "joint_pain": 10.0,
    "muscle_pain": 8.0,
    "rash": 3.0,
    "weight_loss": 4.0,
    "chest_pain": 2.0,
    "shortness_of_breath": 3.0,
    "dizziness": 5.0,
    "swelling": 4.0,
    "itching": 6.0,
    "yellowing_skin": 0.5,
    "bleeding": 1.0,
    "seizures": 0.3,
}


# ── Referral Levels ───────────────────────────────────────────────────────────

REFERRAL_LEVELS = ["ASHA", "PHC", "CHC", "HOSPITAL"]


# ── Disease Categories ────────────────────────────────────────────────────────

DISEASE_CATEGORIES = [
    "infectious",
    "ncd",
    "maternal",
    "neonatal",
    "nutritional",
    "respiratory",
    "cardiovascular",
    "metabolic",
    "neurological",
    "dermatological",
    "musculoskeletal",
    "mental_health",
    "vector_borne",
    "water_borne",
    "zoonotic",
]


# ── Helper Functions ──────────────────────────────────────────────────────────

def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utcnow_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


def invoke_bedrock(bedrock_client, model_id: str, prompt: str,
                   max_tokens: int = 4000) -> str:
    """Invoke Bedrock model and return text response."""
    resp = bedrock_client.invoke_model(
        modelId=model_id,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }),
    )
    body = json.loads(resp["body"].read())
    return body["content"][0]["text"]


def parse_json_response(text: str) -> dict | list:
    """Extract JSON from model response, handling markdown code blocks."""
    # Try raw JSON first
    text = text.strip()
    if text.startswith("{") or text.startswith("["):
        return json.loads(text)

    # Try extracting from markdown code block
    match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))

    # Try finding first { or [ to end
    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = text.find(start_char)
        if start >= 0:
            end = text.rfind(end_char)
            if end > start:
                return json.loads(text[start:end + 1])

    raise ValueError(f"Could not extract JSON from response: {text[:200]}")


def put_metric(cw_client, metric_name: str, value: float, unit: str = "Count"):
    """Emit a CloudWatch metric under DhanwantariAgents namespace."""
    try:
        cw_client.put_metric_data(
            Namespace=CW_NAMESPACE,
            MetricData=[{
                "MetricName": metric_name,
                "Value": value,
                "Unit": unit,
                "Dimensions": [
                    {"Name": "Agent", "Value": "DiseaseIntel"},
                ],
            }],
        )
    except Exception as e:
        logger.warning("CloudWatch metric emit failed: %s", e)
