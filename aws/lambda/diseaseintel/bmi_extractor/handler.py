"""
DhanwantariAI — DiseaseIntel Action Group 2: BMIRiskExtractor
aws/lambda/diseaseintel/bmi_extractor/handler.py

Computes BMI-stratified disease risk using India-specific ICMR cut-offs.
India BMI cut-offs are LOWER than WHO global (23/25/27.5 vs 25/30).

Source: ICMR-INDIAB Study + Consensus Statement 2020.
Per DhanwantariAI_Agent_Services_Spec.md §3.5 Action Group 2.
Lambda config: 256 MB / 30s timeout.
"""

import json
import logging
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── ICMR India-Specific BMI Cut-offs ──────────────────────────────────────────

INDIA_BMI_CUTOFFS = {
    "underweight":   {"range": [0,    18.5], "label": "Underweight"},
    "normal":        {"range": [18.5, 23.0], "label": "Normal"},
    "overweight":    {"range": [23.0, 25.0], "label": "Overweight (India)"},
    "obese_class_1": {"range": [25.0, 27.5], "label": "Obese Class I (India)"},
    "obese_class_2": {"range": [27.5, 32.5], "label": "Obese Class II (India)"},
    "obese_class_3": {"range": [32.5, 999],  "label": "Obese Class III"},
}

WHO_BMI_CUTOFFS = {
    "underweight": {"range": [0,    18.5]},
    "normal":      {"range": [18.5, 25.0]},
    "overweight":  {"range": [25.0, 30.0]},
    "obese":       {"range": [30.0, 999]},
}

# ── Disease-BMI Risk Matrix (§3.5 AG2) ───────────────────────────────────────
# Sources: ICMR, WHO, NHM guidelines

DISEASE_BMI_RISK = {
    "hypertension": {
        "normal":        {"risk_multiplier": 1.0, "risk_level": "baseline"},
        "overweight":    {"risk_multiplier": 1.5, "risk_level": "elevated",
                          "source": "ICMR Hypertension Guidelines 2020, Section 4.2"},
        "obese_class_1": {"risk_multiplier": 2.0, "risk_level": "high",
                          "source": "ICMR Hypertension Guidelines 2020, Section 4.3"},
        "obese_class_2": {"risk_multiplier": 2.8, "risk_level": "very_high",
                          "source": "ICMR Hypertension Guidelines 2020, Section 4.4"},
        "underweight":   {"risk_multiplier": 0.8, "risk_level": "low",
                          "note": "Underweight still at risk if malnourished"},
    },
    "type2_diabetes": {
        "normal":        {"risk_multiplier": 1.0, "risk_level": "baseline"},
        "overweight":    {"risk_multiplier": 2.2, "risk_level": "high",
                          "source": "ICMR Diabetes Guidelines 2018, Section 3.1",
                          "india_note": "Asian Indians develop diabetes at lower BMI"},
        "obese_class_1": {"risk_multiplier": 3.5, "risk_level": "very_high"},
        "obese_class_2": {"risk_multiplier": 5.0, "risk_level": "critical"},
    },
    "coronary_artery_disease": {
        "normal":        {"risk_multiplier": 1.0, "risk_level": "baseline"},
        "overweight":    {"risk_multiplier": 1.6, "risk_level": "elevated",
                          "source": "ICMR CVD Guidelines 2019"},
        "obese_class_1": {"risk_multiplier": 2.2, "risk_level": "high"},
        "obese_class_2": {"risk_multiplier": 3.0, "risk_level": "very_high"},
    },
    "asthma": {
        "overweight":    {"risk_multiplier": 1.4, "risk_level": "elevated",
                          "source": "GINA 2023, Section 3.5.2"},
        "obese_class_1": {"risk_multiplier": 1.9, "risk_level": "high"},
    },
    "obstructive_sleep_apnoea": {
        "overweight":    {"risk_multiplier": 2.0, "risk_level": "high"},
        "obese_class_1": {"risk_multiplier": 4.0, "risk_level": "very_high"},
        "obese_class_2": {"risk_multiplier": 6.0, "risk_level": "critical"},
    },
    "osteoarthritis": {
        "overweight":    {"risk_multiplier": 1.5, "risk_level": "elevated"},
        "obese_class_1": {"risk_multiplier": 2.5, "risk_level": "high",
                          "source": "ICMR Musculoskeletal Guidelines 2019"},
    },
    "dengue": {
        "obese_class_1": {"risk_multiplier": 1.3, "risk_level": "elevated",
                          "note": "Obese patients at higher risk of dengue haemorrhagic fever",
                          "source": "NVBDCP Dengue Clinical Management 2021"},
    },
    "malaria": {
        # BMI less directly correlated; underweight increases severity
        "underweight":   {"risk_multiplier": 1.5, "risk_level": "elevated",
                          "source": "NVBDCP Malaria Guidelines"},
    },
    "tuberculosis": {
        "underweight":   {"risk_multiplier": 2.5, "risk_level": "high",
                          "source": "ICMR TB Guidelines, RNTCP"},
    },
    "severe_anaemia": {
        "underweight":   {"risk_multiplier": 2.0, "risk_level": "high",
                          "source": "ICMR Anaemia Guidelines, Section 2.3"},
    },
    "polycystic_ovary_syndrome": {
        "overweight":    {"risk_multiplier": 2.0, "risk_level": "high"},
        "obese_class_1": {"risk_multiplier": 3.0, "risk_level": "very_high"},
    },
    "non_alcoholic_fatty_liver": {
        "overweight":    {"risk_multiplier": 2.5, "risk_level": "high"},
        "obese_class_1": {"risk_multiplier": 4.0, "risk_level": "very_high"},
        "obese_class_2": {"risk_multiplier": 5.5, "risk_level": "critical"},
    },
    "gestational_diabetes": {
        "overweight":    {"risk_multiplier": 2.0, "risk_level": "high",
                          "india_note": "Screening recommended at lower BMI for Indian women"},
        "obese_class_1": {"risk_multiplier": 3.5, "risk_level": "very_high"},
    },
    "stroke": {
        "overweight":    {"risk_multiplier": 1.5, "risk_level": "elevated"},
        "obese_class_1": {"risk_multiplier": 2.0, "risk_level": "high"},
        "obese_class_2": {"risk_multiplier": 2.8, "risk_level": "very_high"},
    },
    "chronic_kidney_disease": {
        "obese_class_1": {"risk_multiplier": 1.8, "risk_level": "elevated"},
        "obese_class_2": {"risk_multiplier": 2.5, "risk_level": "high"},
    },
}


