"""
DhanwantariAI — MediSync Action Group 3: DataNormaliser
aws/lambda/medisync/normaliser/handler.py

Validates, normalises, and deduplicates medicine records parsed by
PDFParser. Enforces MEDICINE_SCHEMA, maps ICD-10 codes, detects
duplicates by composite key.

Per DhanwantariAI_Agent_Services_Spec.md §2.5 Action Group 3.
Lambda config: 256 MB / 60s timeout.
"""

import json
import logging
import os
import re
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Schema Definitions ────────────────────────────────────────────────────────

MEDICINE_SCHEMA = {
    "allopathic": {
        "required": ["generic_name", "drug_code", "mrp", "category", "source"],
        "optional": [
            "brand_name", "pack_size", "dosage_form", "strength",
            "therapeutic_class", "icd10_diseases", "nlem_listed",
            "asha_kit", "prescription_required",
        ],
    },
    "ayurvedic": {
        "required": [
            "product_name", "brand", "primary_herb", "therapeutic_use",
            "ayush_reg_number", "mrp", "source",
        ],
        "optional": [
            "formulation_type", "dosage", "classical_reference",
            "api_reference", "nleam_listed", "icd10_diseases",
            "contraindications", "pack_size",
        ],
    },
}

# PMBJP drug code — alphanumeric 4-8 chars
DRUG_CODE_RE = re.compile(r"^[A-Z0-9]{4,8}$")

# ICD-10 category mapping (common PMBJP categories)
_CATEGORY_ICD10_MAP = {
    "analgesic":         ["M79.3", "R52"],
    "anti-infective":    ["A49.9"],
    "anti-diabetic":     ["E11"],
    "anti-hypertensive": ["I10"],
    "anti-malarial":     ["B54"],
    "anti-tubercular":   ["A15"],
    "anti-asthmatic":    ["J45"],
    "anti-anaemic":      ["D50"],
    "cardiovascular":    ["I25.9"],
    "gastrointestinal":  ["K30"],
    "dermatological":    ["L30.9"],
    "ophthalmic":        ["H57.9"],
}


def _map_category_to_icd10(category: str) -> list[str]:
    """Map a therapeutic category to ICD-10 codes."""
    if not category:
        return []
    key = category.strip().lower().replace(" ", "-")
    for cat_key, codes in _CATEGORY_ICD10_MAP.items():
        if cat_key in key:
            return codes
    return []


def _validate_required_fields(record: dict, med_type: str) -> bool:
    """Check that all required fields for the schema type are present and non-empty."""
    schema = MEDICINE_SCHEMA.get(med_type, MEDICINE_SCHEMA["allopathic"])
    for field in schema["required"]:
        val = record.get(field)
        if val is None or (isinstance(val, str) and not val.strip()):
            return False
    return True


# ── Single Record Normalisation ───────────────────────────────────────────────

def normalise_record(record: dict, med_type: str = "allopathic") -> dict:
    """
    Normalise a single medicine record.
    - Title-case generic name
    - Validate/uppercase drug code
    - Strip currency symbols from MRP
    - Map category to ICD-10
    - Add schema_version and normalised_at
    """
    normalised = {}

    # Generic name — title-case, strip whitespace
    normalised["generic_name"] = (
        record.get("generic_name", "").strip().title()
    )

    # Drug code — uppercase, validate format
    drug_code = (record.get("drug_code", "") or "").strip().upper()
    normalised["drug_code"] = drug_code if DRUG_CODE_RE.match(drug_code) else None

    # MRP — strip ₹/Rs. symbols, convert to float
    mrp_raw = record.get("mrp", "0")
    cleaned = re.sub(r"[^\d.]", "", str(mrp_raw))
    normalised["mrp"] = float(cleaned) if cleaned else 0.0

    # Category
    category = (record.get("category", "") or "").strip()
    normalised["category"] = category

    # ICD-10 mapping
    normalised["icd10_diseases"] = _map_category_to_icd10(category)

    # Pack size
    normalised["pack_size"] = (record.get("pack_size") or "").strip() or None

    # Source provenance
    normalised["source"] = record.get("source", "UNKNOWN")
    normalised["source_url"] = record.get("source_url")
    normalised["extracted_at"] = record.get("fetched_at") or record.get("_fetched_at")
    normalised["normalised_at"] = datetime.now(timezone.utc).isoformat()
    normalised["schema_version"] = "2.0"

    # Copy optional fields if present
    for field in MEDICINE_SCHEMA.get(med_type, {}).get("optional", []):
        if field in record and field not in normalised:
            normalised[field] = record[field]

    valid = _validate_required_fields(normalised, med_type)

    return {"normalised": normalised, "valid": valid}


# ── Deduplication ─────────────────────────────────────────────────────────────

def detect_duplicates(records: list[dict]) -> dict:
    """
    Detect duplicates by composite key: generic_name + strength + dosage_form.
    Keep first occurrence, report duplicates with original index.
    """
    seen: dict[str, int] = {}
    dupes = []
    unique = []

    for r in records:
        key = (
            f"{(r.get('generic_name') or '').lower()}_"
            f"{(r.get('strength') or '').lower()}_"
            f"{(r.get('dosage_form') or '').lower()}"
        )
        if key in seen:
            dupes.append({"duplicate": r, "original_index": seen[key]})
        else:
            seen[key] = len(unique)
            unique.append(r)

    return {
        "unique": unique,
        "duplicates": dupes,
        "total_in": len(records),
        "total_out": len(unique),
    }


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions.

    Actions:
      normalise_batch — normalise a list of parsed records
        Input: { "action": "normalise_batch", "records": [...], "type": "allopathic"|"ayurvedic" }
        Output: { "normalised": [...], "valid_count": N, "invalid_count": N }

      deduplicate — deduplicate records
        Input: { "action": "deduplicate", "records": [...] }
        Output: { "unique": [...], "duplicates": [...], "total_in": N, "total_out": N }

      normalise_and_dedup — combined pipeline (default)
        Input: { "records": [...], "type": "allopathic" }
        Output: { "records": [...], "valid_count": N, "invalid_count": N, "duplicates_removed": N }
    """
    logger.info("Normaliser invoked: %d records", len(event.get("records", [])))

    action = event.get("action", "normalise_and_dedup")
    med_type = event.get("type", "allopathic")
    records = event.get("records", [])

    if action == "normalise_batch":
        return _normalise_batch(records, med_type)

    if action == "deduplicate":
        return detect_duplicates(records)

    # Default: normalise → deduplicate pipeline
    normalised_results = _normalise_batch(records, med_type)
    valid_records = normalised_results["normalised"]
    dedup_result = detect_duplicates(valid_records)

    return {
        "records": dedup_result["unique"],
        "valid_count": normalised_results["valid_count"],
        "invalid_count": normalised_results["invalid_count"],
        "duplicates_removed": len(dedup_result["duplicates"]),
        "total_output": dedup_result["total_out"],
    }


def _normalise_batch(records: list[dict], med_type: str) -> dict:
    """Normalise a batch of records, separating valid from invalid."""
    normalised = []
    invalid = []

    for r in records:
        result = normalise_record(r, med_type)
        if result["valid"]:
            normalised.append(result["normalised"])
        else:
            invalid.append({"record": r, "reason": "missing required fields"})

    logger.info(
        "Normalised %d records: %d valid, %d invalid",
        len(records), len(normalised), len(invalid),
    )

    return {
        "normalised": normalised,
        "valid_count": len(normalised),
        "invalid_count": len(invalid),
        "invalid_records": invalid[:50],  # Cap to avoid oversized payloads
    }
