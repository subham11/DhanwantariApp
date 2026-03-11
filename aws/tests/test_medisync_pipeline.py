"""
DhanwantariAI — Integration Test Scripts
aws/tests/test_medisync_pipeline.py

Tests MediSync pipeline locally with synthetic data:
  B11: PMBJP PDF test — validate output schema
  B12: Diff engine test — synthetic version change

Run: python3 -m pytest aws/tests/test_medisync_pipeline.py -v
"""

import importlib
import importlib.util
import json
import sys
import os

# Add project root to path for imports
AWS_ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, AWS_ROOT)


def _load_handler(agent: str, action_group: str):
    """Load a handler module from aws/lambda/{agent}/{action_group}/handler.py."""
    path = os.path.join(AWS_ROOT, "lambda", agent, action_group, "handler.py")
    spec = importlib.util.spec_from_file_location(
        f"{agent}.{action_group}.handler", path,
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_normaliser = _load_handler("medisync", "normaliser")
normalise_record = _normaliser.normalise_record
detect_duplicates = _normaliser.detect_duplicates

_diff_engine = _load_handler("medisync", "diff_engine")
compare_records = _diff_engine.compare_records


# ── B11: Validate Normaliser Output Schema ───────────────────────────────────

REQUIRED_ALLO_FIELDS = {
    "drug_code", "generic_name", "dosage_form", "strength",
    "pack_size", "mrp", "therapeutic_class", "source",
    "updated_at",
}

REQUIRED_AYUR_FIELDS = {
    "product_id", "product_name", "brand", "mrp",
    "category", "source", "updated_at",
}


def test_normalise_allopathic_record():
    """B11: Normalise a raw allopathic record and validate output schema."""
    raw = {
        "drug_code": "PMBJP001",
        "generic_name": "Paracetamol",
        "dosage_form": "Tablet",
        "strength": "500mg",
        "pack_size": "10 tablets",
        "mrp": "12.00",
        "category": "Analgesic",
        "source": "PMBJP",
    }
    result = normalise_record(raw, med_type="allopathic")
    assert result is not None, "Normalisation returned None"
    assert "normalised" in result, "Expected 'normalised' key in result"
    norm = result["normalised"]

    assert isinstance(norm["mrp"], float), "MRP should be float"
    assert norm["mrp"] == 12.0
    assert norm["drug_code"] == "PMBJP001"
    assert norm["generic_name"] == "Paracetamol"


def test_normalise_ayurvedic_record():
    """B11: Normalise a raw Ayurvedic record and validate output schema."""
    raw = {
        "product_id": "HIM-ASHV-001",
        "product_name": "Ashvagandha",
        "brand": "Himalaya",
        "mrp": "₹250.00",
        "category": "Adaptogen",
        "source": "HIMALAYA",
        "generic_name": "Ashvagandha",
        "drug_code": "HIM-ASHV-001",
    }
    result = normalise_record(raw, med_type="ayurvedic")
    assert result is not None
    norm = result["normalised"]

    assert isinstance(norm["mrp"], float)
    assert norm["mrp"] == 250.0


def test_normalise_rejects_invalid():
    """B11: Records missing required fields should fail validation."""
    raw = {"generic_name": "Incomplete Record"}
    result = normalise_record(raw, med_type="allopathic")
    assert result["valid"] is False, "Incomplete record should fail validation"


# ── B11: Deduplication ───────────────────────────────────────────────────────

def test_deduplication():
    """B11: Duplicate records by generic_name+strength+dosage_form are merged."""
    records = [
        {"drug_code": "PMBJP-0001", "generic_name": "Paracetamol",
         "strength": "500mg", "dosage_form": "Tablet", "mrp": 12.0,
         "source": "PMBJP", "pack_size": "10", "updated_at": "2026-01-01"},
        {"drug_code": "NLEM-0001", "generic_name": "Paracetamol",
         "strength": "500mg", "dosage_form": "Tablet", "mrp": 11.5,
         "source": "NLEM", "pack_size": "10", "updated_at": "2026-01-01"},
        {"drug_code": "PMBJP-0002", "generic_name": "Ibuprofen",
         "strength": "400mg", "dosage_form": "Tablet", "mrp": 15.0,
         "source": "PMBJP", "pack_size": "10", "updated_at": "2026-01-01"},
    ]
    deduped = detect_duplicates(records)
    assert deduped["total_out"] == 2, f"Expected 2 unique records, got {deduped['total_out']}"
    assert len(deduped["unique"]) == 2


# ── B12: Diff Engine — Synthetic Version Change ─────────────────────────────

def test_diff_detects_additions():
    """B12: New records not in current should be detected as additions."""
    current = [
        {"drug_code": "PMBJP-0001", "source": "PMBJP", "mrp": 12.0,
         "generic_name": "Paracetamol"},
    ]
    new = [
        {"drug_code": "PMBJP-0001", "source": "PMBJP", "mrp": 12.0,
         "generic_name": "Paracetamol"},
        {"drug_code": "PMBJP-0002", "source": "PMBJP", "mrp": 15.0,
         "generic_name": "Ibuprofen"},
    ]
    diff = compare_records(new, current)
    assert len(diff["additions"]) == 1
    assert diff["additions"][0]["drug_code"] == "PMBJP-0002"


def test_diff_detects_removals():
    """B12: Records in current but not in new should be detected."""
    current = [
        {"drug_code": "PMBJP-0001", "source": "PMBJP", "mrp": 12.0,
         "generic_name": "Paracetamol"},
        {"drug_code": "PMBJP-0002", "source": "PMBJP", "mrp": 15.0,
         "generic_name": "Ibuprofen"},
    ]
    new = [
        {"drug_code": "PMBJP-0001", "source": "PMBJP", "mrp": 12.0,
         "generic_name": "Paracetamol"},
    ]
    diff = compare_records(new, current)
    assert len(diff["removals"]) == 1
    assert diff["removals"][0]["drug_code"] == "PMBJP-0002"


def test_diff_detects_price_change():
    """B12: Price change should be in updates."""
    current = [
        {"drug_code": "PMBJP-0001", "source": "PMBJP", "mrp": 12.0,
         "generic_name": "Paracetamol"},
    ]
    new = [
        {"drug_code": "PMBJP-0001", "source": "PMBJP", "mrp": 14.0,
         "generic_name": "Paracetamol"},
    ]
    diff = compare_records(new, current)
    assert len(diff["updates"]) == 1
    assert diff["updates"][0]["changes"]["mrp"]["old"] == 12.0
    assert diff["updates"][0]["changes"]["mrp"]["new"] == 14.0


def test_diff_flags_large_price_change():
    """B12: >20% price change should trigger a price flag."""
    current = [
        {"drug_code": "PMBJP-0001", "source": "PMBJP", "mrp": 10.0,
         "generic_name": "Paracetamol"},
    ]
    new = [
        {"drug_code": "PMBJP-0001", "source": "PMBJP", "mrp": 15.0,
         "generic_name": "Paracetamol"},
    ]
    diff = compare_records(new, current)
    assert len(diff["price_flags"]) >= 1, "50% price increase should be flagged"
    flag = diff["price_flags"][0]
    assert flag["drug_code"] == "PMBJP-0001"
    assert flag["pct_change"] == 50.0


def test_diff_no_changes():
    """B12: Identical records should produce no changes."""
    records = [
        {"drug_code": "PMBJP-0001", "source": "PMBJP", "mrp": 12.0,
         "generic_name": "Paracetamol"},
    ]
    diff = compare_records(records, records)
    assert len(diff["additions"]) == 0
    assert len(diff["removals"]) == 0
    assert len(diff["updates"]) == 0
    assert len(diff["price_flags"]) == 0


def test_diff_auto_approve():
    """B12: No price flags and few removals — summary should show 0 flags."""
    current = [
        {"drug_code": f"PMBJP-{i:04d}", "source": "PMBJP", "mrp": 10.0,
         "generic_name": f"Drug{i}"}
        for i in range(10)
    ]
    new = current + [
        {"drug_code": "PMBJP-NEW-001", "source": "PMBJP", "mrp": 12.0,
         "generic_name": "NewDrug"}
    ]
    diff = compare_records(new, current)
    assert diff["summary"]["flags"] == 0
    assert diff["summary"]["added"] == 1


# ── DiseaseIntel Tests ───────────────────────────────────────────────────────

def test_bmi_risk_extractor():
    """Test BMI risk matrix computation for known disease."""
    _bmi = _load_handler("diseaseintel", "bmi_extractor")
    compute_bmi_risk_thresholds = _bmi.compute_bmi_risk_thresholds
    build_full_bmi_matrix = _bmi.build_full_bmi_matrix

    # Single disease
    result = compute_bmi_risk_thresholds("hypertension")
    assert result["disease_id"] == "hypertension"
    assert result["cutoff_standard"] == "ICMR_INDIA_2020"
    assert len(result["risk_matrix"]) == 6  # 6 ICMR BMI categories

    # Overweight category should have elevated risk for hypertension
    overweight = next(r for r in result["risk_matrix"]
                      if r["bmi_category"] == "overweight")
    assert overweight["risk_multiplier"] > 1.0

    # Full matrix
    matrix = build_full_bmi_matrix(["hypertension", "type2_diabetes"])
    assert matrix["disease_count"] == 2


def test_bmi_risk_unknown_disease():
    """Unknown disease should return baseline risk for all categories."""
    _bmi = _load_handler("diseaseintel", "bmi_extractor")
    compute_bmi_risk_thresholds = _bmi.compute_bmi_risk_thresholds

    result = compute_bmi_risk_thresholds("unknown_disease_xyz")
    for entry in result["risk_matrix"]:
        assert entry["risk_level"] == "no_specific_data"


def test_symptom_lift_ratio():
    """Test lift ratio computation."""
    _symptom = _load_handler("diseaseintel", "symptom_extractor")
    compute_symptom_prevalence = _symptom.compute_symptom_prevalence

    result = compute_symptom_prevalence(
        disease_id="malaria",
        symptom_id="fever",
        prevalence_pct=95.0,
        baseline_pct=15.0,
    )
    assert result["disease_id"] == "malaria"
    assert result["symptom_id"] == "fever"
    assert result["lift_ratio"] == round(0.95 / 0.15, 3)


def test_profile_builder():
    """Test disease profile assembly."""
    _profile = _load_handler("diseaseintel", "profile_builder")
    build_disease_profile = _profile.build_disease_profile

    event = {
        "disease_id": "D001",
        "name_en": "Malaria",
        "name_hi": "मलेरिया",
        "icd10_codes": ["B50-B54"],
        "category": "infectious",
        "symptoms": [{"symptom_id": "fever", "display_name": "Fever"}],
        "core_symptoms": ["fever", "chills"],
        "red_flag_symptoms": ["cerebral_malaria"],
        "complications": ["severe_anaemia"],
        "bmi_risk_matrix": {},
        "endemic_states": ["Odisha", "Jharkhand"],
        "seasonal_peak": "monsoon",
        "asha_can_manage": True,
        "referral_level": "PHC",
        "sources_cited": ["WHO", "NVBDCP"],
        "version": "1.0",
    }

    profile = build_disease_profile(event)
    assert profile["disease_id"] == "D001"
    assert profile["name_en"] == "Malaria"
    assert profile["disease_category"] == "infectious"
    assert profile["schema_version"] == "3.0"
    assert profile["next_review"] is not None
    assert len(profile["core_symptoms"]) == 2


if __name__ == "__main__":
    # Run without pytest
    test_funcs = [v for k, v in globals().items() if k.startswith("test_")]
    passed = failed = 0
    for fn in test_funcs:
        try:
            fn()
            print(f"  PASS  {fn.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {fn.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed out of {passed + failed}")
    sys.exit(1 if failed else 0)
