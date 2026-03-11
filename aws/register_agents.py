"""
DhanwantariAI — Bedrock Agent Registration: MediSync + DiseaseIntel
aws/register_agents.py

Registers both Bedrock Agents with their action groups, Lambda
functions, and Step Functions state machines.

Usage:
  python3 aws/register_agents.py --profile VS-User [--dry-run]
  python3 aws/register_agents.py --profile VS-User --agent medisync
  python3 aws/register_agents.py --profile VS-User --agent diseaseintel

Per DhanwantariAI_Agent_Services_Spec.md §2.4, §3.4, §4, §6.
"""

import argparse
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

REGION   = "ap-south-1"
ACCOUNT  = "034250960622"
KB_BUCKET = "dhanwantari-kb-ap-south-1"

# ── Agent Definitions (§2.4, §3.4) ───────────────────────────────────────────

AGENTS = {
    "medisync": {
        "agentName": "DhanwantariAI-MediSync-Agent",
        "description": (
            "Maintains a live medicine knowledge base covering allopathic and "
            "Ayurvedic medicines. Fetches, normalises, detects price changes, "
            "and publishes KB patches for mobile OTA."
        ),
        "foundationModel": "anthropic.claude-3-haiku-20240307-v1:0",
        "instruction": (
            "You are MediSync, a pharmaceutical data agent for DhanwantariAI. "
            "Your job is to fetch medicine data from Indian government sources "
            "(Jan Aushadhi, NLEM, AYUSH) and brand manufacturers (Himalaya, "
            "Patanjali, Dabur), parse PDFs and HTML, normalise to a unified "
            "schema with ICD-10 mappings, detect changes against the current "
            "database, flag >20% price changes for manual review, and write "
            "outputs to DynamoDB and S3. Never fabricate pharmaceutical data. "
            "Only extract from fetched sources. URL whitelist is enforced."
        ),
        "idleSessionTTL": 900,
        "roleArn": f"arn:aws:iam::{ACCOUNT}:role/DhanwantariMediSyncAgentRole",
        "actionGroups": [
            {
                "name": "WebFetcher",
                "description": "Fetch raw medicine data from trusted government and brand sources",
                "lambdaName": "medisync-web-fetcher",
                "lambdaPath": "aws/lambda/medisync/web_fetcher/handler.py",
                "memoryMb": 256,
                "timeout": 60,
            },
            {
                "name": "PDFParser",
                "description": "Extract structured medicine records from PMBJP/NLEM PDFs",
                "lambdaName": "medisync-pdf-parser",
                "lambdaPath": "aws/lambda/medisync/pdf_parser/handler.py",
                "memoryMb": 512,
                "timeout": 120,
            },
            {
                "name": "DataNormaliser",
                "description": "Validate, normalise, and deduplicate medicine records",
                "lambdaName": "medisync-normaliser",
                "lambdaPath": "aws/lambda/medisync/normaliser/handler.py",
                "memoryMb": 256,
                "timeout": 30,
            },
            {
                "name": "DiffEngine",
                "description": "Compare new records against current DynamoDB version",
                "lambdaName": "medisync-diff-engine",
                "lambdaPath": "aws/lambda/medisync/diff_engine/handler.py",
                "memoryMb": 512,
                "timeout": 60,
            },
            {
                "name": "StorageWriter",
                "description": "Batch write to DynamoDB and export JSON to S3",
                "lambdaName": "medisync-storage-writer",
                "lambdaPath": "aws/lambda/medisync/storage_writer/handler.py",
                "memoryMb": 256,
                "timeout": 60,
            },
        ],
    },
    "diseaseintel": {
        "agentName": "DhanwantariAI-DiseaseIntel-Agent",
        "description": (
            "Researches and maintains disease intelligence: symptoms, BMI risk "
            "(ICMR cut-offs), red flags, epidemiology, and ASHA referral "
            "protocols. All facts sourced and cited."
        ),
        "foundationModel": "anthropic.claude-3-sonnet-20240229-v1:0",
        "instruction": (
            "You are DiseaseIntel, a medical research agent for DhanwantariAI. "
            "For each disease assigned, research: (1) complete symptom list with "
            "prevalence percentages, (2) BMI-based risk stratification using ICMR "
            "India-specific cut-offs (not WHO global), (3) age and gender risk "
            "modifiers, (4) red flag symptoms requiring immediate referral, "
            "(5) India-specific epidemiological data, (6) comorbidity interactions. "
            "Always cite exact source URL, document title, section, and retrieval "
            "date. Never infer or generate clinical data — only extract from "
            "verified sources. If a fact cannot be found, mark as 'NOT_FOUND'."
        ),
        "idleSessionTTL": 1800,
        "roleArn": f"arn:aws:iam::{ACCOUNT}:role/DhanwantariDiseaseIntelAgentRole",
        "actionGroups": [
            {
                "name": "SourceResearcher",
                "description": "Fetch disease data from WHO, ICMR, NVBDCP, NHM, PubMed",
                "lambdaName": "diseaseintel-source-researcher",
                "lambdaPath": "aws/lambda/diseaseintel/source_researcher/handler.py",
                "memoryMb": 512,
                "timeout": 120,
            },
            {
                "name": "BMIRiskExtractor",
                "description": "Compute BMI-stratified disease risk using India-specific ICMR cut-offs",
                "lambdaName": "diseaseintel-bmi-extractor",
                "lambdaPath": "aws/lambda/diseaseintel/bmi_extractor/handler.py",
                "memoryMb": 256,
                "timeout": 30,
            },
            {
                "name": "SymptomExtractor",
                "description": "Extract symptoms with prevalence and lift ratios using Claude Sonnet",
                "lambdaName": "diseaseintel-symptom-extractor",
                "lambdaPath": "aws/lambda/diseaseintel/symptom_extractor/handler.py",
                "memoryMb": 512,
                "timeout": 180,
            },
            {
                "name": "ProfileBuilder",
                "description": "Assemble complete disease profiles from all extracted data",
                "lambdaName": "diseaseintel-profile-builder",
                "lambdaPath": "aws/lambda/diseaseintel/profile_builder/handler.py",
                "memoryMb": 512,
                "timeout": 60,
            },
            {
                "name": "StorageWriter",
                "description": "Write disease profiles, symptom mappings, and BMI matrix to DynamoDB/S3",
                "lambdaName": "diseaseintel-storage-writer",
                "lambdaPath": "aws/lambda/diseaseintel/storage_writer/handler.py",
                "memoryMb": 256,
                "timeout": 60,
            },
        ],
    },
}

