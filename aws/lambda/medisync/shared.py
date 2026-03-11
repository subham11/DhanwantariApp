"""
DhanwantariAI — MediSync Shared Utilities
aws/lambda/medisync/shared.py

Shared constants, URL whitelist, and helper functions used
across all MediSync agent Lambda action groups.

Per DhanwantariAI_Agent_Services_Spec.md §2, §4, §8.
"""

import json
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Constants ─────────────────────────────────────────────────────────────────

REGION    = "ap-south-1"
KB_BUCKET = "dhanwantari-kb-ap-south-1"
MEDICINES_TABLE = "dhanwantari-medicines"
AGENT_RUNS_TABLE = "dhanwantari-agent-runs"
CW_NAMESPACE = "DhanwantariAgents"

# ── Source URL Whitelist (§8.1) ───────────────────────────────────────────────

ALLOWED_SOURCE_DOMAINS = [
    "who.int",
    "icmr.gov.in",
    "mohfw.gov.in",
    "ayush.gov.in",
    "nvbdcp.gov.in",
    "nhm.gov.in",
    "janaushadhi.gov.in",
    "pubmed.ncbi.nlm.nih.gov",
    "himalayawellness.com",
    "patanjaliayurved.net",
    "daburindia.com",
    "icd.who.int",
    "rchiips.org",
    "medlineplus.gov",
]


def is_url_allowed(url: str) -> bool:
    """Check that a URL belongs to a whitelisted domain."""
    try:
        host = urlparse(url).hostname or ""
        return any(
            host == domain or host.endswith(f".{domain}")
            for domain in ALLOWED_SOURCE_DOMAINS
        )
    except Exception:
        return False


def validate_url(url: str) -> str:
    """Validate and return URL or raise ValueError."""
    if not is_url_allowed(url):
        raise ValueError(f"URL blocked by whitelist: {url}")
    return url


# ── Medicine Schema Validation ────────────────────────────────────────────────

ALLOPATHIC_REQUIRED = ["generic_name", "drug_code", "mrp", "category", "source"]
AYURVEDIC_REQUIRED = [
    "product_name", "brand", "primary_herb", "therapeutic_use",
    "ayush_reg_number", "mrp", "source",
]

# PMBJP drug code: alphanumeric 4–8 chars
DRUG_CODE_RE = re.compile(r"^[A-Z0-9]{4,8}$")


def validate_drug_code(code: str) -> bool:
    """Validate PMBJP drug code format."""
    return bool(DRUG_CODE_RE.match(code.strip())) if code else False


def normalise_price(mrp_raw) -> float:
    """Strip currency symbols and convert to float."""
    cleaned = re.sub(r"[^\d.]", "", str(mrp_raw or "0"))
    return float(cleaned) if cleaned else 0.0


def utcnow_iso() -> str:
    """UTC timestamp in ISO 8601."""
    return datetime.now(timezone.utc).isoformat()


def utcnow_date() -> str:
    """UTC date string YYYYMMDD."""
    return datetime.now(timezone.utc).strftime("%Y%m%d")


# ── ICD-10 Category Mapping (subset for common PMBJP categories) ─────────────

_CATEGORY_ICD10_MAP = {
    "analgesic":        ["M79.3", "R52"],
    "anti-infective":   ["A49.9"],
    "anti-diabetic":    ["E11"],
    "anti-hypertensive":["I10"],
    "anti-malarial":    ["B54"],
    "anti-tubercular":  ["A15"],
    "anti-asthmatic":   ["J45"],
    "anti-anaemic":     ["D50"],
    "cardiovascular":   ["I25.9"],
    "gastrointestinal": ["K30"],
    "dermatological":   ["L30.9"],
    "ophthalmic":       ["H57.9"],
}


def map_category_to_icd10(category: str) -> list[str]:
    """Map a PMBJP therapeutic category to ICD-10 codes."""
    if not category:
        return []
    key = category.strip().lower().replace(" ", "-")
    for cat_key, codes in _CATEGORY_ICD10_MAP.items():
        if cat_key in key:
            return codes
    return []


# ── CloudWatch Metric Helper ─────────────────────────────────────────────────

def put_metric(cw_client, metric_name: str, value: float, unit: str = "Count"):
    """Emit a CloudWatch metric under DhanwantariAgents namespace."""
    try:
        cw_client.put_metric_data(
            Namespace=CW_NAMESPACE,
            MetricData=[{
                "MetricName": metric_name,
                "Value": value,
                "Unit": unit,
                "Dimensions": [
                    {"Name": "Agent", "Value": "MediSync"},
                ],
            }],
        )
    except Exception as e:
        logger.warning("CloudWatch metric emit failed: %s", e)
