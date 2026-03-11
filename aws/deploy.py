"""
DhanwantariAI — Deployment Script
aws/deploy.py

Orchestrates full deployment of Agent Services:
  1. Infrastructure (setup_agent_services.py)
  2. Agent registration (register_agents.py)
  3. SES templates (ses_templates.py)
  4. Validation dry-run

Usage:
  python3 aws/deploy.py --profile VS-User --dry-run       # Validate only
  python3 aws/deploy.py --profile VS-User                  # Full deploy
  python3 aws/deploy.py --profile VS-User --phase infra    # Infra only
  python3 aws/deploy.py --profile VS-User --phase agents   # Agents only
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))


def run_script(script_name: str, args: list[str], phase: str) -> bool:
    """Run a deployment script and return success status."""
    script_path = os.path.join(SCRIPTS_DIR, script_name)
    if not os.path.exists(script_path):
        print(f"  [SKIP] {script_name} — not found")
        return False

    print(f"\n{'='*60}")
    print(f"  Phase: {phase}")
    print(f"  Script: {script_name}")
    print(f"  Args: {' '.join(args)}")
    print(f"{'='*60}\n")

    cmd = [sys.executable, script_path] + args
    result = subprocess.run(cmd, capture_output=False)

    if result.returncode != 0:
        print(f"\n  [FAIL] {script_name} exited with code {result.returncode}")
        return False

    print(f"\n  [OK] {script_name} completed successfully")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="DhanwantariAI Agent Services — Deployment Orchestrator"
    )
    parser.add_argument("--profile", required=True, help="AWS CLI profile")
    parser.add_argument("--region", default="ap-south-1", help="AWS region")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate without deploying")
    parser.add_argument("--phase",
                        choices=["infra", "agents", "ses", "all"],
                        default="all",
                        help="Which phase to deploy")
    args = parser.parse_args()

    common_args = ["--profile", args.profile, "--region", args.region]
    if args.dry_run:
        common_args.append("--dry-run")

    print(f"\nDhanwantariAI Agent Services Deployment")
    print(f"  Profile: {args.profile}")
    print(f"  Region:  {args.region}")
    print(f"  Mode:    {'DRY RUN' if args.dry_run else 'LIVE DEPLOY'}")
    print(f"  Phase:   {args.phase}")
    print(f"  Time:    {datetime.utcnow().isoformat()}")

    results = {}

    # Phase 1: Infrastructure (S3, DynamoDB, IAM, Secrets)
    if args.phase in ("infra", "all"):
        results["infra"] = run_script(
            "setup_agent_services.py", common_args, "Infrastructure"
        )

    # Phase 2: Agent Registration (Lambdas, Bedrock, Step Functions, EventBridge)
    if args.phase in ("agents", "all"):
        results["agents"] = run_script(
            "register_agents.py", common_args, "Agent Registration"
        )

    # Phase 3: SES Templates
    if args.phase in ("ses", "all"):
        results["ses"] = run_script(
            "ses_templates.py", common_args, "SES Templates"
        )

    # Summary
    print(f"\n{'='*60}")
    print(f"  DEPLOYMENT SUMMARY")
    print(f"{'='*60}")
    for phase_name, success in results.items():
        status = "OK" if success else "FAIL"
        print(f"  {phase_name:20s} [{status}]")

    all_ok = all(results.values())
    if all_ok:
        print(f"\n  All phases completed successfully.")
    else:
        print(f"\n  Some phases failed. Check output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