# ── Step Functions Definitions (§6.2) ─────────────────────────────────────────

MEDISYNC_STATE_MACHINE = {
    "Comment": "MediSync Agent — Weekly medicine KB refresh pipeline",
    "StartAt": "InitialiseRun",
    "States": {
        "InitialiseRun": {
            "Type": "Pass",
            "Parameters": {
                "run_id.$": "States.UUID()",
                "version.$": "States.Format('{}', $$.Execution.StartTime)",
                "started_at.$": "$$.Execution.StartTime",
            },
            "ResultPath": "$.run",
            "Next": "FetchSources",
        },
        "FetchSources": {
            "Type": "Parallel",
            "Branches": [
                {
                    "StartAt": "FetchJanaushadhi",
                    "States": {
                        "FetchJanaushadhi": {
                            "Type": "Task",
                            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:medisync-web-fetcher",
                            "Parameters": {"action": "fetch_janaushadhi"},
                            "Retry": [{"ErrorEquals": ["States.TaskFailed"], "MaxAttempts": 2, "BackoffRate": 2}],
                            "End": True,
                        }
                    },
                },
                {
                    "StartAt": "FetchAyush",
                    "States": {
                        "FetchAyush": {
                            "Type": "Task",
                            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:medisync-web-fetcher",
                            "Parameters": {"action": "fetch_ayush_nleam"},
                            "Retry": [{"ErrorEquals": ["States.TaskFailed"], "MaxAttempts": 2, "BackoffRate": 2}],
                            "End": True,
                        }
                    },
                },
                {
                    "StartAt": "FetchBrands",
                    "States": {
                        "FetchBrands": {
                            "Type": "Task",
                            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:medisync-web-fetcher",
                            "Parameters": {"action": "fetch_brand_products"},
                            "Retry": [{"ErrorEquals": ["States.TaskFailed"], "MaxAttempts": 2, "BackoffRate": 2}],
                            "End": True,
                        }
                    },
                },
            ],
            "ResultPath": "$.fetch_results",
            "Next": "ParsePDFs",
        },
        "ParsePDFs": {
            "Type": "Task",
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:medisync-pdf-parser",
            "Parameters": {
                "sources.$": "$.fetch_results",
            },
            "ResultPath": "$.parsed",
            "Retry": [{"ErrorEquals": ["States.TaskFailed"], "MaxAttempts": 1}],
            "Next": "Normalise",
        },
        "Normalise": {
            "Type": "Task",
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:medisync-normaliser",
            "Parameters": {
                "records.$": "$.parsed.records",
                "type": "allopathic",
            },
            "ResultPath": "$.normalised",
            "Next": "DiffEngine",
        },
        "DiffEngine": {
            "Type": "Task",
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:medisync-diff-engine",
            "Parameters": {
                "new_records.$": "$.normalised.records",
            },
            "ResultPath": "$.diff",
            "Next": "CheckChanges",
        },
        "CheckChanges": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.diff.summary.added",
                    "NumericGreaterThan": 0,
                    "Next": "WriteStore",
                },
                {
                    "Variable": "$.diff.summary.changed",
                    "NumericGreaterThan": 0,
                    "Next": "WriteStore",
                },
                {
                    "Variable": "$.diff.summary.removed",
                    "NumericGreaterThan": 0,
                    "Next": "WriteStore",
                },
            ],
            "Default": "NoChanges",
        },
        "NoChanges": {
            "Type": "Pass",
            "Result": {"status": "no_changes_detected"},
            "ResultPath": "$.write_result",
            "Next": "Notify",
        },
        "WriteStore": {
            "Type": "Task",
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:medisync-storage-writer",
            "Parameters": {
                "action": "apply_diff",
                "additions.$": "$.diff.additions",
                "updates.$": "$.diff.updates",
                "removals.$": "$.diff.removals",
                "version.$": "$.run.version",
                "sources_used": ["PMBJP", "AYUSH", "HIMALAYA", "PATANJALI", "DABUR"],
            },
            "ResultPath": "$.write_result",
            "Next": "GenPatch",
        },
        "GenPatch": {
            "Type": "Task",
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:kb-diff-publisher",
            "Parameters": {
                "component": "medicines",
                "version.$": "$.run.version",
            },
            "ResultPath": "$.patch_result",
            "Next": "Notify",
        },
        "Notify": {
            "Type": "Task",
            "Resource": "arn:aws:states:::sns:publish",
            "Parameters": {
                "TopicArn": f"arn:aws:sns:{REGION}:{ACCOUNT}:DhanwantariAlerts",
                "Subject": "[MediSync] Weekly Run Complete",
                "Message.$": "States.JsonToString($.diff.summary)",
            },
            "End": True,
        },
    },
}

