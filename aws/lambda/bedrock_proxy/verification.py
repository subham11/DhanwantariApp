"""
DhanwantariAI — Server-Side Verification Module
aws/lambda/bedrock_proxy/verification.py

Server-side FactGrounder + DosageValidator that runs on every Bedrock
response before it is returned to the mobile client.

Uses Qdrant Cloud for fact-grounding (same cluster the mobile client uses).
Uses DynamoDB formulary table for dosage validation.

Per DhanwantariAI Self-Verification Strategy §7.
"""

import re
import logging
from typing import Any

logger = logging.getLogger()

# ─── Known safe dosage ranges (NLEM 2022 subset) ─────────────────────────────

KNOWN_DOSAGE_RANGES: dict[str, dict[str, float | str]] = {
    "paracetamol":   {"min": 250, "max": 1000, "unit": "mg"},
    "ibuprofen":     {"min": 200, "max": 800,  "unit": "mg"},
    "amoxicillin":   {"min": 250, "max": 1000, "unit": "mg"},
    "metformin":     {"min": 250, "max": 1000, "unit": "mg"},
    "atenolol":      {"min": 25,  "max": 100,  "unit": "mg"},
    "amlodipine":    {"min": 2.5, "max": 10,   "unit": "mg"},
    "omeprazole":    {"min": 10,  "max": 40,   "unit": "mg"},
    "azithromycin":  {"min": 250, "max": 500,  "unit": "mg"},
    "cetirizine":    {"min": 5,   "max": 10,   "unit": "mg"},
    "metoprolol":    {"min": 25,  "max": 200,  "unit": "mg"},
    "losartan":      {"min": 25,  "max": 100,  "unit": "mg"},
    "atorvastatin":  {"min": 10,  "max": 80,   "unit": "mg"},
    "aspirin":       {"min": 75,  "max": 650,  "unit": "mg"},
    "ciprofloxacin": {"min": 250, "max": 750,  "unit": "mg"},
    "doxycycline":   {"min": 50,  "max": 200,  "unit": "mg"},
    "chloroquine":   {"min": 150, "max": 600,  "unit": "mg"},
    "artemether":    {"min": 20,  "max": 80,   "unit": "mg"},
    "ors":           {"min": 200, "max": 1000, "unit": "ml"},
    "iron tablets":  {"min": 60,  "max": 200,  "unit": "mg"},
    "folic acid":    {"min": 0.4, "max": 5,    "unit": "mg"},
    "albendazole":   {"min": 200, "max": 400,  "unit": "mg"},
    "ivermectin":    {"min": 3,   "max": 18,   "unit": "mg"},
    "salbutamol":    {"min": 2,   "max": 8,    "unit": "mg"},
}

# ─── Dangerous phrases ───────────────────────────────────────────────────────

MINIMISATION_PATTERNS = [
    re.compile(r"no\s+need\s+to\s+worry", re.I),
    re.compile(r"not\s+serious", re.I),
    re.compile(r"home\s+remed", re.I),
    re.compile(r"can\s+wait", re.I),
    re.compile(r"monitor\s+at\s+home", re.I),
    re.compile(r"nothing\s+to\s+worry", re.I),
    re.compile(r"self[- ]?limiting", re.I),
]

MEDICATION_CHANGE_PATTERNS = [
    re.compile(r"stop\s+taking", re.I),
    re.compile(r"discontinue\s+(your|the)\s+(medication|medicine|drug)", re.I),
    re.compile(r"switch\s+(from|to)\s+", re.I),
    re.compile(r"change\s+your\s+(dosage|dose|medication|medicine)", re.I),
    re.compile(r"reduce\s+your\s+(dosage|dose)", re.I),
    re.compile(r"increase\s+your\s+(dosage|dose)", re.I),
]

DOSAGE_PATTERN = re.compile(
    r"(?:take|administer|give|prescribe|use)\s+"
    r"(\w[\w\s-]{2,30}?)\s+"
    r"(\d+\.?\d*)\s*"
    r"(mg|ml|mcg|µg|g|iu|units?|tablets?|capsules?)",
    re.I,
)


# ─── Verification Engine ─────────────────────────────────────────────────────

def verify_response(
    answer: str,
    risk_level: str | None = None,
    qdrant_client: Any | None = None,
    query_embedding: list[float] | None = None,
) -> dict:
    """
    Run server-side verification checks on a Bedrock response.

    Returns a dict with:
      - overall: "PASS" | "WARN" | "BLOCK"
      - stages: list of individual check results
      - safe_response: the response to return (may be original or replacement)
    """
    stages = []

    # V2-Server: Safety-gate checks
    stages.append(_check_safety_gate(answer, risk_level))

    # V3-Server: Dosage validation
    stages.append(_check_dosage(answer))

    # V1-Server: Fact-grounding via Qdrant (if client provided)
    if qdrant_client and query_embedding:
        stages.append(_check_fact_grounding(answer, qdrant_client, query_embedding))

    # Aggregate
    verdicts = [s["verdict"] for s in stages]
    if "BLOCK" in verdicts:
        overall = "BLOCK"
    elif "WARN" in verdicts:
        overall = "WARN"
    else:
        overall = "PASS"

    # Build safe response
    if overall == "BLOCK":
        block_stage = next(
            (s for s in stages if s["verdict"] == "BLOCK" and s.get("replacement")),
            None,
        )
        safe_response = (
            block_stage["replacement"]
            if block_stage
            else "The AI response could not be verified. Please consult a qualified doctor."
        )
    else:
        safe_response = answer

    return {
        "overall": overall,
        "stages": stages,
        "safe_response": safe_response,
    }


