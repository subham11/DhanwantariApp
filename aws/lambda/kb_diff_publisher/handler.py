"""
DhanwantariAI — KB Patch Pipeline: kb-diff-publisher Lambda
aws/lambda/kb_diff_publisher/handler.py

Generates delta patches from new S3 exports for mobile OTA delivery.
Reads current manifest, computes diff against new data, writes minimal
patch JSON (<200 KB target), updates kb_manifest.json.

Per DhanwantariAI_Agent_Services_Spec.md §7.
Lambda config: 256 MB / 60s timeout.
"""

import hashlib
import json
import logging
import os
from datetime import datetime

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = os.environ.get("AWS_REGION", "ap-south-1")
S3_BUCKET = os.environ.get("S3_BUCKET", "dhanwantari-kb-ap-south-1")
MANIFEST_KEY = "kb_manifest.json"

# Components tracked in the manifest
COMPONENTS = {
    "medicines_allopathic": {
        "s3_prefix": "kb/medicines/medicines_v",
        "id_field": "drug_code",
    },
    "medicines_ayurvedic": {
        "s3_prefix": "kb/medicines/ayurvedic_v",
        "id_field": "product_id",
    },
    "disease_profiles": {
        "s3_prefix": "kb/diseases/disease_profiles_v",
        "id_field": "disease_id",
    },
    "symptom_mappings": {
        "s3_prefix": "kb/diseases/symptom_mappings_v",
        "id_field": "disease_id",  # composite key: disease_id + symptom_id
    },
    "bmi_risk_matrix": {
        "s3_prefix": "kb/bmi/bmi_risk_matrix_v",
        "id_field": "disease_id",
    },
}


def _read_s3_json(s3, key: str) -> dict | None:
    """Read a JSON file from S3, return None if not found."""
    try:
        resp = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(resp["Body"].read().decode("utf-8"))
    except s3.exceptions.NoSuchKey:
        return None


def _sha256(data: bytes) -> str:
    """Compute SHA-256 hash of data."""
    return hashlib.sha256(data).hexdigest()


def read_current_manifest(s3) -> dict:
    """Read the current kb_manifest.json or return empty template."""
    manifest = _read_s3_json(s3, MANIFEST_KEY)
    if manifest:
        return manifest
    return {
        "kb_version": "0.0.0",
        "generated_at": None,
        "min_app_version": "2.0.0",
        "emergency_update": False,
        "components": {},
    }


def compute_diff(old_records: list[dict], new_records: list[dict],
                 id_field: str) -> dict:
    """
    Compute minimal diff between old and new record sets.
    Returns additions, updates (changed fields only), removals.
    """
    old_by_id = {r[id_field]: r for r in old_records}
    new_by_id = {r[id_field]: r for r in new_records}

    old_ids = set(old_by_id.keys())
    new_ids = set(new_by_id.keys())

    additions = [new_by_id[rid] for rid in (new_ids - old_ids)]
    removals = [{"id": rid} for rid in (old_ids - new_ids)]

    updates = []
    for rid in (old_ids & new_ids):
        old_r = old_by_id[rid]
        new_r = new_by_id[rid]
        changes = {}
        for key in set(old_r.keys()) | set(new_r.keys()):
            old_val = old_r.get(key)
            new_val = new_r.get(key)
            if old_val != new_val:
                changes[key] = new_val
        if changes:
            changes[id_field] = rid
            updates.append(changes)

    return {
        "additions": additions,
        "updates": updates,
        "removals": removals,
    }


