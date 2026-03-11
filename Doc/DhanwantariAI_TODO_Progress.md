# DhanwantariAI — TODO Progress Tracker

> **Generated:** March 2026  
> **Based on:** `DhanwantariAI_Architecture_v2.2.md` — Production-Grade Clinical AI Architecture  
> **Status key:** ✅ Done | 🔄 Partial (needs upgrade) | ⏳ Pending | ❌ Not started

---

## Section 1 — Completed Artefacts

### Datasets & Training Data
- ✅ Disease profiles — 31 diseases (`disease_profiles.json`)
- ✅ Symptom registry — 276 symptoms (`symptom_registry.json`)
- ✅ Symptom UI groups — 15 categories (`symptom_ui_groups.json`)
- ✅ JanAushadhi drug mapping — 2,438 products (`janaushadhi_disease_mapping.json`)
- ✅ Ayurvedic disease mapping — ~6,000 records, 49 diseases (`ayurvedic_disease_mapping_deduped.json`)
- ✅ Symptom-disease mapping JSON — bundled in app (`src/assets/data/symptom_disease_mapping.json`)
- ✅ LLM training JSONL — 3,639 Q&A pairs, 22 diseases (`dhanwantari_train.jsonl`, `dhanwantari_val.jsonl`)
- ✅ Synthetic patient CSVs — 13 diseases × 1,000 records each
- ✅ Disease dataset Excel files — V1 through V10

### LLM Fine-Tuning
- ✅ QLoRA fine-tuning pipeline (`train.py`, `generate_finetune_dataset.py`, `fix_truncation.py`)
- ✅ Fine-tuned model — `gemma3-1b-dhanwantari-ft-Q4_K_M.gguf`
- ✅ Hindi language training data (`training_data/lang/hi/`)

### Sync / Cloud Agents (Python)
- ✅ `bedrock_inference_agent.py`
- ✅ `bedrock_kb_agent.py`, `bedrock_sync_agent.py`
- ✅ `client_sync_engine.py`
- ✅ `sync_manifest_schema.json`, `model_variants.json`

### Mobile App — Screens
- ✅ `ChatScreen.tsx` — updated: device tier badge in GlassHeader subtitle
- ✅ `SymptomCheckerScreen.tsx`
- ✅ `SymptomAnalysisScreen.tsx` — updated: RuleEngine risk banner, per-card Medicine + Referral CTAs
- ✅ `ClassificationsScreen.tsx`, `CategoryDiseasesScreen.tsx`
- ✅ `ProfileListScreen.tsx`, `NewProfileScreen.tsx`
- ✅ `MedicineScreen.tsx` (new) — Generic / JanAushadhi / Ayurvedic sections
- ✅ `ReferralGuidanceScreen.tsx` (new) — risk/referral badges, 108/104 call buttons, action checklist
- ✅ `RootNavigator.tsx` — `MedicineDetail` + `ReferralGuidance` routes added

### Mobile App — Core Infrastructure
- ✅ `src/config.ts` — all env keys, confidence thresholds, collection names
- ✅ `src/store/types.ts` — `DeviceTier`, `DeviceProfile`, `RuleEngineResult`, `ReferralLevel`, `RiskLevel`, `DiagnosisResult`, `RetrievalBundle`, param types
- ✅ `src/store/deviceSlice.ts` + wired into `store.ts` + `index.ts`
- ✅ `src/services/db.ts`, `llmApi.ts`, `offlineFallback.ts`, `reportIndexer.ts`, `syncEngine.ts`
- ✅ `App.tsx` — calls `detectDeviceCapability()` on startup, dispatches `setDeviceProfile`

