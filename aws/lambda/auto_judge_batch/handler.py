"""
DhanwantariAI — Nightly Batch Auto-Judge Lambda
aws/lambda/auto_judge_batch/handler.py

Triggered by EventBridge rule (cron: 02:00 IST daily).
Reads the day's Bedrock escalation logs from DynamoDB,
re-scores them with Haiku, and writes results back.

Per DhanwantariAI Self-Verification Strategy §8.3.
"""

import json
import os
import logging
from datetime import date, timedelta
from decimal import Decimal

import boto3

# Import from sibling — deployed as a Layer or bundled
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "bedrock_proxy"))
from auto_judge import batch_judge

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION          = os.environ.get("AWS_REGION", "ap-south-1")
MODEL_ID        = os.environ.get("JUDGE_MODEL", "anthropic.claude-3-haiku-20240307-v1:0")
USAGE_TABLE     = os.environ.get("USAGE_TABLE", "bedrock_usage")
JUDGE_TABLE     = os.environ.get("JUDGE_TABLE", "auto_judge_results")
DAILY_BATCH_CAP = int(os.environ.get("DAILY_BATCH_CAP", "200"))

bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)
dynamodb        = boto3.resource("dynamodb", region_name=REGION)
cloudwatch      = boto3.client("cloudwatch", region_name=REGION)


def handler(event: dict, context) -> dict:
    """
    EventBridge-triggered handler.
    Reads yesterday's escalation logs, scores them, stores results.
    """
    yesterday = str(date.today() - timedelta(days=1))
    logger.info("Batch Auto-Judge for date: %s", yesterday)

    # Read escalation logs from DynamoDB
    usage_table = dynamodb.Table(USAGE_TABLE)
    judge_table = dynamodb.Table(JUDGE_TABLE)

    try:
        resp = usage_table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("pk").eq(
                f"log#{yesterday}"
            ),
            Limit=DAILY_BATCH_CAP,
        )
        items = resp.get("Items", [])
    except Exception as e:
        logger.error("Failed to read escalation logs: %s", e)
        return {"statusCode": 500, "scored": 0}

    if not items:
        logger.info("No escalation logs found for %s", yesterday)
        return {"statusCode": 200, "scored": 0}

    # Build batch items
    batch_items = []
    for item in items:
        batch_items.append({
            "query": item.get("query", ""),
            "response": item.get("response", ""),
            "context": item.get("context", ""),
            "session_id": item.get("session_id", "unknown"),
        })

    # Score batch
    results = batch_judge(
        items=batch_items,
        bedrock_client=bedrock_runtime,
        model_id=MODEL_ID,
    )

    # Write results to judge table
    scored = 0
    total_cost = Decimal("0")

    with judge_table.batch_writer() as writer:
        for result in results:
            judge_tokens = result.get("_judge_tokens", {})
            cost = (
                Decimal(str(judge_tokens.get("input", 0))) * Decimal("0.00000025")
                + Decimal(str(judge_tokens.get("output", 0))) * Decimal("0.00000125")
            )
            total_cost += cost

            writer.put_item(Item={
                "pk": f"judge#{yesterday}#{result['session_id']}",
                "date": yesterday,
                "session_id": result["session_id"],
                "overall": Decimal(str(result.get("overall", 3.0))),
                "recommendation": result.get("recommendation", "FLAG_FOR_REVIEW"),
                "flags": result.get("flags", []),
                "medical_accuracy": result.get("medical_accuracy", 3),
                "safety_alignment": result.get("safety_alignment", 3),
                "scope_compliance": result.get("scope_compliance", 3),
                "evidence_grounding": result.get("evidence_grounding", 3),
                "communication_clarity": result.get("communication_clarity", 3),
                "cost_usd": cost,
            })
            scored += 1

    # Emit metrics
    try:
        cloudwatch.put_metric_data(
            Namespace="DhanwantariAI",
            MetricData=[
                {
                    "MetricName": "BatchJudgeScored",
                    "Value": scored,
                    "Unit": "Count",
                    "Dimensions": [{"Name": "Service", "Value": "AutoJudgeBatch"}],
                },
                {
                    "MetricName": "BatchJudgeCost",
                    "Value": float(total_cost),
                    "Unit": "None",
                    "Dimensions": [{"Name": "Service", "Value": "AutoJudgeBatch"}],
                },
            ],
        )
    except Exception as e:
        logger.warning("CloudWatch emit failed: %s", e)

    logger.info("Batch scoring complete: %d items, cost $%.4f", scored, total_cost)
    return {"statusCode": 200, "scored": scored, "costUsd": float(total_cost)}
