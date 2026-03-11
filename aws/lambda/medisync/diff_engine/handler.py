"""
DhanwantariAI — MediSync Action Group 4: DiffEngine
aws/lambda/medisync/diff_engine/handler.py

Compares new normalised medicine records against current DynamoDB version.
Detects additions, removals, price changes, and name changes.
Flags >20% price changes for mandatory manual review.

Per DhanwantariAI_Agent_Services_Spec.md §2.5 Action Group 4.
Lambda config: 512 MB / 90s timeout.
"""

import json
import logging
import os
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION          = os.environ.get("AWS_REGION", "ap-south-1")
MEDICINES_TABLE = os.environ.get("MEDICINES_TABLE", "dhanwantari-medicines")
PRICE_FLAG_PCT  = 20  # Flag threshold for price change review

dynamodb = boto3.resource("dynamodb", region_name=REGION)


def _decimal_to_float(obj):
    """Convert DynamoDB Decimal values to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _decimal_to_float(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decimal_to_float(i) for i in obj]
    return obj


def fetch_current_from_dynamo(source: str | None = None) -> list[dict]:
    """
    Scan current medicine records from DynamoDB.
    Optionally filter by source (PMBJP, NLEM, etc.).
    """
    table = dynamodb.Table(MEDICINES_TABLE)

    scan_kwargs = {}
    if source:
        scan_kwargs["FilterExpression"] = boto3.dynamodb.conditions.Attr("source").eq(source)

    items = []
    while True:
        resp = table.scan(**scan_kwargs)
        items.extend(resp.get("Items", []))
        if "LastEvaluatedKey" not in resp:
            break
        scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

    return [_decimal_to_float(item) for item in items]


def compare_records(new_records: list[dict], current_records: list[dict]) -> dict:
    """
    Diff new records vs current records by drug_code.

    Returns:
      additions   — records in new but not current
      removals    — records in current but not new
      updates     — records with field changes
      price_flags — records with >20% price change
    """
    new_index = {r["drug_code"]: r for r in new_records if r.get("drug_code")}
    current_index = {r["drug_code"]: r for r in current_records if r.get("drug_code")}

    additions = []
    removals = []
    updates = []
    price_flags = []

    # Detect additions and updates
    for code, record in new_index.items():
        if code not in current_index:
            additions.append(record)
        else:
            current = current_index[code]
            changes = {}

            # Price change
            new_mrp = float(record.get("mrp", 0) or 0)
            cur_mrp = float(current.get("mrp", 0) or 0)
            if new_mrp != cur_mrp:
                pct_change = (
                    abs(new_mrp - cur_mrp) / max(cur_mrp, 0.01) * 100
                )
                changes["mrp"] = {"old": cur_mrp, "new": new_mrp}

                if pct_change > PRICE_FLAG_PCT:
                    price_flags.append({
                        "drug_code": code,
                        "name": record.get("generic_name", ""),
                        "pct_change": round(pct_change, 1),
                        "old_mrp": cur_mrp,
                        "new_mrp": new_mrp,
                        "flag_reason": f">{PRICE_FLAG_PCT}% price change — manual review required",
                    })

            # Name change
            new_name = (record.get("generic_name") or "").strip()
            cur_name = (current.get("generic_name") or "").strip()
            if new_name != cur_name:
                changes["generic_name"] = {"old": cur_name, "new": new_name}

            # Category change
            new_cat = (record.get("category") or "").strip()
            cur_cat = (current.get("category") or "").strip()
            if new_cat != cur_cat:
                changes["category"] = {"old": cur_cat, "new": new_cat}

            if changes:
                updates.append({"drug_code": code, "changes": changes})

    # Detect removals
    for code in current_index:
        if code not in new_index:
            removals.append(current_index[code])

    return {
        "additions": additions,
        "removals": removals,
        "updates": updates,
        "price_flags": price_flags,
        "summary": {
            "total_new": len(new_records),
            "total_current": len(current_records),
            "added": len(additions),
            "removed": len(removals),
            "changed": len(updates),
            "flags": len(price_flags),
        },
    }


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions.

    Input:
      {
        "new_records": [...],           # Normalised records from this run
        "source": "PMBJP" (optional),   # Filter current records by source
        "skip_dynamo_fetch": false       # If true, use event.current_records instead
      }
    Or with pre-fetched current:
      {
        "new_records": [...],
        "current_records": [...],
        "skip_dynamo_fetch": true
      }
    """
    logger.info("DiffEngine invoked: %d new records", len(event.get("new_records", [])))

    new_records = event.get("new_records", [])
    skip_fetch = event.get("skip_dynamo_fetch", False)

    if skip_fetch:
        current_records = event.get("current_records", [])
    else:
        source_filter = event.get("source")
        current_records = fetch_current_from_dynamo(source_filter)
        logger.info("Fetched %d current records from DynamoDB", len(current_records))

    result = compare_records(new_records, current_records)

    logger.info(
        "Diff complete: +%d -%d ~%d flags=%d",
        result["summary"]["added"],
        result["summary"]["removed"],
        result["summary"]["changed"],
        result["summary"]["flags"],
    )

    # Attach flag for Step Functions conditional branching
    result["has_price_flags"] = len(result["price_flags"]) > 0
    result["auto_approve"] = (
        len(result["price_flags"]) == 0
        and len(result["removals"]) < 50  # Guard against data source issues
    )

    return result