### Mobile App — AI / Retrieval / Cloud Layer
- ✅ `src/ai/DeviceCapabilityDetector.ts` — **5-signal** (cpuArch, nnApiSupported, apiLevel, RAM, freeDisk), cache v2, ARM64 force-Tier-1 logic
- ✅ `src/ai/ClinicalSafetyEngine.ts` (new) — 18 typed `RedFlagRule[]` (RF001–RF018), `evaluateSafety()`, suppressLLM on CRITICAL
- 🔄 `src/ai/RuleEngine.ts` — flat string arrays; consider upgrade to typed `RedFlagRule` struct with full ICD-10 refs (ClinicalSafetyEngine supersedes for v2.2)
- ✅ `src/retrieval/FTS5Search.ts` — bug fix: `await db.execute()`
- ✅ `src/retrieval/PageIndexNavigator.ts`
- ✅ `src/retrieval/VectorSearch.ts` — bug fix: `topK: number` type; Qdrant Cloud (online only)
- ✅ `src/retrieval/HybridRetrieval.ts` — upgraded to use `ConfidenceScorer` + `ResultReconciler` (6-signal)
- ✅ `src/ai/DiagnosisEngine.ts` — Step 0 wires `evaluateSafety()` first; `suppressLLM` blocks Bedrock on CRITICAL
- ✅ `src/cloud/BedrockEscalationHandler.ts` — proxy-only mode; PIIStripper wired (`stripPII()` before every cloud call)
- ✅ `src/cloud/PIIStripper.ts` (new) — 6 regex patterns, Aadhaar/phone/PIN/name/village
- ✅ `src/cloud/LLMEngine.ts` — 4-tier routing (on-device stub → local → Bedrock → offline)
- ✅ `src/confidence/ConfidenceScorer.ts` (new) — 6-signal scorer (weights sum = 1.0)
- ✅ `src/confidence/ResultReconciler.ts` (new) — 3-way agreement + conflict detection
- ✅ `src/privacy/ConsentManager.ts` (new) — advisory_acknowledgement + cloud_escalation, versioned, AsyncStorage
- ✅ `src/liability/SourceCitationEngine.ts` (new) — citeSources(), citeRuleSources(), GeneratedBy
- ✅ `src/liability/DisclaimerManager.ts` (new) — 6 disclaimer strings
- ✅ `src/liability/AuditLogger.ts` (new) — 500-entry local log, no PII
- ✅ `src/features/consent/ConsentScreen.tsx` (new) — CDSCO/DPDP advisory, blocks clinical navigation
- ✅ `src/navigation/RootNavigator.tsx` — ConsentScreen added, `initialRouteName` from Redux `consentGranted`
- ✅ `App.tsx` — consent state restored from AsyncStorage on startup, dispatched to Redux
- ✅ `src/store/deviceSlice.ts` — `consentGranted: boolean` + `setConsentGranted` reducer added
- ✅ `src/store/types.ts` — `CpuArch`, `RedFlagRule`, `SafetyEvaluation`, `ConsentRecord`, `AuditEntry`, `Consent` route
- ✅ `src/theme/tokens.ts` — semantic `Spacing` (xs/sm/md/lg/xl/2xl/3xl) + `Colors.error` alias
- ✅ `src/config.ts` — confidence thresholds updated (HIGH→0.85, MEDIUM→0.70, AUTO_ESCALATE→0.55, VERY_LOW=0.40)
- ✅ `babel.config.js` + `tsconfig.json` — aliases: `@ai`, `@retrieval`, `@cloud`, `@config`, `@confidence`, `@privacy`, `@liability`
- ✅ `src/features/referral/ReferralGuidanceScreen.tsx` — emergency lock on IMMEDIATE: BackHandler block, pinned confirm bar, DisclaimerManager.emergency banner

---

## Section 2 — Mobile TODO (v2.2 Aligned)

### 🔴 P0 — Safety-Critical Upgrades ✅ ALL COMPLETE

| ID | Task | File | Status |
|---|---|---|---|
| **P0.1** | Upgrade `DeviceCapabilityDetector.ts` to 5-signal | `src/ai/DeviceCapabilityDetector.ts` | ✅ Done |
| **P0.2** | Build `ClinicalSafetyEngine.ts` (18 rules) + wire as Step 0 in DiagnosisEngine | `src/ai/ClinicalSafetyEngine.ts` | ✅ Done |
| **P0.3** | Build `PIIStripper.ts` + wire to BedrockEscalationHandler | `src/cloud/PIIStripper.ts` | ✅ Done |
| **P0.4** | Build `ConsentManager.ts` + `ConsentScreen.tsx` | `src/privacy/ConsentManager.ts` | ✅ Done |
| **P0.5** | Emergency screen lock on CRITICAL / IMMEDIATE risk | `ReferralGuidanceScreen.tsx` | ✅ Done |

---

### 🟡 P1 — Confidence Scoring Upgrade ✅ ALL COMPLETE

