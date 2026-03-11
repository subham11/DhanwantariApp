"""
AWS-P3.1: Create Qdrant Cloud collections for DhanwantariAI.

Collections:
  - disease_symptoms    (384-dim, Cosine) — disease/symptom embeddings
  - medicines           (384-dim, Cosine) — JanAushadhi + Ayurvedic medicine embeddings
  - clinical_protocols  (384-dim, Cosine) — WHO/ICMR/NHM protocol embeddings

Encoder: sentence-transformers/all-MiniLM-L6-v2 (384-dim)

Usage:
    python3 aws/qdrant_create_collections.py
"""

import urllib.request
import json
import sys

QDRANT_URL = (
    "https://46696dcb-3c39-41db-bab3-80d80027e898"
    ".eu-west-2-0.aws.cloud.qdrant.io:6333"
)
QDRANT_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJhY2Nlc3MiOiJtIn0"
    ".xnl7rtHTVwDTcAYcHXBnOCgiC87H2eR6S1eH5MpNjNE"
)
DIMS = 384


def qdrant_put(path: str, body: dict) -> dict:
    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{QDRANT_URL}{path}",
        data=payload,
        method="PUT",
        headers={
            "api-key": QDRANT_KEY,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def qdrant_get(path: str) -> dict:
    req = urllib.request.Request(
        f"{QDRANT_URL}{path}",
        headers={"api-key": QDRANT_KEY},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


COLLECTIONS = [
    "disease_symptoms",
    "medicines",
    "clinical_protocols",
]

print("Creating Qdrant collections (384-dim, Cosine)...")
errors = []
for name in COLLECTIONS:
    try:
        result = qdrant_put(
            f"/collections/{name}",
            {"vectors": {"size": DIMS, "distance": "Cosine"}},
        )
        status = result.get("result", result)
        print(f"  {name}: {status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        # 400 / 409 with "already exists" is fine
        if e.code in (400, 409) and "already exists" in body:
            print(f"  {name}: already exists (OK)")
        else:
            print(f"  {name}: ERROR {e.code} — {body}")
            errors.append(name)
    except Exception as exc:
        print(f"  {name}: UNEXPECTED ERROR — {exc}")
        errors.append(name)

# Verify
data = qdrant_get("/collections")
existing = [c["name"] for c in data.get("result", {}).get("collections", [])]
print(f"\nVerified collections on Qdrant Cloud: {existing}")

if errors:
    print(f"\nFailed collections: {errors}")
    sys.exit(1)
else:
    print("\nAll collections created successfully.")
