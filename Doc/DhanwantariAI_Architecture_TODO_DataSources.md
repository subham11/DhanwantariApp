# DhanwantariAI — Architecture, TODO & Data Sources Master Reference

> **Version:** v2.0 — Hybrid On-Device + AWS Bedrock Architecture  
> **Owner:** AppScale LLP (Satyam Kumar Das)  
> **Last Updated:** March 2026  
> **Tagline:** *Ancient Name. Modern Intelligence.*

---

## 1. Device Capability Architecture

### 1.1 Tier Detection at Boot

At first launch, the app detects the device's RAM, available storage, and CPU/NPU capability and assigns a permanent tier. This drives all subsequent AI stack decisions.

```
App Boot
    │
    ▼
DeviceCapabilityDetector
    │
    ├── RAM < 2 GB   ──→  TIER 1
    ├── RAM 2–6 GB   ──→  TIER 2
    └── RAM ≥ 8 GB   ──→  TIER 3
```

---

### 1.2 Tier Definitions

| | **Tier 1** | **Tier 2** | **Tier 3** |
|---|---|---|---|
| **RAM** | < 2 GB | ~3–6 GB | 8 GB+ |
| **Storage** | Any | 16–64 GB | 64 GB+ |
| **Typical Devices** | Old budget Androids (most ASHA phones) | Redmi Note 10, Realme 8, Samsung A23 | Redmi Note 12 Pro, Samsung A54, Realme GT |
| **LLM** | ❌ None | ✅ Optional user download | ✅ Optional user download |
| **Model** | — | Gemma 3B / Phi-3 Mini INT4 (~2.0–2.5 GB) | Llama 3.2 7B / Gemma 7B INT4 (~4.0–4.5 GB) |
| **PageIndex** | ✅ Always | ✅ Always | ✅ Always |
| **SQLite FTS5** | ✅ Always | ✅ Always | ✅ Always |
| **LanceDB RAG** | ✅ Always | ✅ Always | ✅ Always |
| **Multi-turn** | ❌ | ⚠️ 2–3 turns max | ✅ 2048+ token context |
| **Bedrock Escalation** | ✅ (when online) | ✅ (when online) | ✅ (when online) |

---

### 1.3 Tier 1 — PageIndex Only (< 2 GB RAM)

**No LLM. Fully deterministic. Always auditable.**

- PageIndex tree navigation (WHO IMCI, ICMR, NLEM, Ayurveda KB)
- SQLite FTS5 structured queries — `< 5ms`
- MobileBERT TFLite (~25 MB) for query intent routing only
- Rule engine for ASHA clinical decision support
- 100% offline — no network required for any functionality
- Bhashini ASR for voice input when online

> **Design intent:** This covers the worst-case ASHA worker device. Zero hallucination risk — all answers come from pre-indexed clinical protocol documents, not a generative model.

---

### 1.4 Tier 2 — PageIndex + User-Opt-In LLM (~4 GB RAM)

**LLM is a user choice, not automatic.**

- All Tier 1 capabilities intact
- User sees a prompt on first launch: *"Download AI Assistant (2.3 GB)? Requires Wi-Fi."*
- User can decline — app works fully without LLM via PageIndex
- If accepted: Gemma 3B / Phi-3 Mini INT4 downloaded over Wi-Fi, device-bound, AES-256 encrypted
- LLM reads PageIndex retrieved nodes as its context — **LLM summarises; PageIndex is the truth**
- Max 512 tokens per response, confidence scored
- Token limit: aggressive quantization, max 2–3 turn memory

> **Key principle:** LLM never generates clinical facts from its own weights. It only synthesises language on top of what PageIndex retrieves.

---

### 1.5 Tier 3 — PageIndex + Full LLM (8 GB+ RAM)

**Full reasoning capability for ANM/supervisor-level workers.**

- All Tier 2 capabilities intact
- Llama 3.2 7B / Gemma 7B INT4 (~4.0–4.5 GB) downloaded post-install
- 2048+ token context window
- Light multi-turn reasoning
- NPU-accelerated inference
- Same PageIndex grounding applies — LLM extends, not replaces

---

### 1.6 Cloud Fallback — AWS Bedrock (All Tiers, Online Only)

```
Confidence Score
    │
    ├── ≥ 0.80  →  Answer locally. No cloud call.
    ├── 0.50–0.79  →  Show answer + disclaimer + "Get verified answer" button → Bedrock
    └── < 0.50  →  Auto-escalate to Bedrock
                        │
                        ├── Bedrock available  →  Claude 3 Haiku (ap-south-1, VPC)
                        │                         PageIndex context sent with query
                        └── Bedrock unavailable  →  Public Cloud (PII stripped)
```