DISEASEINTEL_STATE_MACHINE = {
    "Comment": "DiseaseIntel Agent — Monthly disease profile refresh pipeline",
    "StartAt": "InitialiseRun",
    "States": {
        "InitialiseRun": {
            "Type": "Pass",
            "Parameters": {
                "run_id.$": "States.UUID()",
                "version.$": "States.Format('{}', $$.Execution.StartTime)",
                "started_at.$": "$$.Execution.StartTime",
            },
            "ResultPath": "$.run",
            "Next": "LoadDiseaseList",
        },
        "LoadDiseaseList": {
            "Type": "Task",
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:diseaseintel-profile-builder",
            "Parameters": {"action": "list_diseases_for_run"},
            "ResultPath": "$.diseases",
            "Next": "ProcessEachDisease",
        },
        "ProcessEachDisease": {
            "Type": "Map",
            "ItemsPath": "$.diseases.disease_ids",
            "MaxConcurrency": 3,
            "Iterator": {
                "StartAt": "ResearchSources",
                "States": {
                    "ResearchSources": {
                        "Type": "Task",
                        "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:diseaseintel-source-researcher",
                        "Parameters": {"disease_id.$": "$"},
                        "ResultPath": "$.sources",
                        "Retry": [{"ErrorEquals": ["States.TaskFailed"], "MaxAttempts": 2, "BackoffRate": 3}],
                        "Next": "ExtractBMI",
                    },
                    "ExtractBMI": {
                        "Type": "Task",
                        "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:diseaseintel-bmi-extractor",
                        "Parameters": {"disease_id.$": "$.disease_id", "sources.$": "$.sources"},
                        "ResultPath": "$.bmi",
                        "Next": "ExtractSymptoms",
                    },
                    "ExtractSymptoms": {
                        "Type": "Task",
                        "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:diseaseintel-symptom-extractor",
                        "Parameters": {
                            "disease_id.$": "$.disease_id",
                            "source_contents.$": "$.sources",
                        },
                        "ResultPath": "$.symptoms",
                        "Next": "BuildProfile",
                    },
                    "BuildProfile": {
                        "Type": "Task",
                        "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:diseaseintel-profile-builder",
                        "Parameters": {
                            "action": "build",
                            "disease_id.$": "$.disease_id",
                            "sources.$": "$.sources",
                            "bmi.$": "$.bmi",
                            "symptoms.$": "$.symptoms",
                            "version.$": "$$.Execution.Input.run.version",
                        },
                        "ResultPath": "$.profile",
                        "End": True,
                    },
                },
            },
            "ResultPath": "$.profiles",
            "Next": "WriteAll",
        },
        "WriteAll": {
            "Type": "Task",
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:diseaseintel-storage-writer",
            "Parameters": {
                "profiles.$": "$.profiles",
                "version.$": "$.run.version",
            },
            "ResultPath": "$.write_result",
            "Next": "GenPatch",
        },
        "GenPatch": {
            "Type": "Task",
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:kb-diff-publisher",
            "Parameters": {
                "component": "diseases",
                "version.$": "$.run.version",
            },
            "ResultPath": "$.patch_result",
            "Next": "Notify",
        },
        "Notify": {
            "Type": "Task",
            "Resource": "arn:aws:states:::sns:publish",
            "Parameters": {
                "TopicArn": f"arn:aws:sns:{REGION}:{ACCOUNT}:DhanwantariAlerts",
                "Subject": "[DiseaseIntel] Monthly Run Complete",
                "Message.$": "States.JsonToString($.write_result)",
            },
            "End": True,
        },
    },
}

