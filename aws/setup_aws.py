"""
DhanwantariAI — AWS Infrastructure Provisioner
Provisions all AWS-P0, P1, P2 resources for account 034250960622

Run: python3 aws/setup_aws.py --profile VS-User

AWS-P0:  IAM role + policy, DynamoDB table, Lambda function, API Gateway HTTP API
AWS-P1:  Bedrock Guardrails, PII strip already in Lambda
AWS-P2:  CloudWatch alarms, SNS topic for budget/rate alerts
"""

import argparse
import boto3
import hashlib
import io
import json
import os
import time
import zipfile
from pathlib import Path

REGION            = "ap-south-1"
ACCOUNT_ID        = "034250960622"
ROLE_NAME         = "DhanwantariBedrockLambdaRole"
POLICY_NAME       = "DhanwantariBedrockPolicy"
FUNCTION_NAME     = "DhanwantariBedrockProxy"
USAGE_TABLE       = "bedrock_usage"
API_NAME          = "DhanwantariProxyAPI"
STAGE_NAME        = "prod"
GUARDRAIL_NAME    = "DhanwantariGuardrail"
SNS_TOPIC_NAME    = "DhanwantariAlerts"
MODEL_ID          = "anthropic.claude-3-haiku-20240307-v1:0"

LAMBDA_SRC = Path(__file__).parent / "lambda" / "bedrock_proxy" / "index.py"


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def build_lambda_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(LAMBDA_SRC, "index.py")
    return buf.getvalue()


def wait_for(fn, *args, delay=2, retries=15, **kwargs):
    for _ in range(retries):
        result = fn(*args, **kwargs)
        if result:
            return result
        time.sleep(delay)
    raise TimeoutError(f"wait_for timed out: {fn}")


# ---------------------------------------------------------------------------
# AWS-P0.2 — IAM Role + Policy (least privilege)
# ---------------------------------------------------------------------------

def ensure_iam_role(iam) -> str:
    try:
        r = iam.get_role(RoleName=ROLE_NAME)
        print(f"  [IAM] Role exists: {r['Role']['Arn']}")
        return r["Role"]["Arn"]
    except iam.exceptions.NoSuchEntityException:
        pass

    trust = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "lambda.amazonaws.com"},
            "Action": "sts:AssumeRole",
        }],
    }
    r = iam.create_role(
        RoleName=ROLE_NAME,
        AssumeRolePolicyDocument=json.dumps(trust),
        Description="DhanwantariAI Lambda least-privilege Bedrock proxy",
        Tags=[{"Key": "Project", "Value": "DhanwantariAI"}],
    )
    role_arn = r["Role"]["Arn"]
    print(f"  [IAM] Created role: {role_arn}")

    # Attach AWS managed basic execution (CloudWatch Logs)
    iam.attach_role_policy(
        RoleName=ROLE_NAME,
        PolicyArn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    )

    # Inline policy — least privilege: only Claude Haiku + DynamoDB + CloudWatch
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "BedrockHaikuOnly",
                "Effect": "Allow",
                "Action": ["bedrock:InvokeModel"],
                "Resource": [
                    f"arn:aws:bedrock:{REGION}::foundation-model/{MODEL_ID}",
                ],
            },
            {
                "Sid": "DynamoDBUsageTable",
                "Effect": "Allow",
                "Action": [
                    "dynamodb:GetItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:PutItem",
                ],
                "Resource": [
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:table/{USAGE_TABLE}",
                ],
            },
            {
                "Sid": "CloudWatchMetrics",
                "Effect": "Allow",
                "Action": ["cloudwatch:PutMetricData"],
                "Resource": "*",
            },
        ],
    }
    iam.put_role_policy(
        RoleName=ROLE_NAME,
        PolicyName=POLICY_NAME,
        PolicyDocument=json.dumps(policy),
    )
    print(f"  [IAM] Inline policy attached: {POLICY_NAME}")
    time.sleep(10)  # IAM propagation
    return role_arn


# ---------------------------------------------------------------------------
# AWS-P1.1 — DynamoDB bedrock_usage table
# ---------------------------------------------------------------------------