**Bedrock Configuration:**
- Model: Claude 3 Haiku (or Amazon Titan for fully AWS-native)
- Region: `ap-south-1` Mumbai — DPDP Act compliant, data stays in India
- PageIndex context always travels with the query to Bedrock
- Bedrock Guardrails enabled — prevents hallucination of drug dosages
- Cost: Pay-per-token, ~40–60% cheaper than equivalent OpenAI models

**Target query distribution:**
- 70–80% resolved on-device (Tier 1–3)
- 20–25% escalated to Bedrock
- < 5% to public cloud last resort

---

## 2. TODO List

### 🔴 Phase 0 — Foundation (Pre-requisites)

- [ ] **P0.1** Finalise `DeviceCapabilityDetector.ts` — RAM detection, storage check, tier assignment
- [ ] **P0.2** Implement Tier persistence (store assigned tier in AsyncStorage on first run)
- [ ] **P0.3** Build LLM opt-in prompt UI (Wi-Fi required banner, download size, decline option)
- [ ] **P0.4** Implement secure model download — OTA over Wi-Fi, AES-256 device-bound encryption
- [ ] **P0.5** Model integrity verification — SHA-256 hash check post-download

---

### 🟡 Phase 1 — PageIndex Core (All Tiers)

- [ ] **P1.1** Run `build_pageindex.py` on all source PDFs → generate all tree JSONs
  - `who_imci_tree.json`
  - `icmr_tb_tree.json`
  - `icmr_anaemia_tree.json`
  - `nlem_2022_tree.json`
  - `who_anc_tree.json`
  - `nnf_imnci_tree.json`
  - `gina_asthma_tree.json`
  - `ayurveda_kb_tree.json`
- [ ] **P1.2** Bundle all PageIndex JSONs in APK under `assets/pageindex/`
- [ ] **P1.3** Run `ingest_vectors.py` → populate LanceDB `core_medical` table
- [ ] **P1.4** Build `HybridRetrieval.ts` — FTS5 + PageIndex + LanceDB orchestration
- [ ] **P1.5** Implement SQLite FTS5 seed from `fts5_seed.json` on first launch
- [ ] **P1.6** Add MobileBERT TFLite intent router (~25 MB, bundled in APK)
- [ ] **P1.7** Build Rule Engine for deterministic Tier 1 clinical decisions
- [ ] **P1.8** Confidence scorer — output `{ score: float, source: string, nodes: PageIndexNode[] }`

---

### 🟡 Phase 2 — LLM Integration (Tier 2 & 3)

- [ ] **P2.1** Integrate `llama.rn` for Tier 2/3 on-device inference
- [ ] **P2.2** Build `LLMEngine.ts` — tier detection, model loading, prompt assembly
- [ ] **P2.3** Implement prompt template: `[PageIndex nodes] + [Patient context] + [User query]`
- [ ] **P2.4** Token limiter — hard cap 512 tokens Tier 2, 1024 Tier 3
- [ ] **P2.5** Multi-turn memory — 2 turns Tier 2, unlimited (within context) Tier 3
- [ ] **P2.6** Complete QLoRA fine-tuning pipeline on RunPod (RTX 3090, ~$1.50/run)
  - Training pairs: ~5,000 JSONL from `llm_training_dataset.jsonl`
  - QLoRA config: r=16, alpha=32, 4-bit quantization
  - Export: GGUF Q4_K_M → Tier 2 target ~600 MB
- [ ] **P2.7** Gemma 3 1B int4 integration as primary model (529 MB, 2,585 tok/s on Android)
- [ ] **P2.8** Gemma 3 4B as Tier 2 optional download
- [ ] **P2.9** LoRA adapter swapping — downloadable language packs (Hindi, Odia, Marathi, Kannada)

---

### 🟡 Phase 3 — Bedrock Escalation (All Tiers, Online)

- [ ] **P3.1** Build `BedrockEscalationHandler.ts` — confidence threshold check + API call
- [ ] **P3.2** PII stripping middleware — remove patient name, ID, location before cloud call
- [ ] **P3.3** PageIndex context bundler — serialize retrieved nodes → Bedrock prompt context
- [ ] **P3.4** AWS Bedrock integration (Claude 3 Haiku, `ap-south-1`, private VPC)
- [ ] **P3.5** Bedrock Guardrails config — drug dosage hallucination filter
- [ ] **P3.6** Public cloud fallback (last resort) — Claude API / GPT-4 with PII strip
- [ ] **P3.7** Cost monitoring — log all Bedrock/public calls with token counts

