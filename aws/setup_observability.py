"""
DhanwantariAI — Observability & Monitoring Setup
aws/setup_observability.py

Creates CloudWatch dashboard, metric alarms, and SNS alert routing.
Per DhanwantariAI_Agent_Services_Spec.md §9.

Usage:
  python3 aws/setup_observability.py --profile VS-User --dry-run
  python3 aws/setup_observability.py --profile VS-User
"""

import argparse
import json
import sys

import boto3

REGION = "ap-south-1"
NAMESPACE = "DhanwantariAgents"
SNS_TOPIC = "DhanwantariAlerts"
DASHBOARD_NAME = "DhanwantariAI-AgentServices"

# ── Metric Definitions (from spec §9.1) ──────────────────────────────────────

ALARMS = [
    {
        "name": "MediSync-RunDuration-High",
        "metric": "MediSync/RunDuration",
        "stat": "Maximum",
        "threshold": 600,
        "comparison": "GreaterThanThreshold",
        "period": 3600,
        "eval_periods": 1,
        "description": "MediSync run exceeded 10 minutes",
    },
    {
        "name": "MediSync-MedicinesAdded-Spike",
        "metric": "MediSync/MedicinesAdded",
        "stat": "Sum",
        "threshold": 500,
        "comparison": "GreaterThanThreshold",
        "period": 86400,
        "eval_periods": 1,
        "description": "Unusual spike: >500 medicines added in one run",
    },
    {
        "name": "MediSync-PriceFlags",
        "metric": "MediSync/PriceFlagsGenerated",
        "stat": "Sum",
        "threshold": 0,
        "comparison": "GreaterThanThreshold",
        "period": 86400,
        "eval_periods": 1,
        "description": "Price flags generated — manual review required",
    },
    {
        "name": "MediSync-SourceFetchErrors",
        "metric": "MediSync/SourceFetchErrors",
        "stat": "Sum",
        "threshold": 2,
        "comparison": "GreaterThanThreshold",
        "period": 3600,
        "eval_periods": 1,
        "description": "Multiple source fetch errors in MediSync run",
    },
    {
        "name": "DiseaseIntel-RunDuration-High",
        "metric": "DiseaseIntel/RunDuration",
        "stat": "Maximum",
        "threshold": 3600,
        "comparison": "GreaterThanThreshold",
        "period": 7200,
        "eval_periods": 1,
        "description": "DiseaseIntel run exceeded 1 hour",
    },
    {
        "name": "KBPatch-SizeExceeded",
        "metric": "KBPatch/PatchSizeKB",
        "stat": "Maximum",
        "threshold": 500,
        "comparison": "GreaterThanThreshold",
        "period": 86400,
        "eval_periods": 1,
        "description": "KB patch exceeds 500 KB — may impact mobile data usage",
    },
]

# ── CloudWatch Dashboard ─────────────────────────────────────────────────────

DASHBOARD_BODY = {
    "widgets": [
        {
            "type": "text",
            "x": 0, "y": 0, "width": 24, "height": 1,
            "properties": {
                "markdown": "# DhanwantariAI Agent Services Dashboard"
            },
        },
        # MediSync Row
        {
            "type": "metric",
            "x": 0, "y": 1, "width": 8, "height": 6,
            "properties": {
                "title": "MediSync Run Duration",
                "metrics": [
                    [NAMESPACE, "MediSync/RunDuration",
                     {"stat": "Maximum", "period": 86400}]
                ],
                "view": "timeSeries",
                "region": REGION,
                "period": 86400,
            },
        },
        {
            "type": "metric",
            "x": 8, "y": 1, "width": 8, "height": 6,
            "properties": {
                "title": "MediSync Changes",
                "metrics": [
                    [NAMESPACE, "MediSync/MedicinesAdded",
                     {"stat": "Sum", "period": 86400}],
                    [NAMESPACE, "MediSync/MedicinesRemoved",
                     {"stat": "Sum", "period": 86400}],
                    [NAMESPACE, "MediSync/PriceFlagsGenerated",
                     {"stat": "Sum", "period": 86400}],
                ],
                "view": "bar",
                "region": REGION,
            },
        },
        {
            "type": "metric",
            "x": 16, "y": 1, "width": 8, "height": 6,
            "properties": {
                "title": "MediSync Errors",
                "metrics": [
                    [NAMESPACE, "MediSync/SourceFetchErrors",
                     {"stat": "Sum", "period": 86400}],
                ],
                "view": "singleValue",
                "region": REGION,
            },
        },
        # DiseaseIntel Row
        {
            "type": "metric",
            "x": 0, "y": 7, "width": 8, "height": 6,
            "properties": {
                "title": "DiseaseIntel Run Duration",
                "metrics": [
                    [NAMESPACE, "DiseaseIntel/RunDuration",
                     {"stat": "Maximum", "period": 86400}]
                ],
                "view": "timeSeries",
                "region": REGION,
            },
        },
        {
            "type": "metric",
            "x": 8, "y": 7, "width": 8, "height": 6,
            "properties": {
                "title": "DiseaseIntel Updates",
                "metrics": [
                    [NAMESPACE, "DiseaseIntel/ProfilesUpdated",
                     {"stat": "Sum", "period": 86400}],
                    [NAMESPACE, "DiseaseIntel/SymptomMappingsGenerated",
                     {"stat": "Sum", "period": 86400}],
                ],
                "view": "bar",
                "region": REGION,
            },
        },
        {
            "type": "metric",
            "x": 16, "y": 7, "width": 8, "height": 6,
            "properties": {
                "title": "KB Patch Size (KB)",
                "metrics": [
                    [NAMESPACE, "KBPatch/PatchSizeKB",
                     {"stat": "Maximum", "period": 86400}],
                ],
                "view": "timeSeries",
                "region": REGION,
            },
        },
        # Lambda Duration Row
        {
            "type": "metric",
            "x": 0, "y": 13, "width": 24, "height": 6,
            "properties": {
                "title": "Lambda Durations (p99)",
                "metrics": [
                    ["AWS/Lambda", "Duration", "FunctionName",
                     f"dhanwantari-medisync-{fn}", {"stat": "p99"}]
                    for fn in ["web-fetcher", "pdf-parser", "normaliser",
                               "diff-engine", "storage-writer"]
                ] + [
                    ["AWS/Lambda", "Duration", "FunctionName",
                     f"dhanwantari-diseaseintel-{fn}", {"stat": "p99"}]
                    for fn in ["source-researcher", "bmi-extractor",
                               "symptom-extractor", "profile-builder",
                               "storage-writer"]
                ],
                "view": "timeSeries",
                "region": REGION,
            },
        },
    ],
}


