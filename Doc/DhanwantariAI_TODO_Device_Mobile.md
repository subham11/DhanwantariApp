# DhanwantariAI — TODO: Device / Mobile Label

> **Label:** `device` / `mobile`  
> **Last Updated:** March 2026  
> **Status key:** ✅ Done | 🔄 Partial | ⏳ Pending | 🚫 Blocked

---

## Phase 0 — Foundation (Highest Priority, Blocks Everything)

> Must be completed first — tier detection drives every subsequent device decision.

| ID | Task | Status | Notes |
|---|---|---|---|
| P0.1 | Build `src/ai/DeviceCapabilityDetector.ts` | ⏳ | RAM detection via `react-native-device-info`, storage check, tier assignment (TIER_1 / TIER_2 / TIER_3) |
| P0.2 | Tier persistence in AsyncStorage | ⏳ | Store assigned tier on first run, load on subsequent boots — never re-compute on same device |
| P0.3 | LLM opt-in prompt UI | ⏳ | Wi-Fi required banner, show download size (529 MB / 2.5 GB), decline option must leave app fully functional |
| P0.4 | Secure model download over Wi-Fi | ⏳ | OTA download, AES-256 device-bound encryption, progress indicator |
| P0.5 | Model integrity verification | ⏳ | SHA-256 hash check post-download before model is loaded |

---

## Phase 1 — PageIndex Core (Blocks All Tiers for Clinical Use)

> PageIndex is the clinical truth layer — blobked until done.

| ID | Task | Status | Notes |
|---|---|---|---|
| P1.1 | Run `build_pageindex.py` on all 8 source PDFs | ⏳ | WHO IMCI, WHO ANC, ICMR TB, ICMR Anaemia, NLEM 2022, NNF IMNCI, GINA Asthma, Ayurveda KB → produce 8 tree JSONs |
| P1.2 | Bundle all PageIndex JSONs in APK | ⏳ | Copy to `assets/pageindex/` — all 8 tree JSONs + `fts5_seed.json` |
| P1.3 | Run `ingest_vectors.py` | ⏳ | Populate LanceDB `core_medical` table from CSV disease datasets |
| P1.4 | Build `src/retrieval/HybridRetrieval.ts` | ⏳ | Orchestrate FTS5 + PageIndex + LanceDB + Qdrant queries into unified `RetrievalBundle` |
| P1.5 | SQLite FTS5 seed on first launch | ⏳ | Hydrate FTS5 tables from bundled `fts5_seed.json` on app init |
| P1.6 | Bundle MobileBERT TFLite intent router | ⏳ | `mobilebert-intent.tflite` (~25 MB) in APK, wire to `HybridRetrieval.ts` — routes query to correct PageIndex subtree |
| P1.7 | Build `src/ai/RuleEngine.ts` (Tier 1) | ⏳ | Deterministic clinical decision support — IMMEDIATE / URGENT / ROUTINE classification, ASHA referral logic, zero hallucination |
| P1.8 | Build `src/ai/DiagnosisEngine.ts` confidence scorer | ⏳ | Output `{ score: float, source: string, nodes: PageIndexNode[] }` — drives Bedrock escalation decision |
| P1.9 | Build `src/retrieval/PageIndexNavigator.ts` | ⏳ | JSON tree traversal for PageIndex subtrees |
| P1.10 | Build `src/retrieval/FTS5Search.ts` | ⏳ | SQLite FTS5 query interface — target < 5ms response |

---

## Phase 2 — LLM Integration (Tier 2 & Tier 3 On-Device Inference)

> Depends on P0 and P1 being complete.

| ID | Task | Status | Notes |
|---|---|---|---|
| P2.1 | Integrate `llama.rn` library | ⏳ | React Native bridge for on-device GGUF inference via llama.cpp |
| P2.2 | Build `src/ai/LLMEngine.ts` | ⏳ | Tier detection → model path selection → model loading → prompt assembly orchestrator |
| P2.3 | Implement prompt template | ⏳ | `[SYSTEM] + [PageIndex nodes] + [Vector results] + [Patient context] + [User query]` — LLM synthesises language only; never generates clinical facts from weights |
| P2.4 | Token limiter | ⏳ | Hard cap: 512 output tokens Tier 2, 1024 output tokens Tier 3 |
| P2.5 | Multi-turn conversation memory | ⏳ | 2–3 turns max Tier 2; unlimited within context window Tier 3 |
| P2.6 | Wire fine-tuned GGUF into app | ⏳ | `gemma3-1b-dhanwantari-ft-Q4_K_M.gguf` → integrate via `llama.rn` as Tier 2 primary model |
| P2.7 | Gemma 3 1B int4 (529 MB) as Tier 2 base model | ⏳ | Primary download option for Tier 2 users on Wi-Fi; 2,585 tok/s on Android |
| P2.8 | Gemma 3 4B int4 (~2.5 GB) as Tier 2 optional | ⏳ | Higher capability variant — prompted only if free disk > 3 GB and user opts in |
| P2.9 | LoRA adapter swapping | ⏳ | Downloadable language packs (Hindi, Odia, Marathi, Kannada) — post-launch Phase 5 |
| P2.10 | Expand QLoRA training to 5,000+ pairs | ⏳ | Currently 3,639 pairs across 22 diseases; add 9 remaining diseases + Hindi/Odia pairs |
| P2.11 | NPU-accelerated inference (Tier 3) | ⏳ | NNAPI acceleration on API level 27+, detect via `getApiLevel()` |

