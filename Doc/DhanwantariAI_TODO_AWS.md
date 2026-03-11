# DhanwantariAI — TODO: AWS Label

> **Label:** `aws` / `cloud`  
> **Last Updated:** March 2026  
> **Status key:** ✅ Done | 🔄 Partial | ⏳ Pending | 🚫 Blocked

---

## Phase 3 — AWS Bedrock Escalation (All Tiers, Online Only)

> Cloud fallback for low-confidence queries. Target: resolves 20–25% of all queries.

| ID | Task | Status | Notes |
|---|---|---|---|
| P3.1 | Build `src/cloud/BedrockEscalationHandler.ts` | ⏳ | Check confidence threshold from `DiagnosisEngine`; auto-escalate if < 0.50, prompt user if 0.50–0.79 |
| P3.2 | PII stripping middleware | ⏳ | Remove patient name, ID, Aadhaar, address, phone before any cloud call — DPDP Act mandatory |
| P3.3 | PageIndex context bundler | ⏳ | Serialize retrieved PageIndex nodes + vector matches → include in Bedrock prompt (~1,700 tokens total) |
| P3.4 | AWS Bedrock integration | ⏳ | Model: `anthropic.claude-3-haiku-20240307-v1:0`, region: `ap-south-1` (Mumbai), IAM Role on Lambda — no keys in code |
| P3.5 | Bedrock Guardrails configuration | ⏳ | Configure in `ap-south-1`: deny surgery/prescription/diagnosis topics, PII redaction, drug dosage hallucination filter, contextual grounding score ≥ 0.75 |
| P3.6 | Public cloud last-resort fallback | ⏳ | Only if Bedrock unavailable (outage / rate limit) — Claude API / Amazon Titan; PII strip mandatory; log separately |
| P3.7 | Cost monitoring + usage log | ⏳ | Log all Bedrock/cloud calls with token counts, response latency, trigger reason — no PII in logs |
| P3.8 | Bedrock fallback chain | ⏳ | Step 1 on-device → Step 2 Bedrock Haiku (ap-south-1) → Step 3 public cloud — < 5% reaches Step 3 |

---

## Qdrant Cloud — Vector Database

> Free tier (1 GB). No EC2 / VPC / NAT required. Sufficient for Phase 1–3.

| ID | Task | Status | Notes |
|---|---|---|---|
| Q1 | Qdrant Cloud cluster provisioned | ✅ | Cluster: `46696dcb-3c39-41db-bab3-80d80027e898.eu-west-2-0.aws.cloud.qdrant.io`, Free tier |
| Q2 | Store credentials in `.env` | ✅ | `QDRANT_URL` + `QDRANT_API_KEY` in `DhanwantariMobile/.env` — never commit |
| Q3 | Create `disease_symptoms` collection | ⏳ | 384 dimensions (MiniLM L6 v2), ~50,000 vectors — disease-symptom semantic records |
| Q4 | Create `medicines` collection | ⏳ | 384 dimensions, ~80,000 vectors — JanAushadhi + Ayurvedic medicine records |
| Q5 | Create `clinical_protocols` collection | ⏳ | 384 dimensions, ~30,000 vectors — PageIndex node embeddings |
| Q6 | Build `src/retrieval/VectorSearch.ts` | ⏳ | Qdrant Cloud client using `@qdrant/js-client-rest`, fallback to LanceDB offline |
| Q7 | Ingest disease-symptom vectors | ⏳ | Run `ingest_vectors.py` on disease CSVs → embed with MiniLM L6 v2 TFLite → upload to Qdrant `disease_symptoms` |
| Q8 | Ingest medicines vectors | ⏳ | JanAushadhi + Ayurvedic datasets → embed → upload to Qdrant `medicines` |
| Q9 | Ingest clinical protocol vectors | ⏳ | PageIndex tree node text → embed → upload to Qdrant `clinical_protocols` |
| Q10 | Bundle MiniLM L6 v2 TFLite in APK | ⏳ | ~25 MB, 384-dim — same model for online (Qdrant) and offline (LanceDB) queries |
| Q11 | Wire Qdrant into `HybridRetrieval.ts` | ⏳ | Online path: Qdrant Cloud (50–150ms); offline path: LanceDB on-device |

---

## Phase 3-B — AWS Supporting Infrastructure

> Needed alongside Bedrock escalation for production-grade operation.

