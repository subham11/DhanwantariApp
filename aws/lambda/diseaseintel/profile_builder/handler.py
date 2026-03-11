"""
DhanwantariAI — DiseaseIntel Action Group 4: ProfileBuilder
aws/lambda/diseaseintel/profile_builder/handler.py

Assembles complete disease profiles from all extracted data
(SourceResearcher + BMIRiskExtractor + SymptomExtractor).

Per DhanwantariAI_Agent_Services_Spec.md §3.5 Action Group 4.
Lambda config: 512 MB / 60s timeout.
"""

import json
import logging
import os
from datetime import datetime, timedelta

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Review Intervals by Category ──────────────────────────────────────────────

REVIEW_INTERVALS = {
    "infectious":  30,   # Monthly — epidemiology changes rapidly
    "ncd":         90,   # Quarterly — guidelines update slowly
    "maternal":    60,   # Bi-monthly
    "neonatal":    60,
    "nutritional": 90,
    "mental":      90,
    "injury":      180,  # Semi-annual
}

REFERRAL_LEVELS = ["ASHA", "PHC", "CHC", "HOSPITAL"]

DISEASE_CATEGORIES = [
    "infectious", "ncd", "maternal", "neonatal",
    "nutritional", "mental", "injury",
]


def compute_next_review_date(category: str) -> str:
    """Compute next review date based on disease category."""
    days = REVIEW_INTERVALS.get(category, 90)
    return (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")


def build_disease_profile(event: dict) -> dict:
    """
    Assemble a complete disease profile from all extracted data.
    This is the master record stored in DynamoDB dhanwantari-diseases table.
    """
    disease_id = event["disease_id"]
    category = event.get("category", "ncd")

    profile = {
        # Identity
        "disease_id": disease_id,
        "name_en": event["name_en"],
        "name_hi": event.get("name_hi"),
        "name_or": event.get("name_or"),
        "local_names": event.get("local_names", []),
        "icd10_codes": event.get("icd10_codes", []),
        "icd11_code": event.get("icd11_code"),

        # Clinical
        "disease_category": category,
        "symptoms": event.get("symptoms", []),
        "core_symptoms": event.get("core_symptoms", []),
        "red_flag_symptoms": event.get("red_flag_symptoms", []),
        "complications": event.get("complications", []),

        # Risk stratification
        "bmi_risk_matrix": event.get("bmi_risk_matrix", {}),
        "age_risk": {
            "0_28_days": event.get("risk_neonate"),
            "0_5_years": event.get("risk_child_u5"),
            "5_12_years": event.get("risk_child"),
            "12_18_years": event.get("risk_adolescent"),
            "18_60_years": event.get("risk_adult"),
            "60_plus": event.get("risk_elderly"),
        },
        "gender_risk": {
            "female": event.get("risk_female"),
            "male": event.get("risk_male"),
            "pregnant": event.get("risk_pregnant"),
        },
        "hereditary_risk": event.get("hereditary_risk", False),
        "comorbidities": event.get("comorbidities", []),

        # Epidemiology (India-specific)
        "endemic_states": event.get("endemic_states", []),
        "seasonal_peak": event.get("seasonal_peak"),
        "india_prevalence": event.get("india_prevalence"),
        "rural_urban_split": event.get("rural_urban_split"),

        # ASHA referral
        "asha_can_manage": event.get("asha_can_manage", False),
        "referral_level": event.get("referral_level"),
        "referral_criteria": event.get("referral_criteria", []),

        # Medicine references
        "nlem_medicines": event.get("nlem_medicines", []),
        "janaushadhi_medicines": event.get("janaushadhi_medicines", []),
        "ayurvedic_medicines": event.get("ayurvedic_medicines", []),

        # Provenance
        "sources": event.get("sources_cited", []),
        "validated_by": None,
        "validated_at": None,
        "version": event.get("version", "1.0"),
        "updated_at": datetime.utcnow().isoformat(),
        "next_review": compute_next_review_date(category),
        "schema_version": "3.0",
    }

    # Strip None values from age_risk and gender_risk to keep records clean
    profile["age_risk"] = {k: v for k, v in profile["age_risk"].items()
                           if v is not None}
    profile["gender_risk"] = {k: v for k, v in profile["gender_risk"].items()
                              if v is not None}

    return profile


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions.

    Input: merged data from SourceResearcher, BMIRiskExtractor, SymptomExtractor.
    Output: complete disease profile dict ready for StorageWriter.
    """
    logger.info("ProfileBuilder invoked for disease: %s",
                event.get("disease_id", "unknown"))

    profile = build_disease_profile(event)

    logger.info("Profile built: %s — %d symptoms, %d core, %d red flags",
                profile["disease_id"],
                len(profile["symptoms"]),
                len(profile["core_symptoms"]),
                len(profile["red_flag_symptoms"]))

    return profile