---

### 🟢 Phase 4 — React Native App Shell

- [ ] **P4.1** Symptom Checker screen — grouped selector (15 UI categories, 276+ symptoms)
- [ ] **P4.2** Patient context input — age, gender, pregnancy toggle, chronic conditions
- [ ] **P4.3** Results screen — top 3 diseases, risk badge (IMMEDIATE / URGENT / ROUTINE), red flag alerts
- [ ] **P4.4** Medicine Intelligence tab — JanAushadhi generic + Ayurvedic options with MRP
- [ ] **P4.5** Referral guidance — PHC / CHC / FRU / Hospital routing with reason
- [ ] **P4.6** LLM Q&A screen — tap disease → on-device chatbot (Tier 2/3) or PageIndex structured answer (Tier 1)
- [ ] **P4.7** Tier indicator — subtle UI badge showing current AI tier
- [ ] **P4.8** Offline status banner — "Working offline" indicator

---

### 🔵 Phase 5 — Language & Voice

- [ ] **P5.1** Bhashini ASR integration — Odia, Hindi, English voice input
- [ ] **P5.2** Bhashini TTS — regional language voice output
- [ ] **P5.3** Translate `symptom_ui_groups.json` labels to Odia + Hindi
- [ ] **P5.4** Downloadable LoRA language adapters — Hindi, Odia, Marathi, Kannada
- [ ] **P5.5** Language pack manager screen — download / delete / update

---

### 🔵 Phase 6 — Privacy, Security & Compliance

- [ ] **P6.1** DPDP Act 2023 compliance audit — one-way cloud-to-device data flow
- [ ] **P6.2** Consent screen — explicit opt-in for any cloud escalation
- [ ] **P6.3** Local-only mode toggle — block all network for maximum privacy
- [ ] **P6.4** SQLite AES-256 encryption (via `op-sqlite`)
- [ ] **P6.5** Device binding for downloaded model files
- [ ] **P6.6** Audit log — local record of all escalations (no PII)

---

### 🔵 Phase 7 — Dataset Completion

- [ ] **P7.1** Complete remaining disease CSV datasets (target: 145 diseases total)
- [ ] **P7.2** Build Generic ↔ Ayurvedic bridge dataset (same 49 diseases, cross-referenced)
- [ ] **P7.3** Expand LLM training JSONL to 5,000+ pairs across all 31+ diseases
- [ ] **P7.4** Validate all symptom-disease mappings (1,108 current) against ICMR/WHO sources
- [ ] **P7.5** Janaushadhi drug codes + MRP update (PMBJP product basket 2024)

---

## 3. Data Sources — Complete Reference

All sources are open-access, government-published, or peer-reviewed. No proprietary data.

---

### 3.1 Clinical Guidelines & Protocols (PageIndex Sources)

These are the primary sources indexed into PageIndex trees and bundled in the APK.

| # | Source | Publisher | Coverage | PageIndex File | URL |
|---|---|---|---|---|---|
| 1 | **WHO IMCI** — Integrated Management of Childhood Illness | WHO | Child illness triage, fever, cough, diarrhoea, malnutrition | `who_imci_tree.json` | https://who.int/publications/i/item/9789240071308 |
| 2 | **WHO Antenatal Care Recommendations** | WHO | ANC protocols, maternal risk scoring | `who_anc_tree.json` | https://who.int/reproductivehealth/publications/maternal_perinatal_health/anc-positive-pregnancy-experience/en |
| 3 | **ICMR TB Management Guidelines** | ICMR / NTB Programme | TB diagnosis, treatment, drug regimens | `icmr_tb_tree.json` | https://icmr.gov.in |
| 4 | **ICMR Nutritional Anaemia Guidelines** | ICMR | Iron deficiency, B12, folate anaemia | `icmr_anaemia_tree.json` | https://icmr.gov.in |
| 5 | **National List of Essential Medicines 2022 (NLEM)** | Ministry of Health & Family Welfare | 384 essential allopathic drugs, dosages, indications | `nlem_2022_tree.json` | https://mohfw.gov.in |
| 6 | **NNF India Neonatal Care Guidelines (IMNCI)** | National Neonatology Forum | Neonatal fever, jaundice, sepsis, respiratory distress | `nnf_imnci_tree.json` | https://nnfi.org |
| 7 | **GINA Global Strategy for Asthma Management 2023** | GINA | Asthma classification, step therapy | `gina_asthma_tree.json` | https://ginasthma.org |
| 8 | **Ayurveda Knowledge Base** (custom compiled) | Ministry of AYUSH + CCRAS | Prakriti, Doshas, classical herbs, formulations | `ayurveda_kb_tree.json` | Internal |

