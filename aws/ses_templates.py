"""
DhanwantariAI — SES Email Templates
aws/ses_templates.py

Creates/updates SES email templates for agent run notifications.
Three templates per DhanwantariAI_Agent_Services_Spec.md §9.2:
  1. Run Complete — sent after every successful agent run
  2. Price Flag (Urgent) — >20% price change detected
  3. Agent Failure (Critical) — agent run failed

Usage:
  python3 aws/ses_templates.py --profile VS-User [--dry-run]

Requires SES identity verified for: satyam@appscale.in
"""

import argparse
import json
import logging

import boto3
from botocore.exceptions import ClientError

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

REGION = "ap-south-1"
SENDER = "DhanwantariAI <no-reply@appscale.in>"
RECIPIENTS = ["satyam@appscale.in"]
CLINICAL_RECIPIENTS = ["satyam@appscale.in", "clinical-advisory@appscale.in"]

TEMPLATES = [
    {
        "TemplateName": "DhanwantariAI-RunComplete",
        "SubjectPart": "[{{agent_name}}] {{run_type}} Run Complete — {{changes_count}} changes detected",
        "HtmlPart": """
<html>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a5276;">DhanwantariAI — {{agent_name}} Run Report</h2>
  <p><strong>Run ID:</strong> {{run_id}}</p>
  <p><strong>Completed at:</strong> {{completed_at}}</p>
  <p><strong>Version:</strong> {{version}}</p>

  <h3>Summary</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr style="background: #eaf2f8;">
      <td style="padding: 8px; border: 1px solid #d5dbdb;">Added</td>
      <td style="padding: 8px; border: 1px solid #d5dbdb; font-weight: bold;">{{added}}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #d5dbdb;">Removed</td>
      <td style="padding: 8px; border: 1px solid #d5dbdb; font-weight: bold;">{{removed}}</td>
    </tr>
    <tr style="background: #eaf2f8;">
      <td style="padding: 8px; border: 1px solid #d5dbdb;">Changed</td>
      <td style="padding: 8px; border: 1px solid #d5dbdb; font-weight: bold;">{{changed}}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #d5dbdb;">Price Flags</td>
      <td style="padding: 8px; border: 1px solid #d5dbdb; font-weight: bold; color: {{flags_colour}};">{{flags}}</td>
    </tr>
  </table>

  <p style="margin-top: 16px;">
    <strong>KB Patch:</strong> <code>{{patch_s3_path}}</code><br>
    <strong>Sources:</strong> {{sources_used}}
  </p>

  <hr style="margin: 20px 0; border: none; border-top: 1px solid #d5dbdb;">
  <p style="color: #808b96; font-size: 12px;">
    DhanwantariAI by AppScale LLP (LLPIN: ACP-6024) — Bengaluru, India<br>
    This is an automated notification. Do not reply.
  </p>
</body>
</html>
""",
        "TextPart": """
DhanwantariAI — {{agent_name}} Run Report
==========================================
Run ID: {{run_id}}
Completed: {{completed_at}}
Version: {{version}}

Summary:
  Added:   {{added}}
  Removed: {{removed}}
  Changed: {{changed}}
  Flags:   {{flags}}

KB Patch: {{patch_s3_path}}
Sources:  {{sources_used}}

— DhanwantariAI by AppScale LLP
""",
    },
    {
        "TemplateName": "DhanwantariAI-PriceFlag",
        "SubjectPart": "⚠️ [MediSync] Price Flag — Manual Review Required ({{flag_count}} items)",
        "HtmlPart": """
<html>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #c0392b;">⚠️ Price Flag — Manual Review Required</h2>
  <p>MediSync detected <strong>{{flag_count}}</strong> medicines with &gt;20% price change.</p>
  <p>These changes are <strong>held for manual review</strong> and will NOT be applied to the KB automatically.</p>

  <h3>Flagged Medicines</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr style="background: #f5b7b1;">
      <th style="padding: 8px; border: 1px solid #d5dbdb; text-align: left;">Drug Code</th>
      <th style="padding: 8px; border: 1px solid #d5dbdb; text-align: left;">Name</th>
      <th style="padding: 8px; border: 1px solid #d5dbdb; text-align: right;">Old MRP</th>
      <th style="padding: 8px; border: 1px solid #d5dbdb; text-align: right;">New MRP</th>
      <th style="padding: 8px; border: 1px solid #d5dbdb; text-align: right;">Change</th>
    </tr>
    {{#price_flags}}
    <tr>
      <td style="padding: 8px; border: 1px solid #d5dbdb;">{{drug_code}}</td>
      <td style="padding: 8px; border: 1px solid #d5dbdb;">{{name}}</td>
      <td style="padding: 8px; border: 1px solid #d5dbdb; text-align: right;">₹{{old_mrp}}</td>
      <td style="padding: 8px; border: 1px solid #d5dbdb; text-align: right;">₹{{new_mrp}}</td>
      <td style="padding: 8px; border: 1px solid #d5dbdb; text-align: right; color: #c0392b; font-weight: bold;">{{pct_change}}%</td>
    </tr>
    {{/price_flags}}
  </table>

  <p style="margin-top: 16px;">
    <strong>Action required:</strong> Reply to this email to approve or reject these changes.
  </p>

  <hr style="margin: 20px 0; border: none; border-top: 1px solid #d5dbdb;">
  <p style="color: #808b96; font-size: 12px;">
    DhanwantariAI by AppScale LLP — Bengaluru, India
  </p>
</body>
</html>
""",
        "TextPart": """
⚠️ PRICE FLAG — MANUAL REVIEW REQUIRED
========================================
MediSync detected {{flag_count}} medicines with >20% price change.
These are HELD for manual review.

{{#price_flags}}
- {{drug_code}} | {{name}} | ₹{{old_mrp}} → ₹{{new_mrp}} ({{pct_change}}%)
{{/price_flags}}

Reply to approve or reject.

— DhanwantariAI by AppScale LLP
""",
    },
    {
        "TemplateName": "DhanwantariAI-AgentFailure",
        "SubjectPart": "🚨 [DhanwantariAI] Agent Run Failed: {{agent_name}}",
        "HtmlPart": """
<html>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #c0392b;">🚨 Agent Run Failed</h2>
  <p><strong>Agent:</strong> {{agent_name}}</p>
  <p><strong>Run ID:</strong> {{run_id}}</p>
  <p><strong>Failed at:</strong> {{failed_at}}</p>
  <p><strong>Step:</strong> {{failed_step}}</p>

  <h3>Error Details</h3>
  <pre style="background: #fbeee6; padding: 12px; border-radius: 4px; overflow-x: auto;">{{error_message}}</pre>

  <h3>CloudWatch Logs</h3>
  <p><a href="{{cloudwatch_log_url}}">View logs in CloudWatch</a></p>

  <p style="margin-top: 16px; color: #c0392b; font-weight: bold;">
    Action required: Investigate and re-run if needed.
  </p>

  <hr style="margin: 20px 0; border: none; border-top: 1px solid #d5dbdb;">
  <p style="color: #808b96; font-size: 12px;">
    DhanwantariAI by AppScale LLP — Bengaluru, India
  </p>
</body>
</html>
""",
        "TextPart": """
🚨 AGENT RUN FAILED
====================
Agent:     {{agent_name}}
Run ID:    {{run_id}}
Failed at: {{failed_at}}
Step:      {{failed_step}}

Error:
{{error_message}}

CloudWatch: {{cloudwatch_log_url}}

— DhanwantariAI by AppScale LLP
""",
    },
]


def deploy_templates(profile: str, dry_run: bool = False):
    """Create or update all SES email templates."""
    session = boto3.Session(profile_name=profile, region_name=REGION)
    ses = session.client("ses")

    for tpl in TEMPLATES:
        name = tpl["TemplateName"]
        template_data = {
            "TemplateName": name,
            "SubjectPart": tpl["SubjectPart"],
            "HtmlPart": tpl["HtmlPart"].strip(),
            "TextPart": tpl["TextPart"].strip(),
        }

        if dry_run:
            logger.info("[DRY-RUN] Would create/update SES template: %s", name)
            continue

        try:
            ses.get_template(TemplateName=name)
            ses.update_template(Template=template_data)
            logger.info("Updated SES template: %s", name)
        except ClientError as e:
            if e.response["Error"]["Code"] == "TemplateDoesNotExist":
                ses.create_template(Template=template_data)
                logger.info("Created SES template: %s", name)
            else:
                raise


def main():
    ap = argparse.ArgumentParser(description="DhanwantariAI SES Templates")
    ap.add_argument("--profile", required=True, help="AWS profile name")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    deploy_templates(args.profile, args.dry_run)
    logger.info("SES template deployment complete.")


if __name__ == "__main__":
    main()
