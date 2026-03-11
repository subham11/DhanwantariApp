"""
DhanwantariAI — Agent Services Infrastructure Provisioner
Phase A: Foundation infrastructure for MediSync + DiseaseIntel agents.

Provisions:
  A1: S3 bucket — dhanwantari-kb-ap-south-1 (versioning, lifecycle, no public access)
  A2: DynamoDB tables — medicines, diseases, symptom-mappings, bmi-matrix, agent-runs
  A3: IAM roles — MediSync (Haiku) + DiseaseIntel (Sonnet)
  A4: Secrets Manager — Qdrant API key (already exists, validates)
  A5: Bedrock model access — resource-based policy for agent roles

Run:
  python3 aws/setup_agent_services.py --profile VS-User
  python3 aws/setup_agent_services.py --profile VS-User --dry-run   # preview only

Requires existing outputs from setup_aws.py (aws_outputs.json).
Per DhanwantariAI_Agent_Services_Spec.md §4–§5.
"""

import argparse
import json
import time
from pathlib import Path

REGION     = "ap-south-1"
ACCOUNT_ID = "034250960622"

# ── S3 ────────────────────────────────────────────────────────────────────────

KB_BUCKET = "dhanwantari-kb-ap-south-1"

# ── DynamoDB tables (§5.1) ────────────────────────────────────────────────────

DYNAMO_TABLES = {
    "dhanwantari-medicines": {
        "keys": [
            {"name": "drug_code", "type": "S", "key_type": "HASH"},
            {"name": "source",    "type": "S", "key_type": "RANGE"},
        ],
        "gsis": [
            {
                "IndexName": "therapeutic_class-index",
                "KeySchema": [{"AttributeName": "therapeutic_class", "KeyType": "HASH"}],
                "extra_attrs": [{"AttributeName": "therapeutic_class", "AttributeType": "S"}],
            },
            {
                "IndexName": "icd10_disease-index",
                "KeySchema": [{"AttributeName": "icd10_code", "KeyType": "HASH"}],
                "extra_attrs": [{"AttributeName": "icd10_code", "AttributeType": "S"}],
            },
        ],
        "pitr": True,
    },
    "dhanwantari-diseases": {
        "keys": [
            {"name": "disease_id", "type": "S", "key_type": "HASH"},
            {"name": "version",    "type": "S", "key_type": "RANGE"},
        ],
        "gsis": [
            {
                "IndexName": "icd10_code-index",
                "KeySchema": [{"AttributeName": "icd10_code", "KeyType": "HASH"}],
                "extra_attrs": [{"AttributeName": "icd10_code", "AttributeType": "S"}],
            },
            {
                "IndexName": "disease_category-index",
                "KeySchema": [{"AttributeName": "disease_category", "KeyType": "HASH"}],
                "extra_attrs": [{"AttributeName": "disease_category", "AttributeType": "S"}],
            },
        ],
        "pitr": True,
    },
    "dhanwantari-symptom-mappings": {
        "keys": [
            {"name": "disease_id", "type": "S", "key_type": "HASH"},
            {"name": "symptom_id", "type": "S", "key_type": "RANGE"},
        ],
        "gsis": [
            {
                "IndexName": "symptom_id-index",
                "KeySchema": [{"AttributeName": "symptom_id", "KeyType": "HASH"}],
                "extra_attrs": [],  # symptom_id already in key schema attrs
            },
        ],
        "pitr": True,
    },
    "dhanwantari-bmi-matrix": {
        "keys": [
            {"name": "disease_id",   "type": "S", "key_type": "HASH"},
            {"name": "bmi_category",  "type": "S", "key_type": "RANGE"},
        ],
        "gsis": [],
        "pitr": False,  # reference data, not critical for PITR
    },
    "dhanwantari-agent-runs": {
        "keys": [
            {"name": "agent_name", "type": "S", "key_type": "HASH"},
            {"name": "run_id",     "type": "S", "key_type": "RANGE"},
        ],
        "gsis": [],
        "pitr": False,
        "ttl_attr": "ttl",  # 90-day TTL
    },
}

