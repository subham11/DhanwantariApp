"""
DhanwantariAI — MediSync Action Group 5: StorageWriter
aws/lambda/medisync/storage_writer/handler.py

Batch writes normalised medicine records to DynamoDB and exports
the full dataset as JSON to S3 for mobile KB patches.

Per DhanwantariAI_Agent_Services_Spec.md §2.5 Action Group 5.
Lambda config: 512 MB / 120s timeout.
"""

import json
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION          = os.environ.get("AWS_REGION", "ap-south-1")
MEDICINES_TABLE = os.environ.get("MEDICINES_TABLE", "dhanwantari-medicines")
KB_BUCKET       = os.environ.get("KB_BUCKET", "dhanwantari-kb-ap-south-1")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
s3       = boto3.client("s3", region_name=REGION)


def _float_to_decimal(obj):
    """Convert float values to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _float_to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_float_to_decimal(i) for i in obj]
    return obj


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── DynamoDB Writer ───────────────────────────────────────────────────────────

def write_to_dynamodb(records: list[dict], version: str) -> dict:
    """
    Batch write normalised medicine records to DynamoDB.
    Table: dhanwantari-medicines
    PK: drug_code / SK: source
    """
    table = dynamodb.Table(MEDICINES_TABLE)
    written = 0
    errors = 0

    with table.batch_writer() as batch:
        for record in records:
            try:
                item = _float_to_decimal(record)
                item["version"] = version
                item["updated_at"] = _utcnow_iso()
                # No TTL — medicines persist indefinitely
                batch.put_item(Item=item)
                written += 1
            except Exception as e:
                errors += 1
                logger.warning(
                    "Failed to write %s: %s",
                    record.get("drug_code", "UNKNOWN"), e,
                )

    logger.info("DynamoDB write: %d written, %d errors", written, errors)
    return {"written": written, "errors": errors, "table": MEDICINES_TABLE}


# ── S3 JSON Export ────────────────────────────────────────────────────────────

def write_json_to_s3(
    records: list[dict],
    version: str,
    sources_used: list[str],
) -> dict:
    """
    Write full medicine dataset as JSON to S3 for mobile KB patches.
    Path: kb/medicines/medicines_v{version}.json
    """
    payload = {
        "version": version,
        "generated_at": _utcnow_iso(),
        "count": len(records),
        "sources": sources_used,
        "medicines": records,
    }

    key = f"kb/medicines/medicines_v{version}.json"

    s3.put_object(
        Bucket=KB_BUCKET,
        Key=key,
        Body=json.dumps(payload, ensure_ascii=False, default=str),
        ContentType="application/json",
    )

    logger.info("S3 export: %s (%d records)", key, len(records))
    return {"s3_path": key, "version": version, "count": len(records)}


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions.

    Input:
      {
        "action": "write_all" (default) | "dynamo_only" | "s3_only",
        "records": [...],
        "version": "20260301",
        "sources_used": ["PMBJP", "AYUSH"]
      }

    For conditional writes (from DiffEngine):
      {
        "action": "apply_diff",
        "additions": [...],
        "updates": [...],
        "version": "20260301",
        "sources_used": ["PMBJP"]
      }
    """
    logger.info("StorageWriter invoked")

    action = event.get("action", "write_all")
    version = event.get("version", datetime.now(timezone.utc).strftime("%Y%m%d"))
    sources_used = event.get("sources_used", [])

    if action == "apply_diff":
        return _apply_diff(event, version)

    records = event.get("records", [])

    if action == "dynamo_only":
        return write_to_dynamodb(records, version)

    if action == "s3_only":
        return write_json_to_s3(records, version, sources_used)

    # Default: write to both DynamoDB and S3
    dynamo_result = write_to_dynamodb(records, version)
    s3_result = write_json_to_s3(records, version, sources_used)

    return {
        "dynamodb": dynamo_result,
        "s3": s3_result,
        "version": version,
    }


def _apply_diff(event: dict, version: str) -> dict:
    """
    Apply diff results: write additions and updates to DynamoDB.
    Removals are soft-deleted (marked inactive, not purged).
    """
    table = dynamodb.Table(MEDICINES_TABLE)

    additions = event.get("additions", [])
    updates = event.get("updates", [])
    removals = event.get("removals", [])
    now = _utcnow_iso()

    written = 0
    errors = 0

    # Write additions
    with table.batch_writer() as batch:
        for record in additions:
            try:
                item = _float_to_decimal(record)
                item["version"] = version
                item["updated_at"] = now
                batch.put_item(Item=item)
                written += 1
            except Exception as e:
                errors += 1
                logger.warning("Add failed %s: %s", record.get("drug_code"), e)

    # Apply updates (individual UpdateItem for granular changes)
    for update in updates:
        drug_code = update.get("drug_code")
        changes = update.get("changes", {})
        if not drug_code or not changes:
            continue

        try:
            update_expr_parts = ["#ver = :ver", "#upd = :upd"]
            attr_names = {"#ver": "version", "#upd": "updated_at"}
            attr_values = {":ver": version, ":upd": now}

            for field, vals in changes.items():
                safe_name = f"#f_{field.replace('-', '_')}"
                safe_val = f":v_{field.replace('-', '_')}"
                update_expr_parts.append(f"{safe_name} = {safe_val}")
                attr_names[safe_name] = field
                attr_values[safe_val] = _float_to_decimal(vals["new"])

            # Get the source from the original update record to use as SK
            source = update.get("source", "PMBJP")
            table.update_item(
                Key={"drug_code": drug_code, "source": source},
                UpdateExpression="SET " + ", ".join(update_expr_parts),
                ExpressionAttributeNames=attr_names,
                ExpressionAttributeValues=attr_values,
            )
            written += 1
        except Exception as e:
            errors += 1
            logger.warning("Update failed %s: %s", drug_code, e)

    # Soft-delete removals (mark inactive)
    for record in removals:
        drug_code = record.get("drug_code")
        source = record.get("source", "PMBJP")
        if not drug_code:
            continue
        try:
            table.update_item(
                Key={"drug_code": drug_code, "source": source},
                UpdateExpression="SET #st = :st, #upd = :upd, #ver = :ver",
                ExpressionAttributeNames={
                    "#st": "status", "#upd": "updated_at", "#ver": "version",
                },
                ExpressionAttributeValues={
                    ":st": "inactive", ":upd": now, ":ver": version,
                },
            )
        except Exception as e:
            logger.warning("Soft-delete failed %s: %s", drug_code, e)

    logger.info(
        "Diff applied: %d additions, %d updates, %d removals soft-deleted, %d errors",
        len(additions), len(updates), len(removals), errors,
    )

    return {
        "written": written,
        "additions": len(additions),
        "updates_applied": len(updates),
        "removals_soft_deleted": len(removals),
        "errors": errors,
        "version": version,
    }