| ID | Task | File | Status |
|---|---|---|---|
| **P1.1** | Build `ConfidenceScorer.ts` (6-signal) | `src/confidence/ConfidenceScorer.ts` | ✅ Done |
| **P1.2** | Build `ResultReconciler.ts` | `src/confidence/ResultReconciler.ts` | ✅ Done |
| **P1.3** | Update confidence thresholds | `src/config.ts` | ✅ Done |

---

### 🟡 P2 — Liability & Audit Layer ✅ ALL COMPLETE

| ID | Task | File | Status |
|---|---|---|---|
| **P2.1** | Build `SourceCitationEngine.ts` | `src/liability/SourceCitationEngine.ts` | ✅ Done |
| **P2.2** | Build `DisclaimerManager.ts` | `src/liability/DisclaimerManager.ts` | ✅ Done |
| **P2.3** | Build `AuditLogger.ts` | `src/liability/AuditLogger.ts` | ✅ Done |

---

### 🟡 P3 — Retrieval Layer Expansion

| ID | Task | File | v2.2 Ref |
|---|---|---|---|
| **P3.1** | Build 8 PageIndex JSON trees | `assets/pageindex/*.json` | §7.2 |
| | → `who_imci_tree.json`, `who_anc_tree.json`, `icmr_tb_tree.json`, `icmr_anaemia_tree.json` | | |
| | → `nlem_2022_tree.json`, `nnf_imnci_tree.json`, `gina_asthma_tree.json`, `ayurveda_kb_tree.json` | | |
| | → Build/extend `scripts/build_pageindex.py` to parse source PDFs | | |
| **P3.2** | Integrate LanceDB for Tier 2/3 offline vectors | `src/retrieval/VectorSearch.ts` | §5.1, §7.1 |
| | → LanceDB local table `core_medical` (~80–100 MB) for offline Tier 2/3 | | |
| | → `VectorSearch.ts` to route: online → Qdrant Cloud, offline → LanceDB | | |
| | → `scripts/ingest_vectors.py` to populate LanceDB from CSV datasets | | |
| **P3.3** | FTS5 seed on first launch | `src/services/db.ts` | §7.1 |
| | → Hydrate `chunks_fts` table from `assets/pageindex/fts5_seed.json` on first boot | | |

---

### 🟡 P4 — Bedrock Cost & Rate Controls (AWS — Mobile-Side)

| ID | Task | File | v2.2 Ref |
|---|---|---|---|
| **P4.1** | Wire `BedrockCostController` checks into `BedrockEscalationHandler.ts` | `src/cloud/BedrockEscalationHandler.ts` | §9.2 |
| | → Check `canEscalate()` before every proxy call | | |
| | → If `daily_limit` or `budget_exceeded`: degrade to PageIndex-only answer, show message | | |
| **P4.2** | Build `DataErasure.ts` | `src/privacy/DataErasure.ts` | §12.3 |
| | → `clearAllPatientData()` — wipes sessions, symptom entries, device profile cache, consent record, audit log | | |
| | → Accessible from profile settings screen | | |

---

### 🟢 P5 — On-Device Guards & Response Integrity

| ID | Task | File | v2.2 Ref |
|---|---|---|---|
| **P5.1** | Build `OnDeviceGuardrails.ts` | `src/guardrails/OnDeviceGuardrails.ts` | §24 |
| | → Block LLM output if it contains dosage numbers not in NLEM 2022 | | |
| | → Block LLM output if it directly contradicts a fired `RedFlagRule` | | |
| **P5.2** | Build `ResponseValidator.ts` | `src/guardrails/ResponseValidator.ts` | §24 |
| | → Validate every response has: disclaimer, source citation, `generatedBy` tag | | |
| | → Run after LLM/Bedrock response, before display | | |

---

### 🟢 P6 — LLM On-Device Integration

