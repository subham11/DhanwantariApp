"""
DhanwantariAI — DiseaseIntel Action Group 1: SourceResearcher
aws/lambda/diseaseintel/source_researcher/handler.py

Fetches disease data from trusted government and WHO sources:
  - WHO Disease Fact Sheets
  - ICMR Clinical Guidelines
  - NVBDCP Protocols (vector-borne)
  - NHM ASHA Training Modules
  - PubMed India-context abstracts
  - MedlinePlus consumer descriptions

Uses Claude Haiku for HTML content extraction.
Per DhanwantariAI_Agent_Services_Spec.md §3.5 Action Group 1.
Lambda config: 512 MB / 120s timeout.
"""

import json
import logging
import os
import ssl
import urllib.request

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = os.environ.get("AWS_REGION", "ap-south-1")
KB_BUCKET = os.environ.get("KB_BUCKET", "dhanwantari-kb-ap-south-1")

# Haiku for HTML parsing; Sonnet reserved for reasoning in SymptomExtractor
HAIKU_MODEL = "anthropic.claude-3-haiku-20240307-v1:0"

USER_AGENT = "DhanwantariAI/1.0 (AppScale LLP; health-research-bot)"

# Trusted source URL patterns
TRUSTED_SOURCES = {
    "who":     "https://who.int/news-room/fact-sheets/detail/{slug}",
    "icmr":    "https://icmr.gov.in/guidelines",
    "nvbdcp":  "https://nvbdcp.gov.in",
    "nhm":     "https://nhm.gov.in",
    "pubmed":  "https://pubmed.ncbi.nlm.nih.gov/?term={query}+India&filter=pubt.guideline",
    "medline": "https://medlineplus.gov/ency/article/{id}.htm",
}

ALLOWED_DOMAINS = [
    "who.int", "icmr.gov.in", "mohfw.gov.in", "nvbdcp.gov.in",
    "nhm.gov.in", "pubmed.ncbi.nlm.nih.gov", "medlineplus.gov",
    "icd.who.int", "rchiips.org",
]

bedrock = boto3.client("bedrock-runtime", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)


def _is_allowed(url: str) -> bool:
    from urllib.parse import urlparse
    host = urlparse(url).hostname or ""
    return any(host == d or host.endswith(f".{d}") for d in ALLOWED_DOMAINS)


def _fetch_url(url: str, timeout: int = 30) -> str:
    """Fetch URL content with SSL verification and whitelist check."""
    if not _is_allowed(url):
        raise ValueError(f"URL blocked by whitelist: {url}")

    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _extract_with_haiku(html_content: str, extraction_prompt: str) -> dict:
    """Use Claude Haiku to extract structured data from HTML content."""
    # Truncate to avoid token limits
    content = html_content[:8000]

    full_prompt = f"""{extraction_prompt}

HTML content:
{content}

Return ONLY valid JSON, no preamble or explanation."""

    resp = bedrock.invoke_model(
        modelId=HAIKU_MODEL,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,
            "messages": [{"role": "user", "content": full_prompt}],
        }),
    )
    body = json.loads(resp["body"].read())
    text = body["content"][0]["text"]

    # Parse JSON from response
    text = text.strip()
    if text.startswith("```"):
        import re
        match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
        if match:
            text = match.group(1)

    return json.loads(text)


# ── Source Fetchers ───────────────────────────────────────────────────────────

def fetch_who_disease_factsheet(disease_slug: str) -> dict:
    """
    Fetch WHO fact sheet for a given disease.
    Returns structured extraction: symptoms, risk factors, complications, etc.
    """
    url = TRUSTED_SOURCES["who"].format(slug=disease_slug)
    logger.info("Fetching WHO fact sheet: %s", url)

    html = _fetch_url(url)

    extraction = _extract_with_haiku(html, f"""
Extract the following from this WHO fact sheet for "{disease_slug}".

Extract:
- symptoms: list of symptoms mentioned
- risk_factors: list of risk factors
- complications: list of complications
- who_gets_it: description of vulnerable populations
- prevention: list of prevention measures
- key_facts: list of key statistical facts

Return format:
{{
  "symptoms": [],
  "risk_factors": [],
  "complications": [],
  "who_gets_it": "",
  "prevention": [],
  "key_facts": [],
  "source_url": "{url}",
  "source_title": ""
}}""")

    extraction["source"] = "WHO"
    extraction["source_url"] = url
    extraction["fetched_at"] = _utcnow_iso()
    return extraction


def fetch_icmr_guidelines(disease_name: str) -> dict:
    """Fetch ICMR clinical guidelines for a disease."""
    url = TRUSTED_SOURCES["icmr"]
    logger.info("Fetching ICMR guidelines for: %s", disease_name)

    html = _fetch_url(url)

    extraction = _extract_with_haiku(html, f"""
Extract information about "{disease_name}" from this ICMR guidelines page.

Extract:
- treatment_protocol: treatment steps
- drug_regimen: recommended drugs
- diagnostic_criteria: how to diagnose
- india_specific_notes: any India-specific guidance

Return format:
{{
  "treatment_protocol": [],
  "drug_regimen": [],
  "diagnostic_criteria": [],
  "india_specific_notes": [],
  "source_url": "{url}",
  "found": true
}}

If the disease is not found on this page, return {{"found": false}}.""")

    extraction["source"] = "ICMR"
    extraction["fetched_at"] = _utcnow_iso()
    return extraction


