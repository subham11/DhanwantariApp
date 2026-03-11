"""
DhanwantariAI — DiseaseIntel Action Group 3: SymptomExtractor
aws/lambda/diseaseintel/symptom_extractor/handler.py

Cross-source symptom extraction using Claude Sonnet.
Computes prevalence, specificity, severity, lift ratios.

Per DhanwantariAI_Agent_Services_Spec.md §3.5 Action Group 3.
Lambda config: 512 MB / 180s timeout.
"""

import json
import logging
import os
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = os.environ.get("AWS_REGION", "ap-south-1")
SONNET_MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0"

# ── Symptom Baseline Prevalence (general population) ──────────────────────────
# Used for lift ratio: P(symptom|disease) / P(symptom|baseline)

SYMPTOM_BASELINE = {
    "fever":            15.0,
    "cough":            12.0,
    "headache":         20.0,
    "fatigue":          18.0,
    "body_ache":        14.0,
    "nausea":            8.0,
    "vomiting":          5.0,
    "diarrhoea":         6.0,
    "abdominal_pain":    7.0,
    "chest_pain":        3.0,
    "breathlessness":    4.0,
    "dizziness":         8.0,
    "rash":              5.0,
    "joint_pain":       10.0,
    "sore_throat":       9.0,
    "runny_nose":       11.0,
    "weight_loss":       3.0,
    "loss_of_appetite":  6.0,
    "swelling":          4.0,
    "pallor":            3.0,
}


# ── Sonnet-Based Symptom Extraction ──────────────────────────────────────────

def extract_symptom_list(disease_name: str, icd10_code: str,
                         source_contents: dict) -> dict:
    """
    Use Claude Sonnet to extract structured symptom list from multiple sources.
    Computes prevalence by counting how many sources mention each symptom.
    """
    bedrock = boto3.client("bedrock-runtime", region_name=REGION)

    # Truncate sources to fit context window
    sources_text = json.dumps(source_contents, indent=2)[:6000]

    prompt = f"""You are extracting symptom data for "{disease_name}" (ICD-10: {icd10_code}).

Sources provided:
{sources_text}

Extract a comprehensive symptom list. For each symptom:
1. Canonical name (use standard medical terminology)
2. Prevalence in affected patients (%, if available in sources)
3. Specificity (is this symptom unique to this disease or common to many?)
4. Severity tier: mild | moderate | severe | red_flag
5. Source that mentions it (list source names)
6. India-specific prevalence if different from global

Return ONLY valid JSON:
{{
  "disease": "{disease_name}",
  "icd10": "{icd10_code}",
  "symptoms": [
    {{
      "symptom_id": "canonical snake_case name",
      "display_name": "Human readable name",
      "prevalence_pct": 85,
      "specificity": "high|medium|low",
      "severity_tier": "mild|moderate|severe|red_flag",
      "india_prevalence_pct": null,
      "sources": ["WHO", "ICMR"],
      "notes": ""
    }}
  ],
  "core_symptoms": ["symptom_ids of the 3-5 most defining symptoms"],
  "red_flag_symptoms": ["symptom_ids that require immediate referral"]
}}"""

    response = bedrock.invoke_model(
        modelId=SONNET_MODEL_ID,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4000,
            "messages": [{"role": "user", "content": prompt}],
        }),
    )

    result_text = json.loads(response["body"].read())["content"][0]["text"]

    # Parse JSON (handle markdown code blocks from model)
    text = result_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])

    return json.loads(text)


# ── Lift Ratio Computation ───────────────────────────────────────────────────

def compute_symptom_prevalence(disease_id: str, symptom_id: str,
                               prevalence_pct: float,
                               baseline_pct: float = None,
                               source: str = None) -> dict:
    """
    Compute lift ratio for symptom given disease.
    Lift = P(symptom | disease) / P(symptom | general population)
    Used by the on-device DiagnosisEngine scoring.
    """
    if baseline_pct is None:
        baseline_pct = SYMPTOM_BASELINE.get(symptom_id, 5.0)

    symptom_disease_prevalence = prevalence_pct / 100.0
    symptom_baseline = baseline_pct / 100.0
    lift_ratio = symptom_disease_prevalence / max(symptom_baseline, 0.001)

    return {
        "disease_id": disease_id,
        "symptom_id": symptom_id,
        "lift_ratio": round(lift_ratio, 3),
        "p_symptom_given_disease": symptom_disease_prevalence,
        "p_symptom_baseline": symptom_baseline,
        "source": source,
    }


def build_symptom_disease_matrix(all_symptom_extractions: list[dict]) -> dict:
    """
    Build the full symptom x disease scoring matrix.
    This powers the DiagnosisEngine on the mobile app.
    Output: { disease_id -> { symptom_id -> lift_data } }
    """
    matrix = {}

    for extraction in all_symptom_extractions:
        disease_id = extraction["disease_id"]
        matrix[disease_id] = {}

        for symptom in extraction.get("symptoms", []):
            lift = compute_symptom_prevalence(
                disease_id=disease_id,
                symptom_id=symptom["symptom_id"],
                prevalence_pct=symptom.get("prevalence_pct", 50),
                baseline_pct=SYMPTOM_BASELINE.get(symptom["symptom_id"]),
                source=(symptom["sources"][0] if symptom.get("sources") else None),
            )
            matrix[disease_id][symptom["symptom_id"]] = lift

    return {
        "matrix": matrix,
        "disease_count": len(matrix),
        "total_mappings": sum(len(v) for v in matrix.values()),
        "standard": "LIFT_RATIO_V2",
    }


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions.

    Actions:
      extract — extract symptom list using Sonnet
        Input: { "action": "extract", "disease_name": "...", "icd10_code": "...",
                 "source_contents": {...} }

      build_matrix — build full symptom x disease matrix
        Input: { "action": "build_matrix", "all_symptom_extractions": [...] }

      compute_lift — compute single lift ratio
        Input: { "action": "compute_lift", "disease_id": "...", "symptom_id": "...",
                 "prevalence_pct": 85 }

      Default: extract
    """
    logger.info("SymptomExtractor invoked: %s",
                json.dumps({k: v for k, v in event.items()
                            if k != "source_contents"}, default=str))

    action = event.get("action", "extract")

    if action == "build_matrix":
        return build_symptom_disease_matrix(event["all_symptom_extractions"])

    if action == "compute_lift":
        return compute_symptom_prevalence(
            disease_id=event["disease_id"],
            symptom_id=event["symptom_id"],
            prevalence_pct=event["prevalence_pct"],
            baseline_pct=event.get("baseline_population_prevalence"),
            source=event.get("source"),
        )

    # Default: extract symptoms via Sonnet
    disease_name = event.get("disease_name", "")
    icd10_code = event.get("icd10_code", "")
    source_contents = event.get("source_contents", {})

    result = extract_symptom_list(disease_name, icd10_code, source_contents)

    # Attach disease_id for downstream matrix building
    result["disease_id"] = event.get("disease_id", disease_name.lower().replace(" ", "_"))

    return result