def ensure_dynamodb(ddb_client) -> str:
    try:
        r = ddb_client.describe_table(TableName=USAGE_TABLE)
        print(f"  [DynamoDB] Table exists: {r['Table']['TableArn']}")
        return r["Table"]["TableArn"]
    except ddb_client.exceptions.ResourceNotFoundException:
        pass

    r = ddb_client.create_table(
        TableName=USAGE_TABLE,
        KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
        Tags=[{"Key": "Project", "Value": "DhanwantariAI"}],
    )
    arn = r["TableDescription"]["TableArn"]
    # Enable TTL so old counters auto-expire after 90 days
    waiter = ddb_client.get_waiter("table_exists")
    waiter.wait(TableName=USAGE_TABLE)
    ddb_client.update_time_to_live(
        TableName=USAGE_TABLE,
        TimeToLiveSpecification={"Enabled": True, "AttributeName": "ttl"},
    )
    print(f"  [DynamoDB] Created table: {arn}")
    return arn


# ---------------------------------------------------------------------------
# AWS-P0.1 — Lambda function
# ---------------------------------------------------------------------------

def ensure_lambda(lam, role_arn: str) -> str:
    zip_bytes = build_lambda_zip()
    env = {"Variables": {"USAGE_TABLE": USAGE_TABLE}}

    try:
        fn = lam.get_function(FunctionName=FUNCTION_NAME)
        current_arn = fn["Configuration"]["FunctionArn"]
        # Wait until function is not in an update state
        waiter = lam.get_waiter("function_updated")
        waiter.wait(FunctionName=FUNCTION_NAME)
        # Update code
        lam.update_function_code(
            FunctionName=FUNCTION_NAME,
            ZipFile=zip_bytes,
        )
        waiter.wait(FunctionName=FUNCTION_NAME)
        lam.update_function_configuration(
            FunctionName=FUNCTION_NAME,
            Environment=env,
            Timeout=29,
            MemorySize=256,
        )
        print(f"  [Lambda] Updated: {current_arn}")
        return current_arn
    except lam.exceptions.ResourceNotFoundException:
        pass

    r = lam.create_function(
        FunctionName=FUNCTION_NAME,
        Runtime="python3.12",
        Role=role_arn,
        Handler="index.handler",
        Code={"ZipFile": zip_bytes},
        Description="DhanwantariAI Bedrock proxy — Claude 3 Haiku",
        Timeout=29,
        MemorySize=256,
        Environment=env,
        Tags={"Project": "DhanwantariAI"},
    )
    fn_arn = r["FunctionArn"]

    # Wait for Active state
    waiter = lam.get_waiter("function_active")
    waiter.wait(FunctionName=FUNCTION_NAME)
    print(f"  [Lambda] Created: {fn_arn}")
    return fn_arn


# ---------------------------------------------------------------------------
# AWS-P0.3 — API Gateway HTTP API
# ---------------------------------------------------------------------------

def ensure_api_gateway(apigw, lam, fn_arn: str) -> str:
    apis = apigw.get_apis()
    existing = [a for a in apis["Items"] if a.get("Name") == API_NAME]
    if existing:
        api_url = existing[0]["ApiEndpoint"] + f"/{STAGE_NAME}"
        print(f"  [APIGW] Exists: {api_url}")
        return api_url

    # Create HTTP API
    api = apigw.create_api(
        Name=API_NAME,
        ProtocolType="HTTP",
        Description="DhanwantariAI Bedrock proxy endpoint",
        Tags={"Project": "DhanwantariAI"},
    )
    api_id = api["ApiId"]

    # Create Lambda integration
    integ = apigw.create_integration(
        ApiId=api_id,
        IntegrationType="AWS_PROXY",
        IntegrationUri=fn_arn,
        PayloadFormatVersion="2.0",
        TimeoutInMillis=29000,
    )
    integ_id = integ["IntegrationId"]

    # POST /escalate route
    apigw.create_route(
        ApiId=api_id,
        RouteKey="POST /escalate",
        Target=f"integrations/{integ_id}",
    )

    # Deploy stage
    apigw.create_stage(
        ApiId=api_id,
        StageName=STAGE_NAME,
        AutoDeploy=True,
        DefaultRouteSettings={
            "ThrottlingBurstLimit": 100,
            "ThrottlingRateLimit": 50,
        },
        Tags={"Project": "DhanwantariAI"},
    )

    # Grant API Gateway permission to invoke Lambda
    src_arn = f"arn:aws:execute-api:{REGION}:{ACCOUNT_ID}:{api_id}/*/*/escalate"
    try:
        lam.add_permission(
            FunctionName=FUNCTION_NAME,
            StatementId="AllowAPIGatewayInvoke",
            Action="lambda:InvokeFunction",
            Principal="apigateway.amazonaws.com",
            SourceArn=src_arn,
        )
    except lam.exceptions.ResourceConflictException:
        pass  # already exists

    api_url = f"https://{api_id}.execute-api.{REGION}.amazonaws.com/{STAGE_NAME}"
    print(f"  [APIGW] Created: {api_url}")
    return api_url