---

### 3.2 Medicine Databases

#### Allopathic / Generic

| # | Source | Publisher | Coverage | Records | URL |
|---|---|---|---|---|---|
| 1 | **PMBJP Janaushadhi Product Basket** | Dept. of Pharmaceuticals, Govt. of India | 2,110 generic medicines + 315 surgicals, drug codes, MRP | 2,400+ | https://janaushadhi.gov.in/Data/PMBJP%20Product.pdf |
| 2 | **NLEM 2022** | MoHFW | 384 essential medicines with dosage, route, ICD-10 mapping | 384 | https://mohfw.gov.in |
| 3 | **CDSCO Drug Database** | Central Drugs Standard Control Organisation | All licensed allopathic drugs in India | Large | https://cdsco.gov.in |
| 4 | **WHO Model List of Essential Medicines (23rd ed.)** | WHO | Global essential medicines reference | 500+ | https://who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02 |
| 5 | **A-Z Medicine Dataset of India** (Kaggle) | Community (scraped 1mg) | ~12,000 medicines — name, use, side effects, substitutes | ~12,000 | https://kaggle.com/datasets/shudhanshusingh/az-medicine-dataset-of-india |
| 6 | **250k Medicines — Side Effects & Substitutes** (Kaggle) | Community | Usage, side effects, substitutes for 250k entries | 250,000 | https://kaggle.com/datasets/shudhanshusingh/250k-medicines-usage-side-effects-and-substitutes |
| 7 | **Indian Medicine Dataset** (GitHub) | junioralive | ~10,000+ medicines — name, price, manufacturer, composition | ~10,000 | https://github.com/junioralive/Indian-Medicine-Dataset |
| 8 | **India Medicines & Drug Info** (Kaggle) | apkaayush | ~5,000 drug info records | ~5,000 | https://kaggle.com/datasets/apkaayush/india-medicines-and-drug-info-dataset |

#### Ayurvedic

| # | Source | Publisher | Coverage | URL |
|---|---|---|---|---|
| 1 | **Ayurvedic Pharmacopoeia of India (API)** — Parts I & II | Ministry of AYUSH | 444 formulations (Part I) + 191 formulations (Part II), 351+ single drugs | https://ayurveda.hu/api/API-Vol-1.pdf |
| 2 | **National List of Essential AYUSH Medicines (NLEAM)** | Ministry of AYUSH | Government shortlist of effective + safe Ayurvedic formulations | https://ayush.gov.in |
| 3 | **Ayurvedic Formulary of India (AFI)** | AYUSH / APC | Classical formulations reference — Triphala, Mahasudarshan, Kutajghan Vati etc. | https://ayush.gov.in |
| 4 | **CCRAS Clinical Protocols** | CCRAS, AYUSH | Disease-specific Ayurvedic protocols (TB, Dengue, COVID adjuvant) | https://ccras.nic.in |
| 5 | **DHARA / AYUSH Research Portal** | Govt. of India | Peer-reviewed Ayurveda research, herb efficacy by disease | https://dharaonline.org |
| 6 | **Himalaya Drug Company** — Product Portal | Himalaya Wellness | Standardised extract percentages, AYUSH reg numbers, PubMed-backed | https://himalayawellness.com/en/products |
| 7 | **Patanjali Ayurved** — Official Store | Patanjali | SKU names, MRP, pack sizes, AYUSH license numbers | https://patanjaliayurved.net |
| 8 | **Dabur India** — Product Catalogue | Dabur (est. 1884) | Classical formulations — Lauhasava, Balarishta, Mahasudarshan (AFI-faithful) | https://daburindia.com |

---

### 3.3 Disease & Symptom Datasets (In-App Bundled / Fine-tuning)