# ── IAM Roles (§4.1) ─────────────────────────────────────────────────────────

MEDISYNC_HAIKU_MODEL = "anthropic.claude-3-haiku-20240307-v1:0"
DISEASEINTEL_SONNET_MODEL = "anthropic.claude-3-sonnet-20240229-v1:0"

MEDISYNC_ROLE_NAME   = "DhanwantariMediSyncAgentRole"
MEDISYNC_POLICY_NAME = "DhanwantariMediSyncPolicy"

DISEASEINTEL_ROLE_NAME   = "DhanwantariDiseaseIntelAgentRole"
DISEASEINTEL_POLICY_NAME = "DhanwantariDiseaseIntelPolicy"

# Existing Secrets Manager ARN (from setup_aws.py)
QDRANT_SECRET_NAME = "DhanwantariAI/QdrantApiKey"


# ═══════════════════════════════════════════════════════════════════════════
# A1 — S3 Bucket
# ═══════════════════════════════════════════════════════════════════════════

def ensure_s3_bucket(s3, dry_run: bool) -> str:
    """Create S3 bucket with versioning, lifecycle, and no public access."""
    try:
        s3.head_bucket(Bucket=KB_BUCKET)
        print(f"  [S3] Bucket exists: {KB_BUCKET}")
        return KB_BUCKET
    except s3.exceptions.ClientError:
        pass

    if dry_run:
        print(f"  [S3] DRY RUN — would create bucket: {KB_BUCKET}")
        return KB_BUCKET

    s3.create_bucket(
        Bucket=KB_BUCKET,
        CreateBucketConfiguration={"LocationConstraint": REGION},
    )
    print(f"  [S3] Created bucket: {KB_BUCKET}")

    # Block all public access
    s3.put_public_access_block(
        Bucket=KB_BUCKET,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    print(f"  [S3] Public access blocked")

    # Enable versioning
    s3.put_bucket_versioning(
        Bucket=KB_BUCKET,
        VersioningConfiguration={"Status": "Enabled"},
    )
    print(f"  [S3] Versioning enabled")

    # Server-side encryption (AES-256)
    s3.put_bucket_encryption(
        Bucket=KB_BUCKET,
        ServerSideEncryptionConfiguration={
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256",
                },
                "BucketKeyEnabled": True,
            }],
        },
    )
    print(f"  [S3] SSE-S3 encryption enabled")

    # Lifecycle: raw/ → Glacier after 90 days
    s3.put_bucket_lifecycle_configuration(
        Bucket=KB_BUCKET,
        LifecycleConfiguration={
            "Rules": [
                {
                    "ID": "raw-to-glacier-90d",
                    "Filter": {"Prefix": "raw/"},
                    "Status": "Enabled",
                    "Transitions": [{
                        "Days": 90,
                        "StorageClass": "GLACIER",
                    }],
                },
                {
                    "ID": "agent-reports-expire-365d",
                    "Filter": {"Prefix": "agent_reports/"},
                    "Status": "Enabled",
                    "Expiration": {"Days": 365},
                },
            ],
        },
    )
    print(f"  [S3] Lifecycle rules: raw/ → Glacier 90d, agent_reports/ expire 365d")

    # Tagging
    s3.put_bucket_tagging(
        Bucket=KB_BUCKET,
        Tagging={"TagSet": [
            {"Key": "Project", "Value": "DhanwantariAI"},
            {"Key": "Component", "Value": "AgentServices"},
        ]},
    )

    return KB_BUCKET


# ═══════════════════════════════════════════════════════════════════════════
# A2 — DynamoDB Tables
# ═══════════════════════════════════════════════════════════════════════════

