"""
DhanwantariAI — MediSync Action Group 2: PDFParser
aws/lambda/medisync/pdf_parser/handler.py

Extracts structured medicine records from PMBJP and NLEM PDFs
stored in S3 by the WebFetcher action group.

Uses pdfplumber for tabular extraction from Jan Aushadhi product PDFs.
PMBJP PDF layout: Drug Code | Generic Name | Pack Size | MRP | Category

Per DhanwantariAI_Agent_Services_Spec.md §2.5 Action Group 2.
Lambda config: 512 MB / 120s timeout (pdfplumber in-memory).
"""

import io
import json
import logging
import os
import re

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION    = os.environ.get("AWS_REGION", "ap-south-1")
KB_BUCKET = os.environ.get("KB_BUCKET", "dhanwantari-kb-ap-south-1")

s3 = boto3.client("s3", region_name=REGION)


def _download_from_s3(s3_path: str) -> bytes:
    """Download raw file from S3 KB bucket."""
    resp = s3.get_object(Bucket=KB_BUCKET, Key=s3_path)
    return resp["Body"].read()


def _clean_cell(val) -> str:
    """Clean a table cell value."""
    if val is None:
        return ""
    return str(val).strip()


def _parse_mrp(raw: str) -> float | None:
    """Extract numeric price from MRP cell (handles ₹, Rs., commas)."""
    cleaned = re.sub(r"[^\d.]", "", raw)
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def extract_pmbjp_records(pdf_bytes: bytes) -> list[dict]:
    """
    Extract medicine records from PMBJP product basket PDF.

    Expected table columns:
      [0] Drug Code   — e.g. "PM0001"
      [1] Generic Name — e.g. "Paracetamol Tablet 500 mg"
      [2] Pack Size   — e.g. "10 Tab"
      [3] MRP (₹)    — e.g. "6.46"
      [4] Category    — e.g. "Analgesic"
    """
    import pdfplumber

    records = []
    parse_errors = 0

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            for table in tables:
                for row_idx, row in enumerate(table):
                    if row_idx == 0:
                        continue  # Skip header row

                    if not row or len(row) < 5:
                        continue

                    drug_code = _clean_cell(row[0])
                    generic_name = _clean_cell(row[1])
                    pack_size = _clean_cell(row[2])
                    mrp = _parse_mrp(_clean_cell(row[3]))
                    category = _clean_cell(row[4])

                    # Skip rows with no drug code or name
                    if not drug_code or not generic_name:
                        parse_errors += 1
                        continue

                    records.append({
                        "drug_code": drug_code.upper(),
                        "generic_name": generic_name,
                        "pack_size": pack_size or None,
                        "mrp": mrp,
                        "category": category or None,
                        "source": "PMBJP",
                        "source_url": "https://janaushadhi.gov.in",
                        "_page": page_num,
                    })

    logger.info(
        "PMBJP PDF: %d records extracted, %d parse errors across %d pages",
        len(records), parse_errors, len(pdf.pages) if pdf_bytes else 0,
    )
    return records


def extract_nlem_records(html_bytes: bytes) -> list[dict]:
    """
    Extract medicine records from NLEM HTML content.
    NLEM provides the National List of Essential Medicines.
    """
    from html.parser import HTMLParser

    records = []
    # NLEM parsing is source-specific; this is a structured stub
    # that will be implemented when the exact NLEM page format is known.
    content = html_bytes.decode("utf-8", errors="replace")

    # Basic pattern: look for drug names in structured content
    # Real implementation will use the specific NLEM table/list format
    logger.info("NLEM parsing: %d bytes received", len(html_bytes))
    return records


# ── Lambda Handler ────────────────────────────────────────────────────────────

def handler(event, context):
    """
    Lambda handler — called by Step Functions.
    Input:
      {
        "s3_path": "raw/janaushadhi/20260301.pdf",
        "source": "PMBJP" | "NLEM",
        "source_type": "pdf" | "html"
      }
    Or for batch mode:
      {
        "sources": [
          {"s3_path": "raw/janaushadhi/...", "source": "PMBJP", "source_type": "pdf"},
          {"s3_path": "raw/nlem/...", "source": "NLEM", "source_type": "html"}
        ]
      }
    """
    logger.info("PDFParser invoked: %s", json.dumps(event, default=str))

    # Batch mode
    if "sources" in event:
        all_records = []
        parse_errors = 0
        for src in event["sources"]:
            result = _parse_single(src)
            all_records.extend(result.get("records", []))
            parse_errors += result.get("parse_errors", 0)
        return {
            "records": all_records,
            "count": len(all_records),
            "parse_errors": parse_errors,
        }

    # Single source mode
    return _parse_single(event)


def _parse_single(source_event: dict) -> dict:
    """Parse a single source file from S3."""
    s3_path = source_event.get("s3_path", "")
    source = source_event.get("source", "UNKNOWN")
    source_type = source_event.get("source_type", "pdf")

    raw_bytes = _download_from_s3(s3_path)
    logger.info("Downloaded %d bytes from s3://%s/%s", len(raw_bytes), KB_BUCKET, s3_path)

    if source == "PMBJP" or source_type == "pdf":
        records = extract_pmbjp_records(raw_bytes)
    elif source == "NLEM":
        records = extract_nlem_records(raw_bytes)
    else:
        logger.warning("Unknown source type: %s", source)
        records = []

    return {
        "records": records,
        "count": len(records),
        "source": source,
        "s3_path": s3_path,
        "parse_errors": 0,
    }