| ID | Task | File | v2.2 Ref |
|---|---|---|---|
| **P6.1** | Integrate `llama.rn` | `package.json` + `src/cloud/LLMEngine.ts` | §5.2 |
| | → Replace stub in `LLMEngine.ts` Tier 1 path with actual `llama.rn` inference | | |
| | → Wire `gemma3-1b-dhanwantari-ft-Q4_K_M.gguf` as default Tier 2 model | | |
| **P6.2** | LLM opt-in download UX screen | `src/features/settings/LLMDownloadScreen.tsx` | §5.2 |
| | → Wi-Fi-only gate, show model size (529 MB / 2.5 GB), download progress, decline option | | |
| | → SHA-256 integrity check post-download; AES-256 device-bound encryption | | |
| | → Store download state in `deviceSlice` (`llmDownloaded`, `llmDownloadProgress`) — already scaffolded | | |
| **P6.3** | MobileBERT TFLite intent router for Tier 2/3 | `src/ai/IntentRouter.ts` | §5.1 |
| | → Bundle `mobilebert-intent.tflite` (~25 MB) in APK | | |
| | → Used for Tier 2/3 intent routing; Tier 1 stays FTS5 keyword | | |

---

### 🔵 P7 — Multilingual Layer

| ID | Task | File | v2.2 Ref |
|---|---|---|---|
| **P7.1** | Build `local_terms_hi.json` + `local_terms_or.json` | `assets/lang/` | §13.3 |
| | → Hindi: peeliya, dimagi bukhaar, haathipaon, kala azar, rataundhi, daad, etc. | | |
| | → Odia: julo jwara, banta roga, etc. | | |
| **P7.2** | Build `LocalTermNormalizer.ts` | `src/language/LocalTermNormalizer.ts` | §13.2 |
| | → Exact match → fuzzy (Levenshtein ≤ 2) → phonetic (Soundex) lookup | | |
| **P7.3** | Build `MedicalOntologyMapper.ts` | `src/language/MedicalOntologyMapper.ts` | §13.2 |
| | → Normalised local term → ICD-10 code + canonical symptom registry ID | | |
| **P7.4** | Bhashini ASR + TTS | `src/language/BhashiniEngine.ts` | §22.5 |
| | → Voice input for Odia, Hindi, English — Govt. free API | | |
| | → TTS for reading results aloud | | |
| **P7.5** | Downloadable LoRA language adapters | Phase 5 | §13.4 |
| | → Hindi, Odia (Phase 1); Marathi, Kannada, Bengali (Phase 5) — ~150 MB each | | |

---

### 🔵 P8 — KB Patch & Model Governance

| ID | Task | File | v2.2 Ref |
|---|---|---|---|
| **P8.1** | Build `KBUpdateManager.ts` | `src/kb/KBUpdateManager.ts` | §15.2 |
| | → Wi-Fi-only update check, compare local vs. S3 `kb_manifest.json` | | |
| | → Atomic swap (not overwrite) — old version always preserved | | |
| | → SHA-256 + medical authority signature verification on every patch | | |
| **P8.2** | Build `ModelRollbackManager.ts` | `src/kb/ModelRollbackManager.ts` | §16.2 |
| | → Keep `model.gguf.prev` alongside active model | | |
| | → Atomic rename rollback with integrity verification | | |
| **P8.3** | Build `ObservabilityEngine.ts` | `src/telemetry/ObservabilityEngine.ts` | §17 |
| | → Session metrics: `queryCount`, `confidenceScores[]`, `escalationCount`, `redFlagsTriggered`, latency arrays | | |
| | → CloudWatch metric push (anonymised, consent-gated) | | |
| **P8.4** | Build `FeedbackCollector.ts` | `src/feedback/FeedbackCollector.ts` | §20.1 |
| | → 👍/👎 after each response — anonymised miss-flag stored locally | | |
| | → Supervisor feedback channel (`SupervisorFeedback` struct) | | |

---

### 🔵 P9 — Dataset Completion

| ID | Task | Notes | v2.2 Ref |
|---|---|---|---|
| **P9.1** | Expand disease profiles to 145 diseases | Currently 31; target from DS001 annotation | §25 DS008 |
| **P9.2** | Validate all symptom-disease mappings | Cross-check 1,108 mappings against ICMR/WHO sources | §14.2 |
| **P9.3** | Refresh JanAushadhi to PMBJP 2024 edition | DS003 next review Sep 2026 | §14.3 |
| **P9.4** | Expand LLM training JSONL to 5,000+ pairs | Add 9 diseases, Hindi/Odia pairs | §25 DS005 |
| **P9.5** | Build `local_term_dictionary.json` (DS007) | AppScale + NHM community validation | §13.3 |
| **P9.6** | `run_benchmark.py` — 200-vignette clinical eval | 50 pediatric / 50 maternal / 50 infectious / 30 NCD / 20 emergency | §18.2 |
| **P9.7** | Red flag rules 100% pass rate test | All 18 RF rules must fire on correct vignettes | §18.2 |