# ── Setup Functions ──────────────────────────────────────────────────────────

def get_or_create_sns_topic(sns) -> str:
    """Get or create the DhanwantariAlerts SNS topic."""
    topics = sns.list_topics()["Topics"]
    for t in topics:
        if t["TopicArn"].endswith(f":{SNS_TOPIC}"):
            return t["TopicArn"]
    resp = sns.create_topic(Name=SNS_TOPIC)
    return resp["TopicArn"]


def create_alarms(cw, sns_arn: str, dry_run: bool):
    """Create CloudWatch metric alarms."""
    for alarm in ALARMS:
        print(f"  Alarm: {alarm['name']}")
        if dry_run:
            print(f"    [DRY RUN] Would create alarm: {alarm['name']}")
            print(f"    Metric: {alarm['metric']} {alarm['comparison']} {alarm['threshold']}")
            continue

        cw.put_metric_alarm(
            AlarmName=f"DhanwantariAI-{alarm['name']}",
            Namespace=NAMESPACE,
            MetricName=alarm["metric"],
            Statistic=alarm["stat"],
            Period=alarm["period"],
            EvaluationPeriods=alarm["eval_periods"],
            Threshold=alarm["threshold"],
            ComparisonOperator=alarm["comparison"],
            AlarmDescription=alarm["description"],
            AlarmActions=[sns_arn],
            TreatMissingData="notBreaching",
        )
        print(f"    Created alarm: {alarm['name']}")


def create_dashboard(cw, dry_run: bool):
    """Create CloudWatch dashboard."""
    print(f"\n  Dashboard: {DASHBOARD_NAME}")
    if dry_run:
        print(f"    [DRY RUN] Would create dashboard with {len(DASHBOARD_BODY['widgets'])} widgets")
        return

    cw.put_dashboard(
        DashboardName=DASHBOARD_NAME,
        DashboardBody=json.dumps(DASHBOARD_BODY),
    )
    print(f"    Created dashboard: {DASHBOARD_NAME}")
    print(f"    URL: https://{REGION}.console.aws.amazon.com/cloudwatch/home"
          f"?region={REGION}#dashboards:name={DASHBOARD_NAME}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="DhanwantariAI — Setup CloudWatch Observability"
    )
    parser.add_argument("--profile", required=True)
    parser.add_argument("--region", default=REGION)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    cw = session.client("cloudwatch")
    sns = session.client("sns")

    print("\nDhanwantariAI Observability Setup")
    print(f"  Region: {args.region}")
    print(f"  Mode:   {'DRY RUN' if args.dry_run else 'LIVE'}")

    # SNS topic
    if args.dry_run:
        sns_arn = f"arn:aws:sns:{args.region}:034250960622:{SNS_TOPIC}"
        print(f"\n  [DRY RUN] SNS topic: {sns_arn}")
    else:
        sns_arn = get_or_create_sns_topic(sns)
        print(f"\n  SNS topic: {sns_arn}")

    # Alarms
    print(f"\n  Creating {len(ALARMS)} metric alarms...")
    create_alarms(cw, sns_arn, args.dry_run)

    # Dashboard
    create_dashboard(cw, args.dry_run)

    print(f"\n  Observability setup complete.")


if __name__ == "__main__":
    main()