| # | File | Diseases | Records | Status |
|---|---|---|---|---|
| 1 | `disease_profiles.json` | 31 diseases | 31 profiles | ✅ Complete |
| 2 | `symptom_registry.json` | All | 276 symptoms | ✅ Complete |
| 3 | `symptom_ui_groups.json` | All | 15 UI categories | ✅ Complete |
| 4 | `janaushadhi_disease_mapping.json` | 31 diseases | 2,438 products | ✅ Complete |
| 5 | `ayurvedic_disease_mapping_deduped.json` | 31 diseases | ~6,000 records | ✅ Complete |
| 6 | `llm_training_dataset.jsonl` | 22 diseases | 3,639 Q&A pairs | ✅ Complete |
| 7 | Ayurvedic Dataset 1 (Excel) | 12 diseases | 2,000 records (AYU01001–AYU03000) | ✅ Complete |
| 8 | Ayurvedic Dataset 2 (Excel) | 19 diseases | 2,000 records (AYU02001–AYU04000) | ✅ Complete |
| 9 | Ayurvedic Dataset 3 (Excel) | 18 diseases | 2,000 records (AYU04001–AYU06000) | ✅ Complete |
| 10 | Synthetic medical CSVs | Dengue, Hypertension, Dehydration, TB, Malaria, Typhoid, Anaemia, UTI, Pneumonia, Diabetes, Asthma, Neonatal Fever, Pregnancy Risk | 1,000 each | ✅ Complete |
| 11 | Remaining disease CSVs | ~100+ diseases | — | ⏳ Phase 7 |

---

### 3.4 Government Health Programmes & Disease-Specific Guidelines

These are source documents for PageIndex and for training data facts.

| # | Programme / Source | Diseases Covered | Publisher | URL |
|---|---|---|---|---|
| 1 | **NVBDCP** — National Vector Borne Disease Control Programme | Dengue, Malaria, Chikungunya, Kala-Azar, Japanese Encephalitis, Filariasis | Ministry of Health | https://nvbdcp.gov.in |
| 2 | **RNTCP / National TB Elimination Programme** | Tuberculosis | MoHFW | https://tbcindia.gov.in |
| 3 | **National Programme for Control of Blindness (NPCB)** | Vitamin A deficiency, Cataract, Glaucoma | MoHFW | https://npcbvi.gov.in |
| 4 | **National Leprosy Eradication Programme (NLEP)** | Leprosy | MoHFW | https://nlep.nic.in |
| 5 | **National NCD Programme** | Hypertension, Diabetes, Cancer, COPD, Heart Disease, Stroke | MoHFW | https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=1048&lid=359 |
| 6 | **National Iodine Deficiency Disorders Control Programme** | Goitre, Cretinism | MoHFW | https://mohfw.gov.in |
| 7 | **Rashtriya Bal Swasthya Karyakram (RBSK)** | 4Ds: Defects, Diseases, Deficiencies, Developmental delays | NHM | https://rbsk.gov.in |
| 8 | **National Programme for Prevention and Control of Deafness** | Hearing loss, Ear infections | MoHFW | https://mohfw.gov.in |
| 9 | **Janani Suraksha Yojana (JSY) / PMSMA** | Maternal mortality, ANC, PPH, Puerperal Sepsis | NHM | https://nhm.gov.in |
| 10 | **Integrated Child Development Services (ICDS)** | SAM, Stunting, Wasting, Rickets, PEM | Ministry of Women & Child Development | https://wcd.nic.in |
| 11 | **National Mental Health Programme** | Depression, Anxiety, Psychosis | NIMHANS / MoHFW | https://nimhans.ac.in |
| 12 | **WHO SEARO India Guidelines** | Regional disease burden data, ICD-10 codes | WHO South-East Asia | https://www.who.int/southeastasia |
| 13 | **ICMR Disease Burden Studies** | All NCDs and infectious diseases — India-specific prevalence | ICMR | https://icmr.gov.in |
| 14 | **National Health Mission (NHM)** | All diseases in ASHA work scope | MoHFW | https://nhm.gov.in |

---

### 3.5 Open / Academic Datasets

| # | Source | Coverage | URL |
|---|---|---|---|
| 1 | **Kaggle — Symptom-Disease Datasets** (multiple) | General disease-symptom correlations | https://kaggle.com/search?q=disease+symptoms+india |
| 2 | **UCI ML Repository — Disease Datasets** | Heart disease, Diabetes, Kidney disease | https://archive.ics.uci.edu/ml/datasets.php |
| 3 | **OpenMRS / OpenHIE** | EHR-based symptom/diagnosis records | https://openmrs.org |
| 4 | **PhysioNet** | Vital sign time-series, ICU records | https://physionet.org |
| 5 | **Global Health Observatory (WHO GHO)** | Country-level disease prevalence stats | https://who.int/data/gho |
| 6 | **India Health Survey (NFHS-5)** | Anaemia, malnutrition, maternal health, NCD prevalence by state | https://rchiips.org/nfhs/NFHS-5Reports/NFHS-5_INDIA_REPORT.pdf |
| 7 | **Sample Registration System (SRS) Bulletin** | Cause-of-death data for India | https://censusindia.gov.in |