---

## Section 3 — AWS TODO (v2.2 Aligned)

### 🔴 AWS-P0 — Proxy Lambda ✅ ALL COMPLETE

| ID | Task | Notes | Status |
|---|---|---|---|
| **AWS-P0.1** | Lambda `DhanwantariBedrockProxy` | Python 3.12, 256 MB, 29s timeout. POST /escalate → Claude 3 Haiku. Returns `{answer, inputTokens, outputTokens, model, queryCostUsd}` | ✅ Done |
| | ARN: `arn:aws:lambda:ap-south-1:034250960622:function:DhanwantariBedrockProxy` | | |
| **AWS-P0.2** | IAM Role `DhanwantariBedrockLambdaRole` | Least privilege: bedrock:InvokeModel on Haiku only, DynamoDB CRUD, CloudWatch PutMetricData, SecretsManager GetSecretValue | ✅ Done |
| | ARN: `arn:aws:iam::034250960622:role/DhanwantariBedrockLambdaRole` | | |
| **AWS-P0.3** | API Gateway HTTP API `DhanwantariProxyAPI` | HTTPS, POST /escalate, prod stage, 50 RPS throttle | ✅ Done |
| | URL: `https://4fx87rqhze.execute-api.ap-south-1.amazonaws.com/prod/escalate` | | |
| **AWS-P0.4** | Certificate pinning in mobile | `react-native-ssl-pinning` installed. Pinned: Amazon RSA 2048 M03 (intermediate, exp Aug 2030). Cert bundled iOS + Android. `BedrockEscalationHandler.ts` uses `sslFetch`. | ✅ Done |
| | SPKI leaf: `CifvBerUQV7ploNbeZW/B1JMrqpNm5r+01B0EeMHkn4=` (exp Aug 2026) | | |
| | SPKI intermediate: `vxRon/El5KuI4vx5ey1DgmsYmRY0nDd5Cg4GfJ8S+bg=` (exp Aug 2030) | | |

---

### 🟡 AWS-P1 — Rate Limiting & Cost Control ✅ ALL COMPLETE

| ID | Task | Notes | Status |
|---|---|---|---|
| **AWS-P1.1** | `BedrockCostController` in Lambda | DynamoDB `bedrock_usage` PAY_PER_REQUEST. Daily cap 10,000 queries + $15/month budget. Atomic increment. TTL on records. | ✅ Done |
| | ARN: `arn:aws:dynamodb:ap-south-1:034250960622:table/bedrock_usage` | | |
| **AWS-P1.2** | Server-side PII strip in Lambda | 5-pattern regex: Aadhaar (16-digit), phone (10-digit +91), PIN code, names, village tokens. Defence-in-depth (app also strips). | ✅ Done |
| **AWS-P1.3** | Bedrock Guardrail `DhanwantariGuardrail` | Deny off-topic, word filter ("I diagnose", "I prescribe"), PII anonymisation (PHONE/NAME/ADDRESS/EMAIL/PIN). ID: `4kvilnflnw3o` | ✅ Done |

---

### 🟡 AWS-P2 — Observability ✅ ALL COMPLETE

| ID | Task | Notes | Status |
|---|---|---|---|
| **AWS-P2.1** | CloudWatch metrics | Emitting: `DhanwantariAI/EscalationRate`, `BedrockCost`, `BedrockLatencyMs`, `BedrockInvokeError` from Lambda | ✅ Done |
| **AWS-P2.2** | CloudWatch alarms × 3 | HighEscalationRate (>40%), BedrockCostSpike (>$3/7d), BedrockErrors (>10/5m) → SNS `DhanwantariAlerts` | ✅ Done |
| | SNS ARN: `arn:aws:sns:ap-south-1:034250960622:DhanwantariAlerts` | | |
| **AWS-P2.3** | Lambda structured logging | `{event, queryCost, inputTokens, outputTokens, patientTier, latencyMs, model, timestamp}` — no PII | ✅ Done |

---

### 🟡 AWS-P3 — Qdrant Cloud Setup ✅ ALL COMPLETE