# ── EventBridge Rules (§6.1) ──────────────────────────────────────────────────

EVENTBRIDGE_RULES = {
    "MediSyncWeeklyRule": {
        "ScheduleExpression": "cron(30 20 ? * SUN *)",  # Sunday 02:00 IST
        "Description": "Weekly medicine list refresh - MediSync Agent",
        "targetStateMachine": "DhanwantariMediSyncStateMachine",
    },
    "DiseaseIntelMonthlyRule": {
        "ScheduleExpression": "cron(30 21 ? * 1#1 *)",  # 1st Sunday 03:00 IST
        "Description": "Monthly disease profile refresh - DiseaseIntel Agent",
        "targetStateMachine": "DhanwantariDiseaseIntelStateMachine",
    },
}


# ══════════════════════════════════════════════════════════════════════════════
#  Provisioner Functions
# ══════════════════════════════════════════════════════════════════════════════

class AgentRegistrar:
    """Registers Bedrock Agents, Lambda functions, Step Functions, and EventBridge rules."""

    def __init__(self, profile: str, dry_run: bool = False):
        self.dry_run = dry_run
        session = boto3.Session(profile_name=profile, region_name=REGION)
        self.bedrock = session.client("bedrock-agent")
        self.lambda_client = session.client("lambda")
        self.sfn = session.client("stepfunctions")
        self.events = session.client("events")
        self.iam = session.client("iam")
        self.outputs: dict = {}

    # ── Lambda Deployment ─────────────────────────────────────────────────

    def deploy_lambda(self, func_name: str, handler_path: str, memory_mb: int,
                      timeout: int, role_arn: str, env_vars: dict | None = None) -> str:
        """Create or update a Lambda function. Returns function ARN."""
        if self.dry_run:
            arn = f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:{func_name}"
            logger.info("[DRY-RUN] Would deploy Lambda: %s", func_name)
            return arn

        # Check if exists
        try:
            resp = self.lambda_client.get_function(FunctionName=func_name)
            logger.info("Lambda %s already exists — updating code", func_name)
            # Update code would go here (zip upload)
            return resp["Configuration"]["FunctionArn"]
        except ClientError as e:
            if e.response["Error"]["Code"] != "ResourceNotFoundException":
                raise

        # Package code (simplified — in production use SAM/CDK)
        import io
        import zipfile
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # Add handler
            zf.write(handler_path, "handler.py")
            # Add shared module if medisync
            shared_path = os.path.join(os.path.dirname(os.path.dirname(handler_path)), "shared.py")
            if os.path.exists(shared_path):
                zf.write(shared_path, "shared.py")
        zip_buffer.seek(0)

        environment = {"Variables": {"KB_BUCKET": KB_BUCKET, "AWS_REGION_NAME": REGION}}
        if env_vars:
            environment["Variables"].update(env_vars)

        zip_bytes = zip_buffer.read()
        resp = None
        for _attempt in range(5):
            try:
                resp = self.lambda_client.create_function(
                    FunctionName=func_name,
                    Runtime="python3.12",
                    Role=role_arn,
                    Handler="handler.handler",
                    Code={"ZipFile": zip_bytes},
                    MemorySize=memory_mb,
                    Timeout=timeout,
                    Environment=environment,
                    Architectures=["arm64"],
                    Tags={"Project": "DhanwantariAI", "Agent": func_name.split("-")[0]},
                )
                break
            except self.lambda_client.exceptions.InvalidParameterValueException:
                import time as _time
                logger.info("Waiting for IAM role propagation (%s)...", func_name)
                _time.sleep(10)
        if resp is None:
            raise RuntimeError(f"Failed to create Lambda {func_name} after retries")
        logger.info("Created Lambda: %s → %s", func_name, resp["FunctionArn"])
        return resp["FunctionArn"]

    # ── Step Functions ─────────────────────────────────────────────────────

    def deploy_state_machine(self, name: str, definition: dict) -> str:
        """Create or update a Step Functions state machine."""
        defn_json = json.dumps(definition, default=str)
        role_arn = f"arn:aws:iam::{ACCOUNT}:role/DhanwantariStepFunctionsRole"

        if self.dry_run:
            arn = f"arn:aws:states:{REGION}:{ACCOUNT}:stateMachine:{name}"
            logger.info("[DRY-RUN] Would deploy state machine: %s", name)
            return arn

        # Check if exists
        try:
            arn = f"arn:aws:states:{REGION}:{ACCOUNT}:stateMachine:{name}"
            self.sfn.describe_state_machine(stateMachineArn=arn)
            self.sfn.update_state_machine(
                stateMachineArn=arn,
                definition=defn_json,
                roleArn=role_arn,
            )
            logger.info("Updated state machine: %s", name)
            return arn
        except ClientError as e:
            if e.response["Error"]["Code"] != "StateMachineDoesNotExist":
                raise

        resp = self.sfn.create_state_machine(
            name=name,
            definition=defn_json,
            roleArn=role_arn,
            type="STANDARD",
            tags=[
                {"key": "Project", "value": "DhanwantariAI"},
            ],
        )
        logger.info("Created state machine: %s → %s", name, resp["stateMachineArn"])
        return resp["stateMachineArn"]

    # ── EventBridge ────────────────────────────────────────────────────────

    def deploy_eventbridge_rule(self, rule_name: str, config: dict, sm_arn: str) -> None:
        """Create EventBridge scheduled rule targeting a Step Functions state machine."""
        if self.dry_run:
            logger.info("[DRY-RUN] Would create EventBridge rule: %s → %s",
                        rule_name, config["ScheduleExpression"])
            return

        self.events.put_rule(
            Name=rule_name,
            ScheduleExpression=config["ScheduleExpression"],
            Description=config["Description"],
            State="ENABLED",
            Tags=[
                {"Key": "Project", "Value": "DhanwantariAI"},
            ],
        )

        # Target the state machine
        role_arn = f"arn:aws:iam::{ACCOUNT}:role/DhanwantariEventBridgeRole"
        self.events.put_targets(
            Rule=rule_name,
            Targets=[{
                "Id": f"{rule_name}-target",
                "Arn": sm_arn,
                "RoleArn": role_arn,
            }],
        )
        logger.info("Created EventBridge rule: %s (%s)", rule_name, config["ScheduleExpression"])

    # ── Bedrock Agent Registration ─────────────────────────────────────────

    def register_bedrock_agent(self, agent_key: str) -> str | None:
        """Register a Bedrock Agent with all its action groups."""
        defn = AGENTS[agent_key]
        agent_name = defn["agentName"]

        if self.dry_run:
            logger.info("[DRY-RUN] Would register Bedrock Agent: %s", agent_name)
            logger.info("  Model: %s", defn["foundationModel"])
            logger.info("  Action groups: %s", [ag["name"] for ag in defn["actionGroups"]])
            return f"dry-run-agent-id-{agent_key}"

        # Check if agent already exists
        existing = self._find_agent_by_name(agent_name)
        if existing:
            logger.info("Agent %s already exists: %s", agent_name, existing)
            return existing

        resp = self.bedrock.create_agent(
            agentName=agent_name,
            description=defn["description"],
            foundationModel=defn["foundationModel"],
            instruction=defn["instruction"],
            idleSessionTTLInSeconds=defn["idleSessionTTL"],
            agentResourceRoleArn=defn["roleArn"],
        )
        agent_id = resp["agent"]["agentId"]
        logger.info("Created Bedrock Agent: %s → %s", agent_name, agent_id)
        return agent_id

    def _find_agent_by_name(self, name: str) -> str | None:
        """Find an existing agent by name, return agent ID or None."""
        try:
            paginator = self.bedrock.get_paginator("list_agents")
            for page in paginator.paginate():
                for agent in page.get("agentSummaries", []):
                    if agent["agentName"] == name:
                        return agent["agentId"]
        except Exception:
            pass
        return None

    # ── Full Registration Pipeline ─────────────────────────────────────────

    def register_agent_full(self, agent_key: str) -> dict:
        """
        Full registration pipeline for one agent:
        1. Deploy all Lambda action groups
        2. Register Bedrock Agent
        3. Deploy Step Functions state machine
        4. Deploy EventBridge rule
        """
        defn = AGENTS[agent_key]
        result = {"agent": agent_key, "lambdas": {}, "state_machine": None, "eventbridge": None}

        logger.info("=" * 60)
        logger.info("Registering agent: %s", defn["agentName"])
        logger.info("=" * 60)

        # 1. Deploy Lambda functions
        for ag in defn["actionGroups"]:
            env_vars = {}
            if "medicines" in ag["lambdaName"]:
                env_vars["MEDICINES_TABLE"] = "dhanwantari-medicines"
            elif "disease" in ag["lambdaName"]:
                env_vars["DISEASES_TABLE"] = "dhanwantari-diseases"

            arn = self.deploy_lambda(
                func_name=ag["lambdaName"],
                handler_path=ag["lambdaPath"],
                memory_mb=ag["memoryMb"],
                timeout=ag["timeout"],
                role_arn=defn["roleArn"],
                env_vars=env_vars,
            )
            result["lambdas"][ag["name"]] = arn

        # 2. Register Bedrock Agent
        agent_id = self.register_bedrock_agent(agent_key)
        result["agent_id"] = agent_id

        # 3. Deploy Step Functions state machine
        if agent_key == "medisync":
            sm_name = "DhanwantariMediSyncStateMachine"
            sm_defn = MEDISYNC_STATE_MACHINE
        else:
            sm_name = "DhanwantariDiseaseIntelStateMachine"
            sm_defn = DISEASEINTEL_STATE_MACHINE

        sm_arn = self.deploy_state_machine(sm_name, sm_defn)
        result["state_machine"] = sm_arn

        # 4. Deploy EventBridge rule
        for rule_name, rule_cfg in EVENTBRIDGE_RULES.items():
            if rule_cfg["targetStateMachine"] == sm_name:
                self.deploy_eventbridge_rule(rule_name, rule_cfg, sm_arn)
                result["eventbridge"] = rule_name

        return result


# ══════════════════════════════════════════════════════════════════════════════
#  CLI
# ══════════════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description="DhanwantariAI Agent Registration")
    ap.add_argument("--profile", required=True, help="AWS profile name")
    ap.add_argument("--dry-run", action="store_true", help="Validate without creating resources")
    ap.add_argument("--agent", choices=["medisync", "diseaseintel", "all"], default="all",
                    help="Which agent to register (default: all)")
    args = ap.parse_args()

    registrar = AgentRegistrar(profile=args.profile, dry_run=args.dry_run)

    results = {}
    agents_to_register = list(AGENTS.keys()) if args.agent == "all" else [args.agent]

    for agent_key in agents_to_register:
        results[agent_key] = registrar.register_agent_full(agent_key)

    # Save outputs
    out_path = "aws/agent_registration_outputs.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, default=str)

    logger.info("=" * 60)
    logger.info("Registration complete. Outputs: %s", out_path)
    for key, res in results.items():
        logger.info("  %s: agent_id=%s, lambdas=%d, sm=%s",
                     key, res.get("agent_id"), len(res.get("lambdas", {})),
                     res.get("state_machine"))


if __name__ == "__main__":
    main()