# ── Core Functions ────────────────────────────────────────────────────────────

def compute_bmi_risk_thresholds(disease_id: str) -> dict:
    """
    For a given disease, compute BMI-stratified risk levels
    using India-specific ICMR cut-offs.
    """
    bmi_risks = DISEASE_BMI_RISK.get(disease_id, {})

    risk_matrix = []
    for bmi_cat, cutoffs in INDIA_BMI_CUTOFFS.items():
        risk_entry = bmi_risks.get(bmi_cat, {
            "risk_multiplier": 1.0,
            "risk_level": "no_specific_data",
        })
        risk_matrix.append({
            "bmi_category": bmi_cat,
            "bmi_range_india": cutoffs["range"],
            "bmi_label": cutoffs["label"],
            "risk_multiplier": risk_entry.get("risk_multiplier", 1.0),
            "risk_level": risk_entry.get("risk_level", "baseline"),
            "source": risk_entry.get("source"),
            "india_note": risk_entry.get("india_note"),
            "note": risk_entry.get("note"),
        })

    return {
        "disease_id": disease_id,
        "cutoff_standard": "ICMR_INDIA_2020",
        "risk_matrix": risk_matrix,
    }


def build_full_bmi_matrix(disease_ids: list[str]) -> dict:
    """
    Build the complete BMI x Disease risk matrix for all diseases.
    This becomes a lookup table for the mobile app scoring.
    """
    matrix = {}
    for disease_id in disease_ids:
        matrix[disease_id] = compute_bmi_risk_thresholds(disease_id)

    return {
        "matrix": matrix,
        "disease_count": len(matrix),
        "standard": "ICMR_INDIA_2020",
    }


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions.

    Actions:
      compute_single — compute risk for one disease
        Input: { "action": "compute_single", "disease_id": "hypertension" }

      build_matrix — build full BMI x Disease matrix
        Input: { "action": "build_matrix", "disease_ids": ["hypertension", "type2_diabetes", ...] }

      Default: compute_single from disease_id
    """
    logger.info("BMIRiskExtractor invoked: %s", json.dumps(event, default=str))

    action = event.get("action", "compute_single")
    disease_id = event.get("disease_id", "")

    if action == "build_matrix":
        disease_ids = event.get("disease_ids", list(DISEASE_BMI_RISK.keys()))
        return build_full_bmi_matrix(disease_ids)

    # Default: single disease
    return compute_bmi_risk_thresholds(disease_id)