def ensure_dynamodb_table(ddb, table_name: str, spec: dict, dry_run: bool) -> str:
    """Create a single DynamoDB table with GSIs, PITR, and optional TTL."""
    try:
        r = ddb.describe_table(TableName=table_name)
        print(f"  [DynamoDB] Table exists: {table_name}")
        return r["Table"]["TableArn"]
    except ddb.exceptions.ResourceNotFoundException:
        pass

    if dry_run:
        print(f"  [DynamoDB] DRY RUN — would create: {table_name}")
        return f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/{table_name}"

    # Build key schema + attribute definitions
    key_schema = [
        {"AttributeName": k["name"], "KeyType": k["key_type"]}
        for k in spec["keys"]
    ]
    attr_defs = [
        {"AttributeName": k["name"], "AttributeType": k["type"]}
        for k in spec["keys"]
    ]

    # Add GSI attributes
    for gsi in spec.get("gsis", []):
        for extra in gsi.get("extra_attrs", []):
            if extra["AttributeName"] not in [a["AttributeName"] for a in attr_defs]:
                attr_defs.append(extra)

    create_params = {
        "TableName": table_name,
        "KeySchema": key_schema,
        "AttributeDefinitions": attr_defs,
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [
            {"Key": "Project", "Value": "DhanwantariAI"},
            {"Key": "Component", "Value": "AgentServices"},
        ],
    }

    # Add GSIs
    if spec.get("gsis"):
        create_params["GlobalSecondaryIndexes"] = [
            {
                "IndexName": gsi["IndexName"],
                "KeySchema": gsi["KeySchema"],
                "Projection": {"ProjectionType": "ALL"},
            }
            for gsi in spec["gsis"]
        ]

    r = ddb.create_table(**create_params)
    arn = r["TableDescription"]["TableArn"]
    print(f"  [DynamoDB] Created: {table_name}")

    # Wait for table to become active
    waiter = ddb.get_waiter("table_exists")
    waiter.wait(TableName=table_name)

    # Enable PITR if specified (retry — table may still be initialising)
    if spec.get("pitr"):
        import time as _time
        for _attempt in range(6):
            try:
                ddb.update_continuous_backups(
                    TableName=table_name,
                    PointInTimeRecoverySpecification={"PointInTimeRecoveryEnabled": True},
                )
                print(f"  [DynamoDB]   PITR enabled: {table_name}")
                break
            except ddb.exceptions.ContinuousBackupsUnavailableException:
                _time.sleep(5)
        else:
            print(f"  [DynamoDB]   PITR: failed after retries for {table_name}")

    # Enable TTL if specified
    if spec.get("ttl_attr"):
        ddb.update_time_to_live(
            TableName=table_name,
            TimeToLiveSpecification={
                "Enabled": True,
                "AttributeName": spec["ttl_attr"],
            },
        )
        print(f"  [DynamoDB]   TTL enabled: {table_name} (attr: {spec['ttl_attr']})")

    return arn


def ensure_all_dynamodb_tables(ddb, dry_run: bool) -> dict[str, str]:
    """Create all Agent Services DynamoDB tables."""
    arns = {}
    for table_name, spec in DYNAMO_TABLES.items():
        arns[table_name] = ensure_dynamodb_table(ddb, table_name, spec, dry_run)
    return arns


# ═══════════════════════════════════════════════════════════════════════════
# A3 — IAM Roles
# ═══════════════════════════════════════════════════════════════════════════

def _lambda_trust_policy() -> str:
    return json.dumps({
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "lambda.amazonaws.com"},
            "Action": "sts:AssumeRole",
        }],
    })