---

## Phase 4 — App Shell Completion

> Several screens exist as stubs — these tasks complete their functionality.

| ID | Task | Status | Notes |
|---|---|---|---|
| P4.1 | Complete Symptom Checker screen | ⏳ | 15 UI categories, 276+ symptoms — multi-select grouped picker with search |
| P4.2 | Patient context input | ⏳ | Age, gender, pregnancy toggle, chronic conditions — all feeds `DiagnosisEngine.ts` |
| P4.3 | Results screen | ⏳ | Top 3 diseases, risk badge (IMMEDIATE / URGENT / ROUTINE), red flag alerts, referral level display |
| P4.4 | Medicine Intelligence tab | ⏳ | JanAushadhi generic + Ayurvedic options side-by-side with MRP from bundled datasets |
| P4.5 | Referral guidance screen | ⏳ | PHC / CHC / FRU / Hospital routing with reasons — driven by Rule Engine output |
| P4.6 | LLM Q&A screen (Chat) | ⏳ | Tap disease → on-device chatbot (Tier 2/3) OR structured PageIndex answer (Tier 1) |
| P4.7 | Tier indicator badge | ⏳ | Subtle UI element showing current AI tier (T1 / T2 / T3) in header or status bar |
| P4.8 | Offline status banner | ⏳ | Persistent "Working offline" indicator when no network — clearly visible |
| P4.9 | LLM download progress screen | ⏳ | Progress bar, Wi-Fi status, cancel option, resume-after-interrupt support |

---

## Phase 5 — Language & Voice

| ID | Task | Status | Notes |
|---|---|---|---|
| P5.1 | Bhashini ASR integration | ⏳ | Voice input — Odia, Hindi, English via Govt. of India free API (`bhashini.gov.in`) |
| P5.2 | Bhashini TTS | ⏳ | Regional language voice output for diagnosis results |
| P5.3 | Translate UI labels to Odia + Hindi | ⏳ | `symptom_ui_groups.json` category labels, disease names, referral text |
| P5.4 | Downloadable LoRA language adapters | ⏳ | Hindi, Odia, Marathi, Kannada — tied to P2.9, download via Wi-Fi |
| P5.5 | Language pack manager screen | ⏳ | Download / delete / update language packs — show size and storage impact |
| P5.6 | Build `src/voice/BhashiniEngine.ts` | ⏳ | ASR + TTS orchestration via Bhashini API |

---

## Phase 6 — Privacy, Security & Compliance

| ID | Task | Status | Notes |
|---|---|---|---|
| P6.1 | DPDP Act 2023 compliance audit | ⏳ | Verify one-way cloud-to-device data flow; no patient PII ever leaves device unstripped |
| P6.2 | Cloud escalation consent screen | ⏳ | Explicit opt-in before any Bedrock / cloud escalation attempt |
| P6.3 | Local-only mode toggle | ⏳ | Block all network for maximum privacy — visible toggle in settings |
| P6.4 | SQLite AES-256 encryption | ⏳ | Use `op-sqlite` plugin for encrypted local database |
| P6.5 | Device binding for model files | ⏳ | Downloaded GGUF models cannot be extracted or copied to other devices |
| P6.6 | Local audit log | ⏳ | On-device-only record of all cloud escalations — timestamps only, zero PII |
| P6.7 | On-device response validator | ⏳ | Post-LLM check: block unsourced dosages, diagnosis claims, prescription language; append mandatory disclaimer |

---

## Key Files Still to Create

| File | Phase | Purpose |
|---|---|---|
| `src/ai/DeviceCapabilityDetector.ts` | P0.1 | Tier assignment at boot |
| `src/ai/LLMEngine.ts` | P2.2 | On-device model orchestration |
| `src/ai/DiagnosisEngine.ts` | P1.8 | TFLite symptom → ICD-10 + confidence scoring |
| `src/ai/RuleEngine.ts` | P1.7 | Deterministic referral / risk classification |
| `src/retrieval/HybridRetrieval.ts` | P1.4 | FTS5 + PageIndex + Qdrant / LanceDB |
| `src/retrieval/PageIndexNavigator.ts` | P1.9 | PageIndex JSON tree traversal |
| `src/retrieval/FTS5Search.ts` | P1.10 | SQLite FTS5 queries |
| `src/retrieval/VectorSearch.ts` | P1.4 | Qdrant Cloud + LanceDB fallback |
| `src/voice/BhashiniEngine.ts` | P5.6 | Bhashini ASR + TTS |

---

## Recommended Execution Order

```
P0 (Tier Detection) → P1 (PageIndex + Rule Engine) → P4 (App Shell) → P2 (LLM) → P5 (Voice) → P6 (Compliance)
```

---

*DhanwantariAI — AppScale LLP (Satyam Kumar Das) · LLPIN: ACP-6024*