# ---------------------------------------------------------------------------
# AWS-P1.3 — Bedrock Guardrails
# ---------------------------------------------------------------------------

def ensure_guardrail(bedrock) -> str:
    existing = bedrock.list_guardrails()
    for g in existing.get("guardrails", []):
        if g.get("name") == GUARDRAIL_NAME:
            print(f"  [Guardrails] Exists: {g['guardrailId']}")
            return g["guardrailId"]

    r = bedrock.create_guardrail(
        name=GUARDRAIL_NAME,
        description="DhanwantariAI safety guardrail — ASHA clinical scope",
        topicPolicyConfig={
            "topicsConfig": [
                {
                    "name": "OffTopicMedical",
                    "definition": (
                        "Medical conditions, treatments, or advice outside "
                        "ASHA scope (e.g. complex surgical, psychiatric, "
                        "rare disease management)"
                    ),
                    "examples": [
                        "How do I treat schizophrenia at home?",
                        "Can you prescribe me chemotherapy?",
                    ],
                    "type": "DENY",
                },
            ]
        },
        wordPolicyConfig={
            "wordsConfig": [
                {"text": "I diagnose"},
                {"text": "I prescribe"},
                {"text": "you have cancer"},
                {"text": "you have diabetes"},
                {"text": "you have tuberculosis"},
            ],
            "managedWordListsConfig": [
                {"type": "PROFANITY"},
            ],
        },
        sensitiveInformationPolicyConfig={
            "piiEntitiesConfig": [
                # Note: Bedrock PII types are US-centric; Aadhaar is stripped
                # by Lambda regex before reaching the model.
                {"type": "PHONE",   "action": "ANONYMIZE"},
                {"type": "NAME",    "action": "ANONYMIZE"},
                {"type": "ADDRESS", "action": "ANONYMIZE"},
                {"type": "EMAIL",   "action": "ANONYMIZE"},
                {"type": "PIN",     "action": "ANONYMIZE"},
            ],
        },
        blockedInputMessaging=(
            "This query is outside the scope of DhanwantariAI. "
            "Please consult a qualified doctor."
        ),
        blockedOutputsMessaging=(
            "I cannot provide this information. "
            "Please refer the patient to a PHC/CHC doctor."
        ),
        tags=[{"key": "Project", "value": "DhanwantariAI"}],
    )
    guardrail_id = r["guardrailId"]
    bedrock.create_guardrail_version(guardrailIdentifier=guardrail_id)
    print(f"  [Guardrails] Created: {guardrail_id}")
    return guardrail_id


# ---------------------------------------------------------------------------
# AWS-P2 — CloudWatch Alarms + SNS
# ---------------------------------------------------------------------------