def generate_patch(component_name: str, component_config: dict,
                   old_s3_key: str | None, new_s3_key: str,
                   new_version: str, s3) -> dict:
    """
    Generate a delta patch for a single component.
    Returns patch metadata (key, size, sha256).
    """
    id_field = component_config["id_field"]

    # Read new data
    new_data = _read_s3_json(s3, new_s3_key)
    if not new_data:
        logger.warning("New data not found at %s", new_s3_key)
        return None

    # Extract the records list from the wrapper
    new_records = _extract_records(new_data)

    # Read old data (if exists)
    old_records = []
    if old_s3_key:
        old_data = _read_s3_json(s3, old_s3_key)
        if old_data:
            old_records = _extract_records(old_data)

    # Compute diff
    diff = compute_diff(old_records, new_records, id_field)

    total_changes = (len(diff["additions"]) + len(diff["updates"])
                     + len(diff["removals"]))

    if total_changes == 0:
        logger.info("No changes for %s — skipping patch", component_name)
        return None

    # Build patch JSON
    today = datetime.utcnow().strftime("%Y%m%d")
    patch = {
        "component": component_name,
        "from_version": old_s3_key.split("_v")[-1].replace(".json", "") if old_s3_key else "0.0.0",
        "to_version": new_version,
        "generated_at": datetime.utcnow().isoformat(),
        "changes": diff,
        "total_changes": total_changes,
    }

    patch_bytes = json.dumps(patch, ensure_ascii=False).encode("utf-8")
    patch_key = f"kb_patches/patch_{today}_{component_name}.json"

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=patch_key,
        Body=patch_bytes,
        ContentType="application/json",
    )

    size_kb = len(patch_bytes) / 1024
    if size_kb > 200:
        logger.warning("Patch %s is %d KB — exceeds 200 KB target",
                       patch_key, int(size_kb))

    return {
        "patch_key": patch_key,
        "sha256": _sha256(patch_bytes),
        "size_kb": round(size_kb, 1),
        "total_changes": total_changes,
    }


def _extract_records(data: dict) -> list[dict]:
    """Extract the records list from various wrapper formats."""
    # Try common wrapper keys
    for key in ("medicines", "diseases", "mappings", "bmi_matrix", "records"):
        if key in data:
            val = data[key]
            if isinstance(val, list):
                return val
    # If data itself is a list
    if isinstance(data, list):
        return data
    return []


def update_manifest(s3, component_updates: dict, emergency: bool = False) -> dict:
    """
    Read current manifest, apply component version updates,
    write new manifest to S3. Returns updated manifest.
    """
    manifest = read_current_manifest(s3)

    for comp_name, comp_info in component_updates.items():
        manifest["components"][comp_name] = {
            "version": comp_info["version"],
            "s3_path": comp_info["s3_path"],
            "sha256": comp_info["sha256"],
            "size_kb": comp_info["size_kb"],
            "updated_at": datetime.utcnow().isoformat(),
        }
        if comp_info.get("patch"):
            manifest["components"][comp_name]["latest_patch"] = comp_info["patch"]

    # Bump overall kb_version
    parts = manifest["kb_version"].split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    manifest["kb_version"] = ".".join(parts)
    manifest["generated_at"] = datetime.utcnow().isoformat()
    manifest["emergency_update"] = emergency

    manifest_bytes = json.dumps(manifest, indent=2, ensure_ascii=False).encode("utf-8")
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=MANIFEST_KEY,
        Body=manifest_bytes,
        ContentType="application/json",
    )

    logger.info("Updated manifest to kb_version %s", manifest["kb_version"])
    return manifest


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called after Step Functions WriteStore/WriteAll state.

    Input: {
      "updates": {
        "medicines_allopathic": {
          "version": "3.1.0",
          "s3_path": "kb/medicines/medicines_v3.1.0.json"
        },
        ...
      },
      "emergency": false
    }

    Generates patches for each updated component and updates kb_manifest.json.
    """
    logger.info("kb-diff-publisher invoked: %s", json.dumps(event, default=str))

    s3 = boto3.client("s3", region_name=REGION)
    updates = event.get("updates", {})
    emergency = event.get("emergency", False)

    # Read current manifest to find old versions
    current_manifest = read_current_manifest(s3)

    component_updates = {}

    for comp_name, update_info in updates.items():
        new_version = update_info["version"]
        new_s3_path = update_info["s3_path"]

        # Find old version S3 path from manifest
        old_comp = current_manifest.get("components", {}).get(comp_name, {})
        old_s3_path = old_comp.get("s3_path")

        comp_config = COMPONENTS.get(comp_name, {"id_field": "id"})

        # Generate patch
        patch_info = generate_patch(
            comp_name, comp_config, old_s3_path, new_s3_path, new_version, s3,
        )

        # Read new file to get SHA and size
        new_data = s3.get_object(Bucket=S3_BUCKET, Key=new_s3_path)
        new_body = new_data["Body"].read()

        component_updates[comp_name] = {
            "version": new_version,
            "s3_path": new_s3_path,
            "sha256": _sha256(new_body),
            "size_kb": round(len(new_body) / 1024, 1),
            "patch": patch_info,
        }

    # Update manifest
    manifest = update_manifest(s3, component_updates, emergency)

    return {
        "manifest_version": manifest["kb_version"],
        "components_updated": list(component_updates.keys()),
        "patches_generated": sum(
            1 for cu in component_updates.values() if cu.get("patch")
        ),
    }