| ID | Task | Notes | Status |
|---|---|---|---|
| **AWS-P3.1** | Create Qdrant collections | `disease_symptoms`, `medicines`, `clinical_protocols` — all 384-dim, Cosine distance, on Qdrant Cloud (eu-west-2) | ✅ Done |
| **AWS-P3.2** | Seed Qdrant via `ingest_vectors.py` | 146 diseases × 3 collections = 438 vectors. MiniLM-L6-v2 encoder. Idempotent upsert. | ✅ Done |
| **AWS-P3.3** | Qdrant API key → Android Keystore | Note: Key is a JWT — store at runtime via Android Keystore API. Key is NOT in `.env` or APK. `VectorSearch.ts` reads via RN secure storage. | ✅ Documented |
| **AWS-P3.4** | Qdrant API key → Secrets Manager | Secret `DhanwantariAI/QdrantApiKey` created. IAM policy `DhanwantariSecretsReadPolicy` added to Lambda role. | ✅ Done |
| | Secrets Manager ARN: `arn:aws:secretsmanager:ap-south-1:034250960622:secret:DhanwantariAI/QdrantApiKey-zHAgmc` | | |


---

### 🔵 AWS-P4 — S3 KB Patch Infrastructure (Phase 4)

| ID | Task | Notes | v2.2 Ref |
|---|---|---|---|
| **AWS-P4.1** | S3 bucket `dhanwantari-kb-patches` in `ap-south-1` | Versioned, server-side AES-256 encryption, no public access | §15.1 |
| **AWS-P4.2** | `kb_manifest.json` schema + deployment pipeline | Semantic versioning, SHA-256 per component, `min_app_version` gate | §15.3 |
| **AWS-P4.3** | Medical authority signing key | Sign KB patches; mobile verifies signature before applying | §15.2 |
| **AWS-P4.4** | S3 presigned URL distribution via Lambda | Lambda generates presigned URLs (never expose S3 bucket directly) | §15.1 |

---

### 🔵 AWS-P5 — DynamoDB Analytics (Phase 4)

| ID | Task | Notes | v2.2 Ref |
|---|---|---|---|
| **AWS-P5.1** | `dhanwantari_usage` DynamoDB table | Anonymised session metrics: tier distribution, escalation rates, confidence distribution | §17.2 |
| **AWS-P5.2** | Lambda → DynamoDB write from consent-gated telemetry | Only when user has granted `anonymous_analytics` consent | §12.2 |

---

### 🔵 AWS-P6 — Regulatory & Phase 2 Prep

| ID | Task | Notes | v2.2 Ref |
|---|---|---|---|
| **AWS-P6.1** | Bedrock model access request for Claude Haiku in `ap-south-1` | Submit through AWS console — not enabled by default | §9.1 |
| **AWS-P6.2** | VPC endpoint for Bedrock | Private network routing from Lambda → Bedrock, no public internet | §11.3 |
| **AWS-P6.3** | CloudTrail audit logging | All API Gateway + Lambda + Bedrock calls logged for CDSCO SaMD audit trail | §10.3 |
| **AWS-P6.4** | WAF rules on API Gateway | Rate limiting per `device_id` header, block SQL injection, block anomalous payloads | §11.2 |

---

## Section 4 — Priority Order (v2.2 Revised)

```
Mobile P0 (Safety-critical fixes)
    └── P0.1 DeviceCapabilityDetector upgrade (5-signal)
    └── P0.2 ClinicalSafetyEngine refactor (typed rules, first-call enforcement)
    └── P0.3 PIIStripper.ts
    └── P0.4 ConsentManager.ts + consent screen
    └── P0.5 Emergency screen lock

AWS P0 (Proxy Lambda — blocks all Bedrock)
    └── AWS-P0.1 NestJS Lambda proxy
    └── AWS-P0.2 IAM role
    └── AWS-P0.3 API Gateway
    └── AWS-P3.1 Qdrant collections

↓ Both P0 tracks can run in parallel ↓

Mobile P1 (Confidence upgrade)
    └── ConfidenceScorer.ts (6-signal) + ResultReconciler.ts + Config threshold update

Mobile P2 (Liability layer)
    └── SourceCitationEngine + DisclaimerManager + AuditLogger

AWS P1 (Rate limiting + Guardrails)
    └── BedrockCostController + PII strip + Guardrails config

Mobile P3 (Retrieval expansion)
    └── 8 PageIndex trees + LanceDB Tier 2/3 + FTS5 seed

Mobile P4 (Bedrock cost controls wired)
    └── Wire canEscalate() + DataErasure.ts

Mobile P5–P6 (Guards + LLM integration)
    └── OnDeviceGuardrails + ResponseValidator + llama.rn

Mobile P7 (Multilingual)
    └── LocalTermNormalizer + MedicalOntologyMapper + Bhashini

Mobile P8 (KB governance)
    └── KBUpdateManager + ModelRollbackManager + Observability + Feedback

Mobile P9 + AWS P4–P5 (Dataset + S3 patches + Analytics)
    └── 145 diseases + benchmarks + OTA patch system

AWS P6 (Regulatory hardening)
    └── VPC endpoint + CloudTrail + WAF + CDSCO prep
```

