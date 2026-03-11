"""
AWS-P3.2: Qdrant vector ingestion for DhanwantariAI.

Embeds and upserts records into three Qdrant Cloud collections:
  1. disease_symptoms    — one doc per disease: name + symptom list
  2. medicines           — one doc per disease: JanAushadhi + Ayurvedic drugs
  3. clinical_protocols  — one doc per disease: important notes + referral cues

Encoder: sentence-transformers/all-MiniLM-L6-v2 (384-dim)
Source:  DhanwantariMobile/src/assets/data/symptom_disease_mapping.json

Usage:
    pip install sentence-transformers qdrant-client
    python3 aws/ingest_vectors.py

Safe to re-run — upsert is idempotent.
"""

import json
import sys
import time
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent
DATA_FILE = ROOT / "DhanwantariMobile/src/assets/data/symptom_disease_mapping.json"

# ── Qdrant config ─────────────────────────────────────────────────────────────

QDRANT_URL = (
    "https://46696dcb-3c39-41db-bab3-80d80027e898"
    ".eu-west-2-0.aws.cloud.qdrant.io:6333"
)
QDRANT_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJhY2Nlc3MiOiJtIn0"
    ".xnl7rtHTVwDTcAYcHXBnOCgiC87H2eR6S1eH5MpNjNE"
)
COLLECTIONS = {
    "disease_symptoms": "disease_symptoms",
    "medicines": "medicines",
    "clinical_protocols": "clinical_protocols",
}
BATCH_SIZE = 32

# ── Dependency check ──────────────────────────────────────────────────────────

def require(pkg: str, import_name: str | None = None):
    import importlib
    name = import_name or pkg
    try:
        return importlib.import_module(name)
    except ImportError:
        print(f"Missing: {pkg}. Run: pip install {pkg}")
        sys.exit(1)


# ── Text builders ─────────────────────────────────────────────────────────────

def disease_symptom_text(d: dict) -> str:
    symptoms = ", ".join(d.get("symptoms", []))
    category = d.get("category_tag", "")
    notes = "; ".join(d.get("important_notes", []))[:200]
    return (
        f"Disease: {d['name']}. "
        f"Category: {category}. "
        f"Symptoms: {symptoms}. "
        f"{('Notes: ' + notes) if notes else ''}"
    ).strip()


def medicine_text(d: dict) -> str:
    generic = ", ".join(d.get("generic_medicines", []))
    jana = ", ".join(
        m if isinstance(m, str) else m.get("name", "")
        for m in d.get("janaushadhi_medicines", [])
    )
    ayur = ", ".join(d.get("ayurvedic_medicines", []))
    return (
        f"Disease: {d['name']}. "
        f"Generic medicines: {generic or 'none'}. "
        f"JanAushadhi (generic affordable): {jana or 'none'}. "
        f"Ayurvedic alternatives: {ayur or 'none'}."
    )


def protocol_text(d: dict) -> str:
    notes = "; ".join(d.get("important_notes", []))
    india = d.get("india_specific", {})
    ref_level = india.get("referral_level", "") if isinstance(india, dict) else ""
    tests = ", ".join(d.get("tests", []))
    return (
        f"Disease: {d['name']}. "
        f"Referral level: {ref_level or 'PHC'}. "
        f"Recommended tests: {tests or 'none'}. "
        f"Clinical notes: {notes or 'standard ASHA protocol applies'}."
    )


# ── Qdrant upsert ──────────────────────────────────────────────────────────────

def upsert_batch(client, collection: str, ids: list, vectors: list, payloads: list):
    from qdrant_client.models import PointStruct
    points = [
        PointStruct(id=ids[i], vector=vectors[i], payload=payloads[i])
        for i in range(len(ids))
    ]
    client.upsert(collection_name=collection, points=points)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Lazy imports
    SentenceTransformer = require("sentence-transformers", "sentence_transformers").SentenceTransformer
    QdrantClient = require("qdrant-client", "qdrant_client").QdrantClient

    print("Loading encoder: all-MiniLM-L6-v2...")
    encoder = SentenceTransformer("all-MiniLM-L6-v2")

    print(f"Loading data: {DATA_FILE}")
    with open(DATA_FILE) as f:
        mapping = json.load(f)
    diseases = mapping["diseases"]
    print(f"  {len(diseases)} diseases loaded")

    print("Connecting to Qdrant Cloud...")
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_KEY)

    # ── disease_symptoms ──────────────────────────────────────────────────
    print("\nIngesting → disease_symptoms...")
    texts_ds = [disease_symptom_text(d) for d in diseases]
    payloads_ds = [
        {
            "disease_id": d["id"],
            "name": d["name"],
            "category": d.get("category_tag", ""),
            "symptoms": d.get("symptoms", []),
        }
        for d in diseases
    ]
    vectors_ds = encoder.encode(texts_ds, batch_size=BATCH_SIZE, show_progress_bar=True).tolist()
    upsert_batch(client, "disease_symptoms", list(range(len(diseases))), vectors_ds, payloads_ds)
    print(f"  Upserted {len(diseases)} disease-symptom records")

    # ── medicines ─────────────────────────────────────────────────────────
    print("\nIngesting → medicines...")
    texts_m = [medicine_text(d) for d in diseases]
    payloads_m = [
        {
            "disease_id": d["id"],
            "name": d["name"],
            "generic_medicines": d.get("generic_medicines", []),
            "janaushadhi_medicines": [
                m if isinstance(m, str) else m.get("name", "")
                for m in d.get("janaushadhi_medicines", [])
            ],
            "ayurvedic_medicines": d.get("ayurvedic_medicines", []),
        }
        for d in diseases
    ]
    vectors_m = encoder.encode(texts_m, batch_size=BATCH_SIZE, show_progress_bar=True).tolist()
    upsert_batch(client, "medicines", list(range(len(diseases))), vectors_m, payloads_m)
    print(f"  Upserted {len(diseases)} medicine records")

    # ── clinical_protocols ────────────────────────────────────────────────
    print("\nIngesting → clinical_protocols...")
    texts_cp = [protocol_text(d) for d in diseases]
    payloads_cp = [
        {
            "disease_id": d["id"],
            "name": d["name"],
            "tests": d.get("tests", []),
            "important_notes": d.get("important_notes", []),
            "india_specific": d.get("india_specific", {}),
        }
        for d in diseases
    ]
    vectors_cp = encoder.encode(texts_cp, batch_size=BATCH_SIZE, show_progress_bar=True).tolist()
    upsert_batch(client, "clinical_protocols", list(range(len(diseases))), vectors_cp, payloads_cp)
    print(f"  Upserted {len(diseases)} protocol records")

    # ── Summary ───────────────────────────────────────────────────────────
    print("\n=== Ingestion complete ===")
    for coll in COLLECTIONS.values():
        info = client.get_collection(coll)
        count = info.points_count
        print(f"  {coll}: {count} points")


if __name__ == "__main__":
    main()