---

### 3.6 ICD-10 & Classification Standards

| # | Resource | Purpose | URL |
|---|---|---|---|
| 1 | **ICD-10 Online Browser** (WHO) | Disease code lookup, hierarchy | https://icd.who.int/browse10 |
| 2 | **ICD-11 (latest)** | Next-gen disease classification | https://icd.who.int/browse11 |
| 3 | **ICD-10 India (NHP mapping)** | India-specific ICD-10 usage | https://nhp.gov.in |

---

### 3.7 Voice / Language Sources

| # | Source | Coverage | URL |
|---|---|---|---|
| 1 | **Bhashini** | ASR + TTS for 22 Indian languages — Odia, Hindi, Bengali, Marathi, Kannada etc. (Govt. of India, free API) | https://bhashini.gov.in |
| 2 | **AI4Bharat IndicNLP** | NLP models for Indian languages | https://ai4bharat.org |
| 3 | **IndicTrans2** | Translation across 22 Indian languages | https://github.com/AI4Bharat/IndicTrans2 |

---

## 4. Architecture Files Reference

```
DhanwantariAI/
├── src/
│   ├── ai/
│   │   ├── DeviceCapabilityDetector.ts   ← Tier assignment at boot
│   │   ├── DiagnosisEngine.ts            ← TFLite symptom → ICD-10
│   │   └── LLMEngine.ts                 ← Tier detection + orchestration
│   ├── retrieval/
│   │   └── HybridRetrieval.ts           ← FTS5 + PageIndex + LanceDB
│   ├── cloud/
│   │   └── BedrockEscalationHandler.ts  ← Confidence check + Bedrock call
│   ├── db/
│   │   └── LocalDatabase.ts             ← SQLite + op-sqlite (AES-256)
│   ├── voice/
│   │   └── BhashiniEngine.ts            ← Odia/Hindi/English voice
│   └── sync/
│       └── FederatedSync.ts             ← Anonymised sync to Qdrant (VPC)
│
├── assets/
│   ├── models/
│   │   ├── gemma3-1b-int4.gguf          ← Primary (529MB, Tier 2 base)
│   │   ├── gemma3-4b-int4.gguf          ← Tier 2 optional download
│   │   ├── llama-3.2-7b-q4_k_m.gguf    ← Tier 3 download
│   │   └── mobilebert-intent.tflite    ← Query router (25MB, bundled)
│   ├── pageindex/
│   │   ├── who_imci_tree.json
│   │   ├── icmr_tb_tree.json
│   │   ├── icmr_anaemia_tree.json
│   │   ├── nlem_2022_tree.json
│   │   ├── who_anc_tree.json
│   │   ├── nnf_imnci_tree.json
│   │   ├── gina_asthma_tree.json
│   │   ├── ayurveda_kb_tree.json
│   │   └── fts5_seed.json
│   └── vectors/
│       └── lancedb/                     ← core_medical LanceDB table
│
└── scripts/
    ├── build_pageindex.py               ← PDF → PageIndex tree JSON
    └── ingest_vectors.py                ← CSV datasets → LanceDB vectors
```

---

## 5. Quick Status Summary

| Area | Status |
|---|---|
| Disease dataset (31 diseases, 276 symptoms) | ✅ Done |
| Ayurvedic medicine datasets (49 diseases, 6,000 records) | ✅ Done |
| JanAushadhi drug mapping (2,438 products) | ✅ Done |
| LLM training JSONL (3,639 pairs) | ✅ Done |
| Synthetic patient CSVs (13 diseases × 1,000 records) | ✅ Done |
| PageIndex tree generation | ⏳ Pending — source PDFs needed |
| DeviceCapabilityDetector | ⏳ Phase 0 |
| LLM opt-in download UX | ⏳ Phase 0 |
| Bedrock escalation handler | ⏳ Phase 3 |
| Bhashini voice integration | ⏳ Phase 5 |
| LoRA language adapters | ⏳ Phase 5 |
| DPDP compliance audit | ⏳ Phase 6 |

---

*Document maintained by AppScale LLP — DhanwantariAI Project*  
*LLPIN: ACP-6024 | appscale.in*