| ID | Task | Status | Notes |
|---|---|---|---|
| A1 | IAM Role for Lambda → Bedrock | ⏳ | Least-privilege IAM role: `bedrock:InvokeModel` + `bedrock:InvokeModelWithResponseStream` only, scoped to Haiku model ARN |
| A2 | Bedrock Guardrail resource setup | ⏳ | Create guardrail via AWS Console or CDK in `ap-south-1`; store `BEDROCK_GUARDRAIL_ID` in Secrets Manager |
| A3 | AWS Secrets Manager for Qdrant key | ⏳ | Store Qdrant API key in Secrets Manager (`ap-south-1`) — reference from Lambda env var, never hardcode |
| A4 | CloudWatch cost alert | ⏳ | Alert if Bedrock token spend exceeds ₹500/month; dashboard for query volume vs cost |
| A5 | Lambda proxy (optional) | ⏳ | Thin Lambda to relay app Bedrock calls — isolates app from direct SDK credentials, enables rate limiting |

---

## Phase 4 — Future AWS Services (Phase 4+)

| ID | Service | Task | Status | Notes |
|---|---|---|---|---|
| F1 | S3 `ap-south-1` | Create model update bucket | ⏳ | OTA model updates — `gemma3-1b-int4.gguf`, `gemma3-4b-int4.gguf`, LoRA adapters; presigned URLs, versioned |
| F2 | S3 | CORS + bucket policy | ⏳ | Allow app to download from S3 via presigned URL; block public listing |
| F3 | DynamoDB `ap-south-1` | Anonymised usage analytics table | ⏳ | Disease query frequency (no PII) — informs which diseases need more training data |
| F4 | CloudWatch Logs | Bedrock call monitoring | ⏳ | Token counts, latency, escalation triggers — no patient query text in logs |
| F5 | Cognito `ap-south-1` | Optional ANM/CHO user accounts | ⏳ | Phase 5 — sync user preferences only; zero patient data |

---

## AWS Architecture Constraints

| Constraint | Reason |
|---|---|
| All AWS resources in `ap-south-1` (Mumbai) | DPDP Act 2023 — data must not leave India |
| IAM Role only — no access keys in mobile app | Security best practice; Lambda acts as proxy |
| Bedrock Guardrails mandatory on every call | Medical application — hallucination prevention requirement |
| PII stripped before every cloud call | DPDP + patient safety |
| Stateless Bedrock calls — no query stored | One-way synthesis; no cloud retention of patient context |
| Qdrant on separate free-tier cluster (eu-west-2) | Disease/medicine embeddings only — no PII, no patient records |

---

## Cost Estimates

| Service | Estimate | Volume Assumption |
|---|---|---|
| Bedrock Claude 3 Haiku | ~₹0.004 per query | ~1,700 tokens input, 512 tokens output |
| Qdrant Cloud | ₹0 | Free tier 1 GB — sufficient for Phase 1–3 (~160K vectors at 384-dim) |
| S3 (Phase 4) | < ₹50/month | Model file hosting (~5 GB), presigned URL downloads |
| DynamoDB (Phase 4) | < ₹10/month | Anonymised analytics, low write volume |
| CloudWatch | < ₹5/month | Basic log ingestion |
| **Target at 1,000 escalated queries/day** | **~₹4/day · ₹120/month** | 20% escalation rate on 5,000 daily queries |

---

## Completed AWS Artefacts

| Artefact | Location | Status |
|---|---|---|
| `bedrock_inference_agent.py` | `DhanwantariAI/sync/bedrock_inference_agent.py` | ✅ Scaffolded |
| `bedrock_kb_agent.py` | `DhanwantariAI/sync/bedrock_kb_agent.py` | ✅ Scaffolded |
| `bedrock_sync_agent.py` | `DhanwantariAI/sync/bedrock_sync_agent.py` | ✅ Scaffolded |
| `client_sync_engine.py` | `DhanwantariAI/sync/client_sync_engine.py` | ✅ Scaffolded |
| `sync_manifest_schema.json` | `DhanwantariAI/sync/sync_manifest_schema.json` | ✅ Done |
| Qdrant cluster provisioned | eu-west-2 AWS cloud.qdrant.io | ✅ Done |

---

*DhanwantariAI — AppScale LLP (Satyam Kumar Das) · LLPIN: ACP-6024*
