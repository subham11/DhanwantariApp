#!/usr/bin/env python3
"""
DhanwantariAI — Direct AWS Bedrock E2E Test Suite
Calls the Lambda proxy endpoint with clinical queries and validates responses.
"""
import json
import time
import urllib.request
import sys

PROXY_URL = "https://4fx87rqhze.execute-api.ap-south-1.amazonaws.com/prod/escalate"
MODEL_ID  = "anthropic.claude-3-haiku-20240307-v1:0"
REGION    = "ap-south-1"

SYSTEM_PROMPT = (
    "You are DhanwantariAI, a clinical decision support assistant for ASHA workers "
    "in rural India. Provide evidence-based clinical guidance aligned with India's "
    "National Health Mission protocols. Suggest JanAushadhi generic medicine "
    "alternatives with approximate INR prices. Recommend appropriate referral level "
    "(ASHA manage / PHC / CHC / FRU / Hospital). Respond clearly, concisely, and "
    "empathetically. Never make definitive diagnoses. Flag any IMMEDIATE red-flag "
    "symptoms at the top of your response."
)

# ── Test Cases ───────────────────────────────────────────────────────────

TESTS = [
    {
        "name": "T1 — Dengue danger signs",
        "query": "What are the danger signs of Dengue fever that an ASHA worker should watch for?",
        "expect_keywords": ["dengue", "bleeding", "vomiting", "referral", "danger"],
    },
    {
        "name": "T2 — TB DOTS side effects",
        "query": "What are TB DOTS medicine side effects I should watch for?",
        "expect_keywords": ["TB", "rifampicin", "isoniazid", "liver", "urine"],
    },
    {
        "name": "T3 — Fever in pregnancy",
        "query": "Fever in pregnancy — what to do?",
        "expect_keywords": ["pregnant", "fever", "doctor", "paracetamol"],
    },
    {
        "name": "T4 — Diabetes JanAushadhi meds",
        "query": "What JanAushadhi generic medicines are available for Type 2 Diabetes?",
        "expect_keywords": ["metformin", "JanAushadhi", "diabetes", "INR"],
    },
    {
        "name": "T5 — Emergency red-flag (chest pain)",
        "query": "Patient has severe chest pain radiating to left arm with sweating and breathlessness. What should I do?",
        "expect_keywords": ["emergency", "hospital", "immediately", "heart"],
    },
    {
        "name": "T6 — Hindi language query",
        "query": "मेरे बच्चे को तेज बुखार और शरीर पर लाल दाने हैं। क्या करना चाहिए?",
        "expect_keywords": ["बुखार", "बच्चे", "डॉक्टर"],
    },
    {
        "name": "T7 — Hypertension management",
        "query": "A 55 year old male with BP 160/100 and headache, what medicines and referral level?",
        "expect_keywords": ["amlodipine", "BP", "hypertension", "PHC"],
    },
]


def call_bedrock(query: str) -> dict:
    payload = json.dumps({
        "query": query,
        "modelId": MODEL_ID,
        "region": REGION,
        "messages": [{"role": "user", "content": query}],
        "system": SYSTEM_PROMPT,
        "max_tokens": 512,
    }).encode()

    req = urllib.request.Request(
        PROXY_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.monotonic()
    with urllib.request.urlopen(req, timeout=25) as resp:
        body = json.loads(resp.read().decode())
    body["latency_ms"] = int((time.monotonic() - t0) * 1000)
    return body


def check_keywords(answer: str, keywords: list[str]) -> tuple[list[str], list[str]]:
    lower = answer.lower()
    found   = [k for k in keywords if k.lower() in lower]
    missing = [k for k in keywords if k.lower() not in lower]
    return found, missing


def main():
    passed = 0
    failed = 0
    total_tokens = 0
    total_cost   = 0.0

    print("=" * 70)
    print("  DhanwantariAI — AWS Bedrock E2E Test Suite")
    print("=" * 70)
    print(f"  Endpoint : {PROXY_URL}")
    print(f"  Model    : {MODEL_ID}")
    print(f"  Region   : {REGION}")
    print(f"  Tests    : {len(TESTS)}")
    print("=" * 70)

    for i, test in enumerate(TESTS, 1):
        name = test["name"]
        query = test["query"]
        keywords = test["expect_keywords"]

        print(f"\n{'─' * 70}")
        print(f"  [{i}/{len(TESTS)}]  {name}")
        print(f"  Query: {query[:80]}{'...' if len(query) > 80 else ''}")
        print(f"{'─' * 70}")

        try:
            result = call_bedrock(query)
            answer = result.get("answer", "")
            latency = result.get("latency_ms", 0)
            inp_tokens = result.get("inputTokens", 0)
            out_tokens = result.get("outputTokens", 0)
            cost = result.get("queryCostUsd", 0)
            total_tokens += inp_tokens + out_tokens
            total_cost += cost

            found, missing = check_keywords(answer, keywords)
            status = "PASS" if len(missing) <= 1 else "FAIL"

            if status == "PASS":
                passed += 1
                marker = "✅"
            else:
                failed += 1
                marker = "❌"

            print(f"\n  {marker}  {status}  ({latency}ms, {inp_tokens}+{out_tokens} tokens, ${cost:.6f})")
            print(f"  Keywords found   : {', '.join(found) if found else '—'}")
            if missing:
                print(f"  Keywords missing : {', '.join(missing)}")
            # Print first 300 chars of answer
            preview = answer.replace("\n", " ")[:300]
            print(f"  Response preview : {preview}...")

        except Exception as e:
            failed += 1
            print(f"\n  ❌  ERROR: {e}")

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print(f"  RESULTS: {passed} passed, {failed} failed out of {len(TESTS)}")
    print(f"  Total tokens: {total_tokens}  |  Total cost: ${total_cost:.6f}")
    print(f"{'=' * 70}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
