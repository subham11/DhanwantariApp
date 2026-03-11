"""
DhanwantariAI — DiseaseIntel Action Group 5: StorageWriter
aws/lambda/diseaseintel/storage_writer/handler.py

Writes disease profiles, symptom mappings, and BMI matrix to DynamoDB
and exports JSON to S3 for the Knowledge Base.

Tables:
  - dhanwantari-diseases         (PK: disease_id, SK: version)
  - dhanwantari-symptom-mappings (PK: disease_id, SK: symptom_id)
  - dhanwantari-bmi-matrix       (PK: disease_id, SK: bmi_category)

S3 exports:
  - kb/diseases/disease_profiles_v{ver}.json
  - kb/diseases/symptom_mappings_v{ver}.json
  - kb/bmi/bmi_risk_matrix_v{ver}.json

Per DhanwantariAI_Agent_Services_Spec.md §3.5 Action Group 5.
Lambda config: 256 MB / 60s timeout.
"""

import json
import logging
import os
from datetime import datetime
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = os.environ.get("AWS_REGION", "ap-south-1")
S3_BUCKET = os.environ.get("S3_BUCKET", "dhanwantari-kb-ap-south-1")
DISEASES_TABLE = os.environ.get("DISEASES_TABLE", "dhanwantari-diseases")
SYMPTOM_TABLE = os.environ.get("SYMPTOM_TABLE", "dhanwantari-symptom-mappings")
BMI_TABLE = os.environ.get("BMI_TABLE", "dhanwantari-bmi-matrix")
AGENT_RUNS_TABLE = os.environ.get("AGENT_RUNS_TABLE", "dhanwantari-agent-runs")


def _float_to_decimal(obj):
    """Recursively convert floats to Decimal for DynamoDB."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _float_to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_float_to_decimal(i) for i in obj]
    return obj


def _decimal_to_float(obj):
    """Recursively convert Decimal to float for JSON serialisation."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _decimal_to_float(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decimal_to_float(i) for i in obj]
    return obj


# ── DynamoDB Writers ──────────────────────────────────────────────────────────

def write_disease_profiles(profiles: list[dict]) -> dict:
    """Write disease profile records to dhanwantari-diseases table."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(DISEASES_TABLE)

    written = 0
    with table.batch_writer() as batch:
        for profile in profiles:
            item = _float_to_decimal(profile)
            item["disease_id"] = profile["disease_id"]
            item["version"] = profile.get("version", "1.0")
            batch.put_item(Item=item)
            written += 1

    logger.info("Wrote %d disease profiles to %s", written, DISEASES_TABLE)
    return {"table": DISEASES_TABLE, "records_written": written}


def write_symptom_mappings(symptom_data: list[dict]) -> dict:
    """
    Write symptom mapping records to dhanwantari-symptom-mappings table.
    Each record: { disease_id, symptom_id, lift_ratio, prevalence_pct, ... }
    """
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(SYMPTOM_TABLE)

    written = 0
    with table.batch_writer() as batch:
        for mapping in symptom_data:
            item = _float_to_decimal({
                "disease_id": mapping["disease_id"],
                "symptom_id": mapping["symptom_id"],
                "lift_ratio": mapping.get("lift_ratio", 1.0),
                "prevalence_pct": mapping.get("prevalence_pct", 0),
                "specificity": mapping.get("specificity", "medium"),
                "severity_tier": mapping.get("severity_tier", "moderate"),
                "sources": mapping.get("sources", []),
                "version": mapping.get("version", "1.0"),
                "updated_at": datetime.utcnow().isoformat(),
            })
            batch.put_item(Item=item)
            written += 1

    logger.info("Wrote %d symptom mappings to %s", written, SYMPTOM_TABLE)
    return {"table": SYMPTOM_TABLE, "records_written": written}


def write_bmi_matrix(bmi_data: list[dict]) -> dict:
    """
    Write BMI risk matrix records to dhanwantari-bmi-matrix table.
    Each record: { disease_id, bmi_category, risk_multiplier, risk_level, ... }
    """
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(BMI_TABLE)

    written = 0
    with table.batch_writer() as batch:
        for entry in bmi_data:
            item = _float_to_decimal({
                "disease_id": entry["disease_id"],
                "bmi_category": entry["bmi_category"],
                "bmi_range_india": entry.get("bmi_range_india", []),
                "risk_multiplier": entry.get("risk_multiplier", 1.0),
                "risk_level": entry.get("risk_level", "baseline"),
                "source": entry.get("source"),
                "india_note": entry.get("india_note"),
                "updated_at": datetime.utcnow().isoformat(),
            })
            batch.put_item(Item=item)
            written += 1

    logger.info("Wrote %d BMI matrix entries to %s", written, BMI_TABLE)
    return {"table": BMI_TABLE, "records_written": written}


# ── S3 JSON Exports ──────────────────────────────────────────────────────────

def export_to_s3(data: dict, s3_key: str) -> dict:
    """Export processed data as JSON to S3 for Knowledge Base consumption."""
    s3 = boto3.client("s3", region_name=REGION)

    body = json.dumps(_decimal_to_float(data), indent=2, ensure_ascii=False)
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=body.encode("utf-8"),
        ContentType="application/json",
    )

    logger.info("Exported to s3://%s/%s (%d bytes)", S3_BUCKET, s3_key, len(body))
    return {"bucket": S3_BUCKET, "key": s3_key, "size_bytes": len(body)}


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions WriteAll state.

    Input: {
      "profiles":           [...],   # From ProfileBuilder (list of disease profiles)
      "symptom_mappings":   [...],   # Flattened symptom->disease mappings
      "bmi_matrix":         [...],   # Flattened BMI risk entries
      "version":            "3.0.0"
    }

    Writes to 3 DynamoDB tables + 3 S3 JSON exports.
    """
    logger.info("DiseaseIntel StorageWriter invoked")

    profiles = event.get("profiles", [])
    symptom_mappings = event.get("symptom_mappings", [])
    bmi_entries = event.get("bmi_matrix", [])
    version = event.get("version", "1.0.0")

    results = {"dynamo": {}, "s3": {}}

    # ── DynamoDB writes ───────────────────────────────────────────────────────
    if profiles:
        results["dynamo"]["diseases"] = write_disease_profiles(profiles)

    if symptom_mappings:
        results["dynamo"]["symptom_mappings"] = write_symptom_mappings(
            symptom_mappings
        )

    if bmi_entries:
        results["dynamo"]["bmi_matrix"] = write_bmi_matrix(bmi_entries)

    # ── S3 exports ────────────────────────────────────────────────────────────
    if profiles:
        results["s3"]["disease_profiles"] = export_to_s3(
            {"diseases": _decimal_to_float(profiles), "version": version,
             "exported_at": datetime.utcnow().isoformat()},
            f"kb/diseases/disease_profiles_v{version}.json",
        )

    if symptom_mappings:
        results["s3"]["symptom_mappings"] = export_to_s3(
            {"mappings": _decimal_to_float(symptom_mappings), "version": version,
             "exported_at": datetime.utcnow().isoformat()},
            f"kb/diseases/symptom_mappings_v{version}.json",
        )

    if bmi_entries:
        results["s3"]["bmi_risk_matrix"] = export_to_s3(
            {"bmi_matrix": _decimal_to_float(bmi_entries), "version": version,
             "exported_at": datetime.utcnow().isoformat()},
            f"kb/bmi/bmi_risk_matrix_v{version}.json",
        )

    logger.info("StorageWriter complete: %s", json.dumps(results, default=str))
    return results