def _medisync_policy() -> dict:
    """Least-privilege policy for MediSync agent Lambdas."""
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "S3KBBucket",
                "Effect": "Allow",
                "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
                "Resource": [
                    f"arn:aws:s3:::{KB_BUCKET}",
                    f"arn:aws:s3:::{KB_BUCKET}/*",
                ],
            },
            {
                "Sid": "DynamoDBMedicinesTable",
                "Effect": "Allow",
                "Action": [
                    "dynamodb:BatchWriteItem",
                    "dynamodb:GetItem",
                    "dynamodb:Query",
                    "dynamodb:PutItem",
                ],
                "Resource": [
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/dhanwantari-medicines",
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/dhanwantari-medicines/index/*",
                ],
            },
            {
                "Sid": "DynamoDBAgentRuns",
                "Effect": "Allow",
                "Action": ["dynamodb:PutItem", "dynamodb:UpdateItem"],
                "Resource": [
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/dhanwantari-agent-runs",
                ],
            },
            {
                "Sid": "BedrockHaiku",
                "Effect": "Allow",
                "Action": ["bedrock:InvokeModel"],
                "Resource": [
                    f"arn:aws:bedrock:{REGION}::foundation-model/{MEDISYNC_HAIKU_MODEL}",
                ],
            },
            {
                "Sid": "SecretsManagerQdrant",
                "Effect": "Allow",
                "Action": ["secretsmanager:GetSecretValue"],
                "Resource": [
                    f"arn:aws:secretsmanager:{REGION}:{ACCOUNT_ID}:secret:{QDRANT_SECRET_NAME}-*",
                ],
            },
            {
                "Sid": "SESAlerts",
                "Effect": "Allow",
                "Action": ["ses:SendEmail", "ses:SendRawEmail"],
                "Resource": ["*"],
                "Condition": {
                    "StringEquals": {
                        "ses:FromAddress": "alerts@appscale.in",
                    },
                },
            },
            {
                "Sid": "CloudWatchMetrics",
                "Effect": "Allow",
                "Action": ["cloudwatch:PutMetricData"],
                "Resource": ["*"],
            },
        ],
    }


def _diseaseintel_policy() -> dict:
    """Least-privilege policy for DiseaseIntel agent Lambdas."""
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "S3KBBucket",
                "Effect": "Allow",
                "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
                "Resource": [
                    f"arn:aws:s3:::{KB_BUCKET}",
                    f"arn:aws:s3:::{KB_BUCKET}/*",
                ],
            },
            {
                "Sid": "DynamoDBDiseaseTables",
                "Effect": "Allow",
                "Action": [
                    "dynamodb:BatchWriteItem",
                    "dynamodb:GetItem",
                    "dynamodb:Query",
                    "dynamodb:PutItem",
                ],
                "Resource": [
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/dhanwantari-diseases",
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/dhanwantari-diseases/index/*",
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/dhanwantari-symptom-mappings",
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/dhanwantari-symptom-mappings/index/*",
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/dhanwantari-bmi-matrix",
                ],
            },
            {
                "Sid": "DynamoDBAgentRuns",
                "Effect": "Allow",
                "Action": ["dynamodb:PutItem", "dynamodb:UpdateItem"],
                "Resource": [
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/dhanwantari-agent-runs",
                ],
            },
            {
                "Sid": "BedrockSonnet",
                "Effect": "Allow",
                "Action": ["bedrock:InvokeModel"],
                "Resource": [
                    f"arn:aws:bedrock:{REGION}::foundation-model/{DISEASEINTEL_SONNET_MODEL}",
                ],
            },
            {
                "Sid": "SESAlerts",
                "Effect": "Allow",
                "Action": ["ses:SendEmail", "ses:SendRawEmail"],
                "Resource": ["*"],
                "Condition": {
                    "StringEquals": {
                        "ses:FromAddress": "alerts@appscale.in",
                    },
                },
            },
            {
                "Sid": "CloudWatchMetrics",
                "Effect": "Allow",
                "Action": ["cloudwatch:PutMetricData"],
                "Resource": ["*"],
            },
        ],
    }


def ensure_agent_role(
    iam,
    role_name: str,
    policy_name: str,
    policy_doc: dict,
    description: str,
    dry_run: bool,
) -> str:
    """Create an IAM role with an inline policy for an agent."""
    try:
        r = iam.get_role(RoleName=role_name)
        arn = r["Role"]["Arn"]
        print(f"  [IAM] Role exists: {arn}")
        # Update inline policy in case it changed
        if not dry_run:
            iam.put_role_policy(
                RoleName=role_name,
                PolicyName=policy_name,
                PolicyDocument=json.dumps(policy_doc),
            )
            print(f"  [IAM]   Policy updated: {policy_name}")
        return arn
    except iam.exceptions.NoSuchEntityException:
        pass

    if dry_run:
        arn = f"arn:aws:iam::{ACCOUNT_ID}:role/{role_name}"
        print(f"  [IAM] DRY RUN — would create role: {arn}")
        return arn

    r = iam.create_role(
        RoleName=role_name,
        AssumeRolePolicyDocument=_lambda_trust_policy(),
        Description=description,
        Tags=[
            {"Key": "Project", "Value": "DhanwantariAI"},
            {"Key": "Component", "Value": "AgentServices"},
        ],
    )
    arn = r["Role"]["Arn"]
    print(f"  [IAM] Created role: {arn}")

    # Managed policy: basic Lambda execution (CloudWatch Logs)
    iam.attach_role_policy(
        RoleName=role_name,
        PolicyArn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    )

    # Inline policy: least privilege
    iam.put_role_policy(
        RoleName=role_name,
        PolicyName=policy_name,
        PolicyDocument=json.dumps(policy_doc),
    )
    print(f"  [IAM]   Inline policy attached: {policy_name}")

    # IAM propagation
    time.sleep(10)
    return arn


# ═══════════════════════════════════════════════════════════════════════════
# A4 — Secrets Manager (validate existing Qdrant key)
# ═══════════════════════════════════════════════════════════════════════════

def validate_secrets_manager(sm, dry_run: bool) -> str:
    """Validate that the Qdrant API key secret exists in Secrets Manager."""
    try:
        r = sm.describe_secret(SecretId=QDRANT_SECRET_NAME)
        arn = r["ARN"]
        print(f"  [Secrets] Qdrant key exists: {arn}")
        return arn
    except sm.exceptions.ResourceNotFoundException:
        if dry_run:
            print(f"  [Secrets] DRY RUN — Qdrant key missing, would need creation")
            return ""
        print(f"  [Secrets] WARNING: {QDRANT_SECRET_NAME} not found!")
        print(f"           Run setup_aws.py first, or create manually:")
        print(f"           aws secretsmanager create-secret \\")
        print(f"             --name {QDRANT_SECRET_NAME} \\")
        print(f"             --secret-string '<your-qdrant-api-key>'")
        return ""


# ═══════════════════════════════════════════════════════════════════════════
# A5 — Bedrock Model Access (verify models are accessible)
# ═══════════════════════════════════════════════════════════════════════════

def verify_bedrock_access(bedrock, dry_run: bool) -> dict[str, bool]:
    """Verify that required Bedrock models are accessible in ap-south-1."""
    models = {
        MEDISYNC_HAIKU_MODEL: "MediSync (Claude 3 Haiku)",
        DISEASEINTEL_SONNET_MODEL: "DiseaseIntel (Claude 3 Sonnet)",
    }
    access = {}

    if dry_run:
        for model_id, label in models.items():
            print(f"  [Bedrock] DRY RUN — would verify: {label}")
            access[model_id] = True
        return access

    for model_id, label in models.items():
        try:
            bedrock.get_foundation_model(modelIdentifier=model_id)
            print(f"  [Bedrock] ✓ {label} available")
            access[model_id] = True
        except Exception as e:
            print(f"  [Bedrock] ✗ {label} NOT available: {e}")
            print(f"           Request access via Bedrock console → Model access")
            access[model_id] = False

    return access


# ═══════════════════════════════════════════════════════════════════════════
# Save outputs
# ═══════════════════════════════════════════════════════════════════════════

def save_outputs(outputs: dict) -> None:
    out_path = Path(__file__).parent / "agent_services_outputs.json"
    with open(out_path, "w") as f:
        json.dump(outputs, f, indent=2)
    print(f"\n  [Outputs] Saved to {out_path}")


# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="DhanwantariAI Agent Services — Phase A Infrastructure"
    )
    parser.add_argument("--profile", default="VS-User",
                        help="AWS CLI profile name")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview actions without creating resources")
    args = parser.parse_args()

    dry_run = args.dry_run
    mode = "DRY RUN" if dry_run else "LIVE"

    print(f"\n{'='*60}")
    print(f"  DhanwantariAI Agent Services — Phase A ({mode})")
    print(f"  Profile: {args.profile}  |  Region: {REGION}")
    print(f"  Account: {ACCOUNT_ID}")
    print(f"{'='*60}\n")

    if not dry_run:
        import boto3
        session = boto3.Session(profile_name=args.profile, region_name=REGION)
        s3      = session.client("s3")
        ddb     = session.client("dynamodb")
        iam     = session.client("iam")
        sm      = session.client("secretsmanager")
        bedrock = session.client("bedrock")
    else:
        # Minimal mock clients for dry run (just need exception classes)
        import boto3
        session = boto3.Session(profile_name=args.profile, region_name=REGION)
        s3      = session.client("s3")
        ddb     = session.client("dynamodb")
        iam     = session.client("iam")
        sm      = session.client("secretsmanager")
        bedrock = session.client("bedrock")

    outputs: dict = {}

    # ── A1: S3 Bucket ─────────────────────────────────────────────────────
    print("--- A1  S3 Bucket ---")
    outputs["kb_bucket"] = ensure_s3_bucket(s3, dry_run)

    # ── A2: DynamoDB Tables ───────────────────────────────────────────────
    print("\n--- A2  DynamoDB Tables ---")
    outputs["dynamodb_tables"] = ensure_all_dynamodb_tables(ddb, dry_run)

    # ── A3: IAM Roles ─────────────────────────────────────────────────────
    print("\n--- A3  IAM Roles ---")
    print("  MediSync Agent Role:")
    outputs["medisync_role_arn"] = ensure_agent_role(
        iam,
        MEDISYNC_ROLE_NAME,
        MEDISYNC_POLICY_NAME,
        _medisync_policy(),
        "DhanwantariAI MediSync Agent - medicine list intelligence (Haiku)",
        dry_run,
    )
    print("  DiseaseIntel Agent Role:")
    outputs["diseaseintel_role_arn"] = ensure_agent_role(
        iam,
        DISEASEINTEL_ROLE_NAME,
        DISEASEINTEL_POLICY_NAME,
        _diseaseintel_policy(),
        "DhanwantariAI DiseaseIntel Agent - disease + BMI intelligence (Sonnet)",
        dry_run,
    )

    # ── A4: Secrets Manager ───────────────────────────────────────────────
    print("\n--- A4  Secrets Manager ---")
    outputs["qdrant_secret_arn"] = validate_secrets_manager(sm, dry_run)

    # ── A5: Bedrock Model Access ──────────────────────────────────────────
    print("\n--- A5  Bedrock Model Access ---")
    outputs["bedrock_access"] = verify_bedrock_access(bedrock, dry_run)

    # ── Save ──────────────────────────────────────────────────────────────
    save_outputs(outputs)

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"  Phase A Complete ({mode})")
    print(f"{'='*60}")
    print(f"  S3 Bucket:          {outputs['kb_bucket']}")
    print(f"  DynamoDB Tables:    {len(outputs.get('dynamodb_tables', {}))}")
    for t in outputs.get("dynamodb_tables", {}):
        print(f"    - {t}")
    print(f"  MediSync Role:      {outputs.get('medisync_role_arn', 'N/A')}")
    print(f"  DiseaseIntel Role:  {outputs.get('diseaseintel_role_arn', 'N/A')}")
    print(f"  Qdrant Secret:      {'OK' if outputs.get('qdrant_secret_arn') else 'MISSING'}")
    bedrock_ok = all(outputs.get("bedrock_access", {}).values())
    print(f"  Bedrock Models:     {'All accessible' if bedrock_ok else 'NEEDS ATTENTION'}")
    print()


if __name__ == "__main__":
    main()