# ─── Individual Checks ───────────────────────────────────────────────────────

def _check_safety_gate(answer: str, risk_level: str | None) -> dict:
    """Server-side V2: block minimisation / medication changes."""
    # Medication change advice (always blocked — outside ASHA scope)
    for pattern in MEDICATION_CHANGE_PATTERNS:
        match = pattern.search(answer)
        if match:
            return {
                "stage": "V2_SAFETY_SERVER",
                "verdict": "BLOCK",
                "reason": f'LLM advises medication change: "{match.group()}"',
                "replacement": (
                    "Medication changes should only be made by a qualified doctor. "
                    "Please refer to the nearest health centre."
                ),
            }

    # IMMEDIATE risk — block minimisation
    if risk_level in ("IMMEDIATE", "URGENT"):
        for pattern in MINIMISATION_PATTERNS:
            match = pattern.search(answer)
            if match:
                return {
                    "stage": "V2_SAFETY_SERVER",
                    "verdict": "BLOCK",
                    "reason": f'LLM minimises {risk_level} risk: "{match.group()}"',
                    "replacement": (
                        f"Risk level: {risk_level}. "
                        "Please refer the patient to the nearest health facility immediately. "
                        "This is clinical decision support only. Verify with a qualified doctor."
                    ),
                }

    return {
        "stage": "V2_SAFETY_SERVER",
        "verdict": "PASS",
        "reason": "No safety violations detected",
    }


def _check_dosage(answer: str) -> dict:
    """Server-side V3: validate dosages against NLEM formulary."""
    issues = []

    for match in DOSAGE_PATTERN.finditer(answer):
        medication = match.group(1).strip().lower()
        amount = float(match.group(2))
        unit = match.group(3).lower().rstrip("s")

        range_info = KNOWN_DOSAGE_RANGES.get(medication)
        if not range_info:
            issues.append(f'unverified medication "{medication}" with dosage {amount}{unit}')
            continue

        range_unit = str(range_info["unit"]).rstrip("s")
        if unit != range_unit:
            continue  # different unit — can't compare

        min_dose = float(range_info["min"])
        max_dose = float(range_info["max"])

        # Allow 2x tolerance for different formulations
        if amount < min_dose / 2 or amount > max_dose * 2:
            issues.append(
                f'unsafe dosage: {medication} {amount}{unit} '
                f'(expected {min_dose}-{max_dose}{range_unit})'
            )

    if not issues:
        return {
            "stage": "V3_DOSAGE_SERVER",
            "verdict": "PASS",
            "reason": "All dosages within safe ranges or no dosages found",
        }

    has_unsafe = any("unsafe" in i for i in issues)
    return {
        "stage": "V3_DOSAGE_SERVER",
        "verdict": "BLOCK" if has_unsafe else "WARN",
        "reason": "; ".join(issues),
        "replacement": (
            "Dosage information could not be verified. "
            "Please refer to a qualified doctor for prescriptions."
        ) if has_unsafe else None,
    }


def _check_fact_grounding(
    answer: str,
    qdrant_client: Any,
    query_embedding: list[float],
) -> dict:
    """
    Server-side V1: query Qdrant Cloud for evidence supporting the response.
    Checks if the response mentions diseases that exist in our knowledge base.
    """
    try:
        results = qdrant_client.search(
            collection_name="disease_symptoms",
            query_vector=query_embedding,
            limit=5,
            score_threshold=0.35,
        )

        if not results:
            return {
                "stage": "V1_FACT_SERVER",
                "verdict": "WARN",
                "reason": "No Qdrant results found for grounding check",
            }

        # Extract disease names from Qdrant results
        qdrant_diseases = set()
        for r in results:
            disease_name = r.payload.get("disease_name", "")
            if disease_name:
                qdrant_diseases.add(disease_name.lower())

        answer_lower = answer.lower()
        grounded = [d for d in qdrant_diseases if d in answer_lower]

        if len(grounded) > 0:
            return {
                "stage": "V1_FACT_SERVER",
                "verdict": "PASS",
                "reason": f"Response grounded in {len(grounded)} Qdrant evidence(s)",
            }

        return {
            "stage": "V1_FACT_SERVER",
            "verdict": "WARN",
            "reason": "Response diseases not found in Qdrant evidence",
        }

    except Exception as e:
        logger.warning("Qdrant grounding check failed: %s", e)
        return {
            "stage": "V1_FACT_SERVER",
            "verdict": "WARN",
            "reason": f"Qdrant lookup error: {str(e)[:100]}",
        }
