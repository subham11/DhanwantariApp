"""
DhanwantariAI — MediSync Action Group 1: WebFetcher
aws/lambda/medisync/web_fetcher/handler.py

Fetches medicine data from trusted Indian government and brand sources.
Stores raw content in S3 for downstream parsing.

Sources:
  - PMBJP (janaushadhi.gov.in) — product basket PDF
  - AYUSH (ayush.gov.in) — NLEAM list
  - Brand sites (Himalaya, Patanjali, Dabur) — product pages

Per DhanwantariAI_Agent_Services_Spec.md §2.5 Action Group 1.
Lambda config: 256 MB / 60s timeout.
"""

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from urllib.parse import urlparse

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Config ────────────────────────────────────────────────────────────────────

REGION    = os.environ.get("AWS_REGION", "ap-south-1")
KB_BUCKET = os.environ.get("KB_BUCKET", "dhanwantari-kb-ap-south-1")

s3 = boto3.client("s3", region_name=REGION)

# Trusted source URLs (§8.1 whitelist enforced)
SOURCES = {
    "pmbjp": {
        "url": "https://janaushadhi.gov.in/Data/PMBJP%20Product.pdf",
        "type": "pdf",
        "prefix": "raw/janaushadhi",
    },
    "nlem": {
        "url": "https://mohfw.gov.in",
        "type": "html",
        "prefix": "raw/nlem",
    },
    "ayush_nleam": {
        "url": "https://ayush.gov.in",
        "type": "html",
        "prefix": "raw/ayush",
    },
    "himalaya": {
        "url": "https://himalayawellness.com/en/products",
        "type": "html",
        "prefix": "raw/brands/himalaya",
    },
    "patanjali": {
        "url": "https://patanjaliayurved.net",
        "type": "html",
        "prefix": "raw/brands/patanjali",
    },
    "dabur": {
        "url": "https://daburindia.com",
        "type": "html",
        "prefix": "raw/brands/dabur",
    },
}

# Allowed domains (whitelist enforcement)
ALLOWED_DOMAINS = [
    "janaushadhi.gov.in",
    "mohfw.gov.in",
    "ayush.gov.in",
    "himalayawellness.com",
    "patanjaliayurved.net",
    "daburindia.com",
]


def _is_allowed(url: str) -> bool:
    """Only fetch from whitelisted domains."""
    host = urlparse(url).hostname or ""
    return any(host == d or host.endswith(f".{d}") for d in ALLOWED_DOMAINS)


def _fetch_url(url: str, timeout: int = 30) -> bytes:
    """Fetch URL content with timeout. Uses urllib to avoid external deps."""
    import urllib.request
    import ssl

    if not _is_allowed(url):
        raise ValueError(f"URL blocked by whitelist: {url}")

    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "DhanwantariAI-MediSync/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return resp.read()


def _store_raw(content: bytes, prefix: str, extension: str) -> dict:
    """Store raw fetched content in S3 with metadata."""
    now = datetime.now(timezone.utc)
    sha256 = hashlib.sha256(content).hexdigest()
    key = f"{prefix}/{now.strftime('%Y%m%d_%H%M%S')}.{extension}"

    s3.put_object(
        Bucket=KB_BUCKET,
        Key=key,
        Body=content,
        ContentType="application/pdf" if extension == "pdf" else "text/html",
        Metadata={"sha256": sha256, "fetched_at": now.isoformat()},
    )
    logger.info("Stored %d bytes → s3://%s/%s", len(content), KB_BUCKET, key)

    return {
        "s3_path": key,
        "sha256": sha256,
        "size_bytes": len(content),
        "fetched_at": now.isoformat(),
    }


# ── Action Group Entry Points ────────────────────────────────────────────────

def fetch_janaushadhi(event, context):
    """Fetch PMBJP product basket PDF."""
    src = SOURCES["pmbjp"]
    content = _fetch_url(src["url"])
    result = _store_raw(content, src["prefix"], "pdf")
    result["source"] = "PMBJP"
    return result


def fetch_ayush_nleam(event, context):
    """Fetch NLEAM from AYUSH portal."""
    src = SOURCES["ayush_nleam"]
    content = _fetch_url(src["url"])
    result = _store_raw(content, src["prefix"], "html")
    result["source"] = "AYUSH"
    return result


def fetch_brand_products(event, context):
    """Fetch product pages from Himalaya, Patanjali, Dabur."""
    results = {}
    errors = []

    for brand in ["himalaya", "patanjali", "dabur"]:
        src = SOURCES[brand]
        try:
            content = _fetch_url(src["url"])
            result = _store_raw(content, src["prefix"], "html")
            result["source"] = brand.upper()
            results[brand] = result
        except Exception as e:
            logger.error("Failed to fetch %s: %s", brand, e)
            errors.append({"brand": brand, "error": str(e)})

    return {"brands": results, "errors": errors}


# ── Lambda Handler (Step Functions entry point) ──────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions.
    Input event: { "action": "fetch_all" | "fetch_pmbjp" | "fetch_ayush" | "fetch_brands" }
    """
    action = event.get("action", "fetch_all")
    logger.info("WebFetcher invoked: action=%s", action)

    if action == "fetch_pmbjp":
        return fetch_janaushadhi(event, context)

    if action == "fetch_ayush":
        return fetch_ayush_nleam(event, context)

    if action == "fetch_brands":
        return fetch_brand_products(event, context)

    # Default: fetch all sources in sequence
    results = {}
    errors = []

    try:
        results["pmbjp"] = fetch_janaushadhi(event, context)
    except Exception as e:
        logger.error("PMBJP fetch failed: %s", e)
        errors.append({"source": "PMBJP", "error": str(e)})

    try:
        results["ayush"] = fetch_ayush_nleam(event, context)
    except Exception as e:
        logger.error("AYUSH fetch failed: %s", e)
        errors.append({"source": "AYUSH", "error": str(e)})

    try:
        brand_result = fetch_brand_products(event, context)
        results["brands"] = brand_result["brands"]
        errors.extend(brand_result.get("errors", []))
    except Exception as e:
        logger.error("Brand fetch failed: %s", e)
        errors.append({"source": "BRANDS", "error": str(e)})

    return {
        "results": results,
        "errors": errors,
        "source_count": len(results),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