def fetch_nvbdcp_protocol(disease_name: str) -> dict:
    """Fetch NVBDCP protocol for vector-borne diseases."""
    url = TRUSTED_SOURCES["nvbdcp"]
    logger.info("Fetching NVBDCP protocol for: %s", disease_name)

    try:
        html = _fetch_url(url)
        extraction = _extract_with_haiku(html, f"""
Extract information about "{disease_name}" from this NVBDCP page.

Extract:
- symptoms: disease symptoms
- endemic_regions: regions where disease is common in India
- seasonal_pattern: when is the disease most common
- prevention: prevention measures
- referral_criteria: when to refer to hospital

Return format:
{{
  "symptoms": [],
  "endemic_regions": [],
  "seasonal_pattern": "",
  "prevention": [],
  "referral_criteria": [],
  "source_url": "{url}",
  "found": true
}}""")
        extraction["source"] = "NVBDCP"
        extraction["fetched_at"] = _utcnow_iso()
        return extraction
    except Exception as e:
        logger.warning("NVBDCP fetch failed: %s", e)
        return {"source": "NVBDCP", "found": False, "error": str(e)}


def fetch_nhm_asha_protocol(disease_name: str) -> dict:
    """Fetch NHM ASHA training module data."""
    url = TRUSTED_SOURCES["nhm"]
    logger.info("Fetching NHM ASHA protocol for: %s", disease_name)

    try:
        html = _fetch_url(url)
        extraction = _extract_with_haiku(html, f"""
Extract ASHA-relevant information about "{disease_name}" from this NHM page.

Extract:
- asha_can_manage: whether ASHA workers can manage this condition
- referral_level: ASHA | PHC | CHC | HOSPITAL
- symptom_checklist: symptoms ASHA should check for
- first_aid: initial management steps

Return format:
{{
  "asha_can_manage": false,
  "referral_level": "",
  "symptom_checklist": [],
  "first_aid": [],
  "source_url": "{url}",
  "found": true
}}""")
        extraction["source"] = "NHM"
        extraction["fetched_at"] = _utcnow_iso()
        return extraction
    except Exception as e:
        logger.warning("NHM fetch failed: %s", e)
        return {"source": "NHM", "found": False, "error": str(e)}


def fetch_pubmed_abstracts(disease_name: str, limit: int = 5) -> dict:
    """Fetch PubMed abstracts for disease in Indian population context."""
    query = disease_name.replace(" ", "+")
    url = (
        f"https://pubmed.ncbi.nlm.nih.gov/?term={query}+India+symptoms"
        f"&filter=pubt.clinicaltrial,pubt.guideline&format=abstract&size={limit}"
    )
    logger.info("Fetching PubMed abstracts: %s", url)

    try:
        html = _fetch_url(url)
        extraction = _extract_with_haiku(html, f"""
Extract PubMed research data about "{disease_name}" in India from these search results.

Extract:
- abstracts: list of relevant abstracts found
  - Each has: title, pmid, prevalence_data (if any), key_findings
- india_prevalence: any India-specific prevalence data found

Return format:
{{
  "abstracts": [
    {{
      "title": "",
      "pmid": "",
      "prevalence_data": "",
      "key_findings": []
    }}
  ],
  "india_prevalence": "",
  "source_url": "{url}",
  "count": 0
}}""")
        extraction["source"] = "PubMed"
        extraction["fetched_at"] = _utcnow_iso()
        return extraction
    except Exception as e:
        logger.warning("PubMed fetch failed: %s", e)
        return {"source": "PubMed", "found": False, "error": str(e)}


def _utcnow_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions.

    Input:
      {
        "disease_id": "dengue",
        "disease_slug": "dengue-and-severe-dengue",  // for WHO
        "disease_name": "Dengue",
        "icd10_code": "A90",
        "sources": ["who", "icmr", "nvbdcp", "nhm", "pubmed"]  // optional filter
      }
    """
    logger.info("SourceResearcher invoked: %s", json.dumps(event, default=str))

    disease_id = event.get("disease_id", "")
    disease_slug = event.get("disease_slug", disease_id)
    disease_name = event.get("disease_name", disease_id.replace("_", " ").title())
    requested_sources = event.get("sources", ["who", "icmr", "nvbdcp", "nhm", "pubmed"])

    results = {}
    errors = []

    source_map = {
        "who": lambda: fetch_who_disease_factsheet(disease_slug),
        "icmr": lambda: fetch_icmr_guidelines(disease_name),
        "nvbdcp": lambda: fetch_nvbdcp_protocol(disease_name),
        "nhm": lambda: fetch_nhm_asha_protocol(disease_name),
        "pubmed": lambda: fetch_pubmed_abstracts(disease_name),
    }

    for src in requested_sources:
        fetcher = source_map.get(src)
        if not fetcher:
            continue
        try:
            results[src] = fetcher()
        except Exception as e:
            logger.error("Source %s failed for %s: %s", src, disease_id, e)
            errors.append({"source": src, "error": str(e)})

    # Store raw research output to S3
    raw_key = f"raw/research/{disease_id}/{_utcnow_iso().split('T')[0]}.json"
    s3.put_object(
        Bucket=KB_BUCKET,
        Key=raw_key,
        Body=json.dumps(results, ensure_ascii=False, default=str),
        ContentType="application/json",
    )

    return {
        "disease_id": disease_id,
        "disease_name": disease_name,
        "source_contents": results,
        "sources_fetched": list(results.keys()),
        "errors": errors,
        "raw_s3_path": raw_key,
    }