def ensure_cloudwatch_alarms(cw, sns_client) -> None:
    # Create SNS topic
    topic = sns_client.create_topic(Name=SNS_TOPIC_NAME)
    topic_arn = topic["TopicArn"]
    print(f"  [SNS] Topic: {topic_arn}")

    alarms = [
        {
            "AlarmName": "DhanwantariAI-HighEscalationRate",
            "AlarmDescription": "Escalation rate > 40% of daily cap",
            "MetricName": "EscalationRate",
            "Threshold": 4000,
            "ComparisonOperator": "GreaterThanThreshold",
            "EvaluationPeriods": 1,
            "Period": 86400,   # 1 day
            "Statistic": "Sum",
            "TreatMissingData": "notBreaching",
        },
        {
            "AlarmName": "DhanwantariAI-BedrockCostSpike",
            "AlarmDescription": "Weekly Bedrock cost > $3 (80% of weekly ~$3.75 from $15/mo budget)",
            "MetricName": "BedrockCost",
            "Threshold": 3.0,
            "ComparisonOperator": "GreaterThanThreshold",
            "EvaluationPeriods": 1,
            "Period": 604800,  # 7 days (max allowed for high-resolution alarms)
            "Statistic": "Sum",
            "TreatMissingData": "notBreaching",
        },
        {
            "AlarmName": "DhanwantariAI-BedrockErrors",
            "AlarmDescription": "Lambda Bedrock invocation errors",
            "MetricName": "BedrockInvokeError",
            "Threshold": 10,
            "ComparisonOperator": "GreaterThanThreshold",
            "EvaluationPeriods": 1,
            "Period": 3600,  # 1 hour
            "Statistic": "Sum",
            "TreatMissingData": "notBreaching",
        },
    ]

    for alarm in alarms:
        try:
            cw.put_metric_alarm(
                AlarmName=alarm["AlarmName"],
                AlarmDescription=alarm["AlarmDescription"],
                Namespace="DhanwantariAI",
                MetricName=alarm["MetricName"],
                Dimensions=[{"Name": "Service", "Value": "BedrockProxy"}],
                Period=alarm["Period"],
                EvaluationPeriods=alarm["EvaluationPeriods"],
                Threshold=alarm["Threshold"],
                ComparisonOperator=alarm["ComparisonOperator"],
                Statistic=alarm["Statistic"],
                AlarmActions=[topic_arn],
                TreatMissingData=alarm["TreatMissingData"],
            )
            print(f"  [CloudWatch] Alarm: {alarm['AlarmName']}")
        except Exception as e:
            print(f"  [CloudWatch] Alarm error ({alarm['AlarmName']}): {e}")


# ---------------------------------------------------------------------------
# Save outputs
# ---------------------------------------------------------------------------

def save_outputs(outputs: dict) -> None:
    out_path = Path(__file__).parent / "aws_outputs.json"
    with open(out_path, "w") as f:
        json.dump(outputs, f, indent=2)
    print(f"\n  [Outputs] Saved to {out_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="DhanwantariAI AWS Provisioner")
    parser.add_argument("--profile", default="VS-User")
    parser.add_argument("--skip-guardrails", action="store_true",
                        help="Skip Bedrock Guardrails (needs model access approval)")
    parser.add_argument("--skip-alarms", action="store_true")
    args = parser.parse_args()

    print(f"\n=== DhanwantariAI AWS Infrastructure Provisioner ===")
    print(f"Profile: {args.profile}  |  Region: {REGION}")
    print(f"Account: {ACCOUNT_ID}\n")

    session = boto3.Session(profile_name=args.profile, region_name=REGION)
    iam       = session.client("iam")
    ddb       = session.client("dynamodb")
    lam       = session.client("lambda")
    apigw     = session.client("apigatewayv2")
    bedrock   = session.client("bedrock")
    cw        = session.client("cloudwatch")
    sns       = session.client("sns")

    outputs = {}

    print("--- AWS-P0.2  IAM Role ---")
    outputs["role_arn"] = ensure_iam_role(iam)

    print("\n--- AWS-P1.1  DynamoDB bedrock_usage ---")
    outputs["usage_table_arn"] = ensure_dynamodb(ddb)

    print("\n--- AWS-P0.1  Lambda Function ---")
    outputs["lambda_arn"] = ensure_lambda(lam, outputs["role_arn"])

    print("\n--- AWS-P0.3  API Gateway HTTP API ---")
    outputs["api_url"] = ensure_api_gateway(apigw, lam, outputs["lambda_arn"])

    if not args.skip_guardrails:
        print("\n--- AWS-P1.3  Bedrock Guardrails ---")
        try:
            outputs["guardrail_id"] = ensure_guardrail(bedrock)
        except Exception as e:
            print(f"  [Guardrails] Skipped: {e}")
            outputs["guardrail_id"] = None

    if not args.skip_alarms:
        print("\n--- AWS-P2  CloudWatch Alarms + SNS ---")
        ensure_cloudwatch_alarms(cw, sns)

    save_outputs(outputs)

    print("\n=== Provisioning Complete ===")
    print(f"  Endpoint:  {outputs.get('api_url')}/escalate")
    print(f"  Lambda:    {outputs.get('lambda_arn')}")
    print(f"  IAM Role:  {outputs.get('role_arn')}")


if __name__ == "__main__":
    main()