---

## Section 5 — Files Still to Create (Full List)

### Mobile (`src/`)

| File | Phase | Notes |
|---|---|---|
| `src/ai/ClinicalSafetyEngine.ts` | P0.2 | Replaces/upgrades `RuleEngine.ts` with 18 typed rules |
| `src/cloud/PIIStripper.ts` | P0.3 | PII removal before any cloud call |
| `src/privacy/ConsentManager.ts` | P0.4 | DPDP consent flow |
| `src/privacy/DataErasure.ts` | P4.2 | Right to erasure |
| `src/confidence/ConfidenceScorer.ts` | P1.1 | 6-signal weighted confidence |
| `src/confidence/ResultReconciler.ts` | P1.2 | Agreement/conflict detection |
| `src/liability/SourceCitationEngine.ts` | P2.1 | Per-response source citations |
| `src/liability/DisclaimerManager.ts` | P2.2 | Centralised disclaimers |
| `src/liability/AuditLogger.ts` | P2.3 | No-PII audit trail |
| `src/guardrails/OnDeviceGuardrails.ts` | P5.1 | Block unsafe LLM output |
| `src/guardrails/ResponseValidator.ts` | P5.2 | Validate citation + disclaimer presence |
| `src/ai/IntentRouter.ts` | P6.3 | MobileBERT Tier 2/3 intent routing |
| `src/features/settings/LLMDownloadScreen.tsx` | P6.2 | LLM opt-in download UX |
| `src/language/LocalTermNormalizer.ts` | P7.2 | Hindi/Odia → medical ontology |
| `src/language/MedicalOntologyMapper.ts` | P7.3 | Term → ICD-10 + symptom ID |
| `src/language/BhashiniEngine.ts` | P7.4 | Voice I/O |
| `src/kb/KBUpdateManager.ts` | P8.1 | OTA KB patch system |
| `src/kb/ModelRollbackManager.ts` | P8.2 | Model version rollback |
| `src/telemetry/ObservabilityEngine.ts` | P8.3 | Session metrics + CloudWatch push |
| `src/feedback/FeedbackCollector.ts` | P8.4 | 👍/👎 feedback loop |

### AWS / Backend

| File | Phase | Notes |
|---|---|---|
| `lambda/src/main.ts` | AWS-P0.1 | NestJS Lambda — Bedrock proxy entry |
| `lambda/src/bedrock.service.ts` | AWS-P0.1 | Claude Haiku invocation |
| `lambda/src/cost-controller.service.ts` | AWS-P1.1 | Daily/monthly caps, DynamoDB counter |
| `lambda/src/pii-stripper.service.ts` | AWS-P1.2 | Server-side PII defence-in-depth |
| `lambda/src/telemetry.service.ts` | AWS-P2.1 | CloudWatch metrics push |
| `scripts/ingest_vectors.py` | AWS-P3.2 | Embed + upsert to Qdrant |
| `scripts/build_pageindex.py` | P3.1 | PDF → PageIndex tree JSON |
| `scripts/run_benchmark.py` | P9.6 | 200-vignette clinical evaluation |

---

*Last updated: March 2026 — AppScale LLP (Satyam Kumar Das)*  
*Architecture basis: `DhanwantariAI_Architecture_v2.2.md`*  
*LLPIN: ACP-6024 | appscale.in | Bengaluru, India*
