# DhanwantariAI — Full System Architecture

> **Version:** v2.1 — Hybrid On-Device + Cloud Intelligence  
> **Owner:** AppScale LLP · Satyam Kumar Das  
> **LLPIN:** ACP-6024 · appscale.in  
> **Last Updated:** March 2026  
> **Tagline:** *Ancient Name. Modern Intelligence.*  
> **Product:** Offline-first AI Clinical Decision Support for Rural Healthcare Professionals

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Device Capability Detection & Tier Assignment](#2-device-capability-detection--tier-assignment)
3. [Tier Definitions & AI Stack Per Tier](#3-tier-definitions--ai-stack-per-tier)
4. [Hybrid Retrieval Architecture](#4-hybrid-retrieval-architecture)
5. [AWS Bedrock + Claude Haiku Integration](#5-aws-bedrock--claude-haiku-integration)
6. [Guardrails & Safety Architecture](#6-guardrails--safety-architecture)
7. [Classification & Confidence Scoring](#7-classification--confidence-scoring)
8. [Data Sources & Knowledge Base](#8-data-sources--knowledge-base)
9. [Cloud Infrastructure](#9-cloud-infrastructure)
10. [Privacy & Compliance](#10-privacy--compliance)
11. [Project File Structure](#11-project-file-structure)
12. [Artefacts Status](#12-artefacts-status)

---

## 1. System Overview

DhanwantariAI is an **offline-first clinical decision support system** built for ASHA workers, ANMs, and rural healthcare professionals in India. The system provides disease diagnosis support, medicine guidance, and referral decisions — entirely on-device for 70–80% of queries, escalating to AWS Bedrock only when local confidence is insufficient.

### Core Design Principles

- **Offline first** — the app must work with zero internet connectivity at all times
- **PageIndex is the truth** — LLM only synthesises language; clinical facts come from indexed protocols
- **Tiered intelligence** — AI stack adapts to device capability automatically
- **User consent for LLM** — no LLM is loaded without explicit user opt-in
- **Zero PII in cloud** — patient data never leaves the device; only anonymised vectors sync
- **DPDP Act 2023 compliant** — all cloud resources in `ap-south-1` Mumbai

### High-Level Query Flow

```
User Query (voice / text)
        │
        ▼
DeviceCapabilityDetector → Tier 1 / 2 / 3
        │
        ▼
HybridRetrieval Engine
    ├── PageIndex Tree Search     (deterministic, protocol-level)
    ├── SQLite FTS5 Search        (structured, fast)
    └── Qdrant Cloud Vector Search (semantic, dataset-level)
        │
        ▼
ConfidenceScorer
    ├── Score ≥ 0.80  → On-Device Answer (LLM Tier 2/3 or structured Tier 1)
    └── Score < 0.80  → Bedrock Escalation
                              │
                              ▼
                     AWS Bedrock (Claude 3 Haiku)
                     ap-south-1 · PII stripped
                     Guardrails enabled
                              │
                              ▼
                     Final Answer → User
```

---

## 2. Device Capability Detection & Tier Assignment

### 2.1 Library

```bash
npm install react-native-device-info
```

### 2.2 Detection Logic

```typescript
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DeviceTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export interface DeviceProfile {
  tier: DeviceTier;
  ramGB: number;
  freeDiskGB: number;
  isLowRam: boolean;
  model: string;
  apiLevel: number;
  llmEligible: boolean;
  llmModelSuggested: string | null;
}

const TIER_CACHE_KEY = 'dhanwantari_device_tier';

export const detectDeviceCapability = async (): Promise<DeviceProfile> => {
  // Return cached tier — tier never changes on a given device
  const cached = await AsyncStorage.getItem(TIER_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const [totalRAM, freeDisk, isLowRam, model, apiLevel] = await Promise.all([
    DeviceInfo.getTotalMemory(),       // physical RAM in bytes
    DeviceInfo.getFreeDiskStorage(),   // available storage in bytes
    DeviceInfo.isLowRamDevice(),       // Android system low-RAM flag
    DeviceInfo.getModel(),             // e.g. "Redmi Note 10"
    DeviceInfo.getApiLevel(),          // Android API level (NNAPI support)
  ]);

  const ramGB      = totalRAM / 1024 / 1024 / 1024;
  const freeDiskGB = freeDisk / 1024 / 1024 / 1024;

  let tier: DeviceTier;
  let llmModelSuggested: string | null = null;

  // Android OS reserves ~1–1.2 GB — real available RAM is lower than physical
  if (ramGB < 2 || isLowRam) {
    tier             = 'TIER_1';
    llmModelSuggested = null;
  } else if (ramGB < 8) {
    tier             = 'TIER_2';
    llmModelSuggested = freeDiskGB > 3 ? 'gemma3-1b-int4' : null;
  } else {
    tier             = 'TIER_3';
    llmModelSuggested = freeDiskGB > 5 ? 'gemma3-4b-int4' : 'gemma3-1b-int4';
  }

  const profile: DeviceProfile = {
    tier,
    ramGB:        parseFloat(ramGB.toFixed(2)),
    freeDiskGB:   parseFloat(freeDiskGB.toFixed(2)),
    isLowRam,
    model,
    apiLevel,
    llmEligible:  tier !== 'TIER_1',
    llmModelSuggested,
  };

  await AsyncStorage.setItem(TIER_CACHE_KEY, JSON.stringify(profile));
  return profile;
};
```

### 2.3 Additional Device Signals

```typescript
DeviceInfo.getModel()         // "Redmi Note 10" — for analytics
DeviceInfo.getBrand()         // "Xiaomi"
DeviceInfo.getSystemVersion() // "12" — Android version
DeviceInfo.isLowRamDevice()   // Android's own low-RAM flag (secondary signal)
DeviceInfo.getApiLevel()      // 31 → NNAPI acceleration available (API 27+)
```

### 2.4 Tier Assignment Decision Tree

```
App First Launch
        │
        ▼
getTotalMemory() + isLowRamDevice() + getFreeDiskStorage()
        │
        ├── RAM < 2 GB OR isLowRam = true
        │       └── TIER 1 — PageIndex + SQLite + Rule Engine only
        │
        ├── RAM 2–8 GB AND freeDisk > 3 GB
        │       └── TIER 2 — PageIndex + Optional 3B LLM (user opt-in)
        │
        └── RAM ≥ 8 GB AND freeDisk > 5 GB
                └── TIER 3 — PageIndex + Optional 7B LLM (user opt-in)
```

---

## 3. Tier Definitions & AI Stack Per Tier

### Overview Table

| | **Tier 1** | **Tier 2** | **Tier 3** |
|---|---|---|---|
| **RAM Threshold** | < 2 GB or isLowRam | 2–8 GB | ≥ 8 GB |
| **Free Disk** | Any | > 3 GB | > 5 GB |
| **Typical Devices** | Old budget Androids (most ASHA phones) | Redmi Note 10, Realme 8, Samsung A23 | Redmi Note 12 Pro, Samsung A54, Realme GT |
| **Typical Users** | ASHA frontline workers | ASHA + ANMs | ANMs, CHOs, supervisors |
| **PageIndex** | ✅ Always | ✅ Always | ✅ Always |
| **SQLite FTS5** | ✅ Always | ✅ Always | ✅ Always |
| **Qdrant Cloud Vector** | ✅ When online | ✅ When online | ✅ When online |
| **LLM** | ❌ None | ✅ User opt-in download | ✅ User opt-in download |
| **LLM Model** | — | Gemma 3 1B int4 (529 MB) | Gemma 3 4B int4 (~2.5 GB) |
| **Multi-turn** | ❌ | ⚠️ 2–3 turns max | ✅ Full context window |
| **Bedrock Escalation** | ✅ Online only | ✅ Online only | ✅ Online only |
| **Inference Runtime** | — | llama.rn / llama.cpp | llama.rn / llama.cpp |

---

### 3.1 Tier 1 — PageIndex + Rule Engine (< 2 GB RAM)

**Philosophy: Zero hallucination. Fully deterministic. Always auditable.**

Every answer traces back to a specific line in a WHO/ICMR/NLEM document.

**AI Components (all bundled in APK):**

| Component | Size | Purpose |
|---|---|---|
| MobileBERT TFLite | ~25 MB | Intent classification — routes query to correct PageIndex subtree |
| PageIndex JSON trees | ~15 MB total | Clinical protocol navigation |
| SQLite FTS5 database | ~40 MB | Structured disease/medicine lookup |
| Rule Engine (TypeScript) | < 1 MB | Deterministic ASHA clinical decision logic |

**Capabilities:**
- PageIndex tree navigation (WHO IMCI, ICMR, NLEM, Ayurveda KB)
- SQLite FTS5 structured queries — `< 5ms` response
- Rule-based triage — IMMEDIATE / URGENT / ROUTINE classification
- 100% offline — no network required for any functionality
- Bhashini ASR for voice input when online
- Bedrock escalation when online + confidence < threshold

**Limitations:**
- No conversational AI — graceful "Here is what the protocol says:" structured response
- No natural language synthesis
- No multi-turn

---

### 3.2 Tier 2 — PageIndex + Optional 3B LLM (2–8 GB RAM)

**Philosophy: LLM is a language layer on top of PageIndex retrieval — not a knowledge source.**

**LLM is never loaded automatically.** On first launch after tier detection, the user sees:

```
┌─────────────────────────────────────────────────┐
│  AI Assistant Available                         │
│                                                 │
│  Download DhanwantariAI Assistant (529 MB)?     │
│  Requires Wi-Fi. Works fully offline after.     │
│                                                 │
│  [Download on Wi-Fi]    [Not now, use basic]    │
└─────────────────────────────────────────────────┘
```

**LLM Stack:**
- **Primary model:** Gemma 3 1B int4 — 529 MB, 2,585 tokens/sec on Android, Apache 2.0 license
- **Runtime:** llama.rn (React Native llama.cpp bindings)
- **Context:** PageIndex retrieved nodes + patient context + user query
- **Token limit:** 512 tokens output max
- **Memory:** 2–3 turn conversation max
- **Model storage:** AES-256 encrypted, device-bound (SHA-256 integrity check)

**Prompt Template:**
```
[SYSTEM]
You are DhanwantariAI, a clinical decision support assistant for ASHA workers 
in rural India. Answer ONLY based on the provided clinical context below.
Do not generate medical facts from memory. If context is insufficient, 
say "Please refer to a PHC" — never guess.

[RETRIEVED CONTEXT — PageIndex]
{pageindex_nodes}

[RETRIEVED CONTEXT — Disease/Medicine Records]
{vector_results}

[PATIENT CONTEXT]
Age: {age} | Gender: {gender} | Pregnant: {pregnant}
Symptoms reported: {symptoms}

[QUESTION]
{user_query}

[ANSWER]
```

---

### 3.3 Tier 3 — PageIndex + Optional 7B LLM (≥ 8 GB RAM)

**For ANMs, CHOs, and supervisor-level healthcare professionals.**

- **Model:** Gemma 3 4B int4 (~2.5 GB) or Llama 3.2 7B Q4_K_M (~4.5 GB)
- Full multi-turn reasoning (2048+ token context window)
- NPU-accelerated inference where available (NNAPI API level 27+)
- Same PageIndex grounding — LLM extends, never replaces
- Longer clinical reasoning chains possible

**Post-launch LoRA Language Adapters (downloadable separately):**

| Language | Adapter Size | Download |
|---|---|---|
| Hindi | ~150 MB | Post-launch Phase 5 |
| Odia | ~150 MB | Post-launch Phase 5 |
| Marathi | ~150 MB | Post-launch Phase 5 |
| Kannada | ~150 MB | Post-launch Phase 5 |

---

## 4. Hybrid Retrieval Architecture

The retrieval engine combines three complementary sources. Each covers what the others miss.

```
User Query
    │
    ├──→ [1] PageIndex Tree Search
    │          Purpose: Navigate clinical protocol documents
    │          Latency: 200–500ms
    │          Returns: Structured guideline nodes (WHO/ICMR/NLEM sections)
    │          Strength: Precise, deterministic, protocol-level
    │          Weakness: Misses semantically equivalent phrasings
    │
    ├──→ [2] SQLite FTS5 Search
    │          Purpose: Structured disease/medicine/symptom lookup
    │          Latency: < 5ms
    │          Returns: Disease profiles, medicine records, symptom matches
    │          Strength: Extremely fast, exact + prefix matching
    │          Weakness: No semantic understanding
    │
    └──→ [3] Qdrant Cloud Vector Search (online) / LanceDB (offline)
               Purpose: Semantic similarity across disease + medicine datasets
               Latency: 50–150ms (cloud) / 50ms (local LanceDB)
               Returns: Top-k semantically matched records
               Strength: Catches phrasing variations PageIndex misses
               Weakness: Requires embeddings, slightly slower
    │
    ▼
ResultReconciler
    │
    ├── Identify agreements across sources (high confidence signal)
    ├── Flag conflicts (lower confidence, escalate flag)
    └── Merge into unified RetrievalBundle
    │
    ▼
ConfidenceScorer → score: 0.0–1.0
```

### 4.1 PageIndex Trees (Bundled in APK)

All PageIndex trees are generated from official PDFs using `build_pageindex.py` and bundled in the APK at `assets/pageindex/`.

| Tree File | Source Document | Domain | Nodes |
|---|---|---|---|
| `who_imci_tree.json` | WHO IMCI Guidelines | Child illness triage | ~120 |
| `icmr_tb_tree.json` | ICMR TB Management Guidelines | Tuberculosis | ~80 |
| `icmr_anaemia_tree.json` | ICMR Nutritional Anaemia Guidelines | Anaemia | ~60 |
| `nlem_2022_tree.json` | National List of Essential Medicines 2022 | Drug protocols | ~200 |
| `who_anc_tree.json` | WHO Antenatal Care Recommendations | Maternal health | ~90 |
| `nnf_imnci_tree.json` | NNF India Neonatal Care Guidelines | Neonatal care | ~70 |
| `gina_asthma_tree.json` | GINA Global Strategy for Asthma 2023 | Asthma | ~50 |
| `ayurveda_kb_tree.json` | AYUSH Ayurveda Knowledge Base | Ayurvedic protocols | ~100 |
| `fts5_seed.json` | All disease datasets | FTS5 bootstrap seed | — |

### 4.2 Vector Collections (Qdrant Cloud Free Tier)

**Provider:** Qdrant Cloud — https://cloud.qdrant.io  
**Cost:** ₹0 (1 GB free tier — sufficient for Phase 1–3)  
**Embedding Model:** MiniLM L6 v2 (bundled TFLite, ~25 MB, 384-dim)  
**No EC2. No VPC. No NAT Gateway.**

| Collection | Dimensions | Vectors (Est.) | Content |
|---|---|---|---|
| `disease_symptoms` | 384 | ~50,000 | Disease-symptom semantic records |
| `medicines` | 384 | ~80,000 | JanAushadhi + Ayurvedic medicine records |
| `clinical_protocols` | 384 | ~30,000 | PageIndex node embeddings |

```typescript
// .env
QDRANT_URL     = https://xxxx.ap-southeast.cloud.qdrant.io
QDRANT_API_KEY = your_api_key_here
```

### 4.3 Result Reconciler

Before sending to Bedrock, the reconciler merges retrieval results:

```typescript
interface RetrievalBundle {
  pageIndexNodes:   PageIndexNode[];    // From PageIndex
  ftsResults:       FTSRecord[];        // From SQLite FTS5
  vectorMatches:    VectorRecord[];     // From Qdrant / LanceDB
  agreements:       string[];           // Facts confirmed by 2+ sources
  conflicts:        string[];           // Facts that differ across sources
  confidenceScore:  number;             // 0.0 – 1.0
  escalationReason: string | null;      // Why Bedrock was triggered
}
```

**Reconciliation rules:**
- If PageIndex + Vector agree on a clinical fact → high confidence, mark as `agreement`
- If they conflict → reduce confidence score, flag for Bedrock resolution
- If only one source returns results → moderate confidence
- If all three return zero results → escalate to Bedrock immediately

### 4.4 Token Budget for Bedrock

```
PageIndex nodes      →  ~800 tokens  (protocol/guideline grounding)
Vector top-3 records →  ~400 tokens  (symptom/disease/medicine grounding)
Patient context      →  ~200 tokens  (age, gender, symptoms)
System prompt        →  ~300 tokens  (ASHA framing + safety guardrails)
─────────────────────────────────────
Total to Haiku       →  ~1,700 tokens  (well within Haiku's sweet spot)
```

At Haiku pricing (~$0.25/1M input tokens): **≈ ₹0.004 per escalated query**.

---

## 5. AWS Bedrock + Claude Haiku Integration

### 5.1 Model Selection

| Model | Bedrock ID | Cost (Input/Output) | Decision |
|---|---|---|---|
| Claude 3 Haiku | `anthropic.claude-3-haiku-20240307-v1:0` | $0.25 / $1.25 per 1M tokens | ✅ **Selected** |
| Claude 3 Sonnet | `anthropic.claude-3-sonnet-20240229-v1:0` | $3 / $15 per 1M tokens | ❌ Overkill for synthesis |
| Amazon Titan | `amazon.titan-text-express-v1` | $0.20 / $0.60 per 1M tokens | Fallback if Haiku unavailable |

**Why Haiku:** Fast (200ms median), cheap, strong enough for constrained synthesis tasks where context is pre-retrieved. Does not need frontier reasoning — PageIndex + vectors already did the hard work.

### 5.2 Escalation Flow

```typescript
class BedrockEscalationHandler {

  async escalate(bundle: RetrievalBundle, query: string): Promise<string> {

    // 1. Strip any PII from patient context
    const cleanContext = this.piiStripper.clean(bundle);

    // 2. Assemble Bedrock prompt
    const prompt = this.assemblePrompt(cleanContext, query);

    // 3. Call Bedrock with Guardrails
    const response = await bedrockClient.invokeModel({
      modelId:     'anthropic.claude-3-haiku-20240307-v1:0',
      guardrailId: process.env.BEDROCK_GUARDRAIL_ID,
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens:        512,
        system:            DHANWANTARI_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    // 4. Log token usage for cost monitoring (no PII in logs)
    this.logger.logUsage(response.usage);

    return response.content[0].text;
  }
}
```

### 5.3 Bedrock Call Triggers

| Trigger | Condition |
|---|---|
| Low confidence | `score < 0.50` — auto-escalate |
| Medium confidence | `score 0.50–0.79` — show local answer + "Get verified" button |
| Multi-hop reasoning | Query requires connecting 3+ clinical concepts |
| Zero retrieval | All three sources return empty results |
| Conflict detected | PageIndex and vector results directly contradict each other |
| Complex drug interaction | Query involves 2+ medicines + patient risk factors |

### 5.4 Fallback Chain

```
Step 1: On-device (always)
    └── Resolves 70–80% of queries

Step 2: AWS Bedrock Claude 3 Haiku (when online, confidence < threshold)
    └── Resolves ~20–25% of queries
    └── Region: ap-south-1 (Mumbai) — DPDP compliant

Step 3: Public Cloud — last resort only
    └── Only if Bedrock unavailable (outage / rate limit)
    └── PII stripped before sending
    └── Logged separately for cost monitoring
    └── < 5% of queries
```

---

## 6. Guardrails & Safety Architecture

### 6.1 Amazon Bedrock Guardrails (Cloud Layer)

Applied to every Bedrock invocation. Configured in `ap-south-1`.

| Guardrail | Configuration | Purpose |
|---|---|---|
| **Denied Topics** | Surgery instructions, prescription writing, diagnosis claims | Prevent app from overstepping ASHA scope |
| **Word Filters** | Drug dosage hallucinations (e.g. "100mg" without source) | Block unsourced dosage claims |
| **PII Redaction** | Name, phone, Aadhaar, address patterns | DPDP Act compliance |
| **Contextual Grounding** | Grounding score threshold: 0.75 | Response must be grounded in supplied context |
| **Sensitive Topics** | Mental health crisis, suicide, domestic violence | Route to appropriate helpline |

### 6.2 On-Device Guardrails (Pre-LLM)

Applied before any LLM inference, regardless of tier.

```typescript
const ON_DEVICE_GUARDRAILS = {

  // Hard blocks — never pass to LLM
  blockedIntents: [
    'prescribe_medicine',       // LLM cannot prescribe — only suggest
    'perform_surgery',
    'confirm_diagnosis',        // "You have dengue" — blocked
    'dosage_without_source',
  ],

  // Scope limits — only ASHA worker domain
  allowedDomains: [
    'symptom_assessment',
    'medicine_information',
    'referral_guidance',
    'disease_information',
    'prevention_advice',
    'scheme_eligibility',       // PM schemes, JSY, JSSK etc.
    'ayurvedic_information',
  ],

  // Always append to LLM response
  mandatoryDisclaimer:
    'This information is for guidance only. Always refer to a PHC/CHC for ' +
    'clinical decisions. DhanwantariAI does not replace a qualified doctor.',
};
```

### 6.3 Response Validation (Post-LLM)

Before showing LLM output to the user:

```typescript
interface ResponseValidator {
  checkForUnsourcedDosages(text: string): boolean;    // e.g. "take 500mg" without NLEM ref
  checkForDiagnosisClaims(text: string): boolean;     // "you have X disease"
  checkForPrescriptionLanguage(text: string): boolean; // "I prescribe you..."
  checkGroundingScore(text: string, bundle: RetrievalBundle): number;
  appendDisclaimer(text: string): string;
}
```

If any check fails → response is **replaced** with structured PageIndex answer + referral guidance.

### 6.4 Referral Safety Net

The Rule Engine always computes a **referral decision** independently of the LLM. If the LLM response contradicts the rule engine's referral decision, the rule engine wins:

```
Rule Engine says: IMMEDIATE REFERRAL (SpO2 < 90%)
LLM says:        "Monitor at home for 24 hours"
→ LLM output SUPPRESSED, Rule Engine referral displayed
```

### 6.5 Confidence Thresholds

| Score | Classification | Action |
|---|---|---|
| ≥ 0.80 | **High Confidence** | Answer locally, no escalation, no disclaimer |
| 0.60–0.79 | **Moderate Confidence** | Show answer with soft disclaimer, offer "Verify" button |
| 0.50–0.59 | **Low-Moderate** | Show structured PageIndex answer + "Getting verified answer…" |
| < 0.50 | **Low Confidence** | Auto-escalate to Bedrock, show loading indicator |
| 0.00 | **No Retrieval** | Escalate + show "Consulting medical knowledge base…" |

---

## 7. Classification & Confidence Scoring

### 7.1 Disease Classification Engine

The disease classifier scores all 145 diseases against reported symptoms using lift ratios and epidemiological weights.

```typescript
interface DiseaseScore {
  diseaseId:         string;         // e.g. "D001"
  diseaseName:       string;         // e.g. "Dengue Fever"
  icd10Code:         string;         // e.g. "A90"
  matchedSymptoms:   string[];       // Symptoms that fired
  score:             number;         // 0.0 – 1.0 weighted score
  riskLevel:         RiskLevel;      // IMMEDIATE | URGENT | ROUTINE
  redFlagsFired:     string[];       // Red flag symptoms present
  referralLevel:     ReferralLevel;  // ASHA | PHC | CHC | FRU | HOSPITAL
}

type RiskLevel    = 'IMMEDIATE' | 'URGENT' | 'ROUTINE';
type ReferralLevel = 'ASHA_MANAGE' | 'PHC' | 'CHC' | 'FRU' | 'HOSPITAL';
```

**Scoring factors:**

| Factor | Weight Boost |
|---|---|
| Core symptom match | Base lift ratio from disease profile |
| Red flag symptom present | +0.30 |
| Gender risk (e.g. PPH for female) | +0.15 |
| Age risk (e.g. neonatal fever for < 28 days) | +0.20 |
| BMI risk (e.g. hypertension, diabetes) | +0.10 |
| Hereditary condition flag | +0.15 |
| Seasonal/endemic boost (monsoon for dengue/malaria) | +0.10 |
| Comorbidity multiplier | ×1.2 |

**Disease dataset coverage:**
- 145 diseases
- 171 master symptoms
- 1,108 disease-symptom mappings
- Gender / age / BMI / hereditary risk modifiers

### 7.2 Risk Classification Rules (Rule Engine)

Applied deterministically before any LLM:

```typescript
const IMMEDIATE_REFERRAL_TRIGGERS = [
  { symptom: 'SpO2',         operator: '<',  value: 90,  reason: 'Severe hypoxia' },
  { symptom: 'RR',           operator: '>',  value: 60,  reason: 'Respiratory distress (child)' },
  { symptom: 'HR',           operator: '>',  value: 150, reason: 'Tachycardia' },
  { symptom: 'consciousness', value: 'unconscious', reason: 'Altered sensorium' },
  { symptom: 'convulsions',   value: true,   reason: 'Active seizure' },
  { symptom: 'bleeding',      value: 'severe', reason: 'Haemorrhage' },
  { symptom: 'temp',         operator: '>',  value: 40,  reason: 'Hyperpyrexia' },
];
```

### 7.3 Confidence Score Calculation

```typescript
const computeConfidence = (bundle: RetrievalBundle): number => {
  let score = 0;

  // Source coverage (0.0 – 0.4)
  if (bundle.pageIndexNodes.length > 0)  score += 0.15;
  if (bundle.ftsResults.length > 0)      score += 0.10;
  if (bundle.vectorMatches.length > 0)   score += 0.15;

  // Agreement bonus (0.0 – 0.3)
  score += Math.min(bundle.agreements.length * 0.10, 0.30);

  // Conflict penalty
  score -= bundle.conflicts.length * 0.10;

  // Disease score boost
  if (topDiseaseScore > 0.75) score += 0.20;
  if (topDiseaseScore > 0.50) score += 0.10;

  return Math.max(0, Math.min(1, score));
};
```

### 7.4 MobileBERT Intent Classification (Tier 1 Query Router)

Routes the user query to the correct PageIndex subtree before tree traversal:

| Intent Class | PageIndex Target |
|---|---|
| `fever_child` | `who_imci_tree` → Fever → Age group |
| `fever_adult` | `icmr_dengue` / `icmr_malaria` |
| `respiratory` | `gina_asthma_tree` / `who_imci_tree` → Cough |
| `maternal` | `who_anc_tree` |
| `neonatal` | `nnf_imnci_tree` |
| `tb_symptoms` | `icmr_tb_tree` |
| `medicine_query` | `nlem_2022_tree` |
| `ayurveda_query` | `ayurveda_kb_tree` |
| `nutrition` | `icmr_anaemia_tree` |

---

## 8. Data Sources & Knowledge Base

### 8.1 Clinical Guidelines (PageIndex Sources)

Primary sources indexed into PageIndex trees and bundled in APK.

| # | Source | Publisher | Domain | PageIndex File |
|---|---|---|---|---|
| 1 | WHO IMCI — Integrated Management of Childhood Illness | WHO | Child illness triage, fever, cough, diarrhoea, malnutrition | `who_imci_tree.json` |
| 2 | WHO Antenatal Care Recommendations | WHO | ANC protocols, maternal risk scoring | `who_anc_tree.json` |
| 3 | ICMR TB Management Guidelines | ICMR / NTEP | TB diagnosis, treatment, drug regimens | `icmr_tb_tree.json` |
| 4 | ICMR Nutritional Anaemia Guidelines | ICMR | Iron deficiency, B12, folate | `icmr_anaemia_tree.json` |
| 5 | National List of Essential Medicines 2022 | MoHFW | 384 essential drugs, dosages, indications | `nlem_2022_tree.json` |
| 6 | NNF India Neonatal Care Guidelines (IMNCI) | National Neonatology Forum | Neonatal fever, jaundice, sepsis | `nnf_imnci_tree.json` |
| 7 | GINA Global Strategy for Asthma 2023 | GINA | Asthma classification, step therapy | `gina_asthma_tree.json` |
| 8 | Ayurveda Knowledge Base (custom compiled) | Ministry of AYUSH + CCRAS | Prakriti, Doshas, classical herbs, formulations | `ayurveda_kb_tree.json` |

---

### 8.2 Medicine Databases

#### Allopathic / Generic

| # | Source | Publisher | Records | URL |
|---|---|---|---|---|
| 1 | PMBJP Janaushadhi Product Basket | Dept. of Pharmaceuticals, GoI | 2,110 generics + 315 surgicals | https://janaushadhi.gov.in |
| 2 | NLEM 2022 | MoHFW | 384 essential medicines | https://mohfw.gov.in |
| 3 | CDSCO Drug Database | Central Drugs Standard Control Organisation | All licensed allopathic drugs | https://cdsco.gov.in |
| 4 | WHO Essential Medicines List (23rd ed.) | WHO | 500+ global essential medicines | https://who.int |
| 5 | A-Z Medicine Dataset of India (Kaggle) | Community / 1mg | ~12,000 medicines | https://kaggle.com/datasets/shudhanshusingh/az-medicine-dataset-of-india |
| 6 | 250k Medicines Dataset (Kaggle) | Community | 250,000 entries | https://kaggle.com/datasets/shudhanshusingh/250k-medicines-usage-side-effects-and-substitutes |
| 7 | Indian Medicine Dataset (GitHub) | junioralive | ~10,000 entries | https://github.com/junioralive/Indian-Medicine-Dataset |

#### Ayurvedic

| # | Source | Publisher | Coverage |
|---|---|---|---|
| 1 | Ayurvedic Pharmacopoeia of India (API) Parts I & II | Ministry of AYUSH | 444 + 191 formulations, 351+ single drugs |
| 2 | National List of Essential AYUSH Medicines (NLEAM) | Ministry of AYUSH | Govt-approved Ayurvedic formulary |
| 3 | Ayurvedic Formulary of India (AFI) | AYUSH / APC | Classical formulations |
| 4 | CCRAS Clinical Protocols | CCRAS, AYUSH | Disease-specific Ayurvedic protocols |
| 5 | DHARA / AYUSH Research Portal | Govt. of India | Peer-reviewed Ayurveda research |
| 6 | Himalaya Drug Company | Himalaya Wellness | Standardised extract percentages, AYUSH reg nos. |
| 7 | Patanjali Ayurved | Patanjali | SKU names, MRP, AYUSH license numbers |
| 8 | Dabur India | Dabur (est. 1884) | Classical formulations, AFI-faithful |

---

### 8.3 Government Health Programmes (Disease-Specific)

| # | Programme | Diseases Covered | Publisher |
|---|---|---|---|
| 1 | NVBDCP | Dengue, Malaria, Chikungunya, Kala-Azar, Japanese Encephalitis, Filariasis | MoHFW |
| 2 | NTEP (National TB Elimination Programme) | Tuberculosis | MoHFW |
| 3 | National NCD Programme | Hypertension, Diabetes, Cancer, COPD, Heart Disease, Stroke | MoHFW |
| 4 | National Leprosy Eradication Programme (NLEP) | Leprosy | MoHFW |
| 5 | National Programme for Control of Blindness (NPCB) | Vitamin A deficiency, Cataract | MoHFW |
| 6 | National Iodine Deficiency Disorders Control Programme | Goitre, Cretinism | MoHFW |
| 7 | Rashtriya Bal Swasthya Karyakram (RBSK) | Defects, Diseases, Deficiencies, Developmental delays | NHM |
| 8 | Janani Suraksha Yojana / PMSMA | Maternal mortality, ANC, PPH, Puerperal Sepsis | NHM |
| 9 | Integrated Child Development Services (ICDS) | SAM, Stunting, Wasting, Rickets, PEM | Min. Women & Child Development |
| 10 | National Mental Health Programme | Depression, Anxiety, Psychosis | NIMHANS / MoHFW |
| 11 | National Health Mission (NHM) | All ASHA-scope diseases | MoHFW |
| 12 | ICMR Disease Burden Studies | All NCDs and infectious diseases — India-specific prevalence | ICMR |

---

### 8.4 Disease Datasets (Built — In-App + Training)

| # | File | Diseases | Records | Status |
|---|---|---|---|---|
| 1 | `disease_profiles.json` | 31 diseases | 31 profiles | ✅ Complete |
| 2 | `symptom_registry.json` | All | 276 symptoms | ✅ Complete |
| 3 | `symptom_ui_groups.json` | All | 15 UI categories | ✅ Complete |
| 4 | `janaushadhi_disease_mapping.json` | 31 diseases | 2,438 products | ✅ Complete |
| 5 | `ayurvedic_disease_mapping_deduped.json` | 31 diseases | ~6,000 records | ✅ Complete |
| 6 | `llm_training_dataset.jsonl` | 22 diseases | 3,639 Q&A pairs | ✅ Complete |
| 7 | Ayurvedic Dataset 1 (Excel) | 12 diseases (Monsoon/Maternal) | 2,000 records | ✅ Complete |
| 8 | Ayurvedic Dataset 2 (Excel) | 19 diseases (NCDs + Infectious) | 2,000 records | ✅ Complete |
| 9 | Ayurvedic Dataset 3 (Excel) | 18 diseases (Neglected Tropical) | 2,000 records | ✅ Complete |
| 10 | Synthetic CSVs | Dengue, Hypertension, Dehydration, TB, Malaria, Typhoid, Anaemia, UTI, Pneumonia, Diabetes, Asthma, Neonatal Fever, Pregnancy Risk | 1,000 each | ✅ Complete |
| 11 | Remaining disease CSVs | ~100+ diseases | TBD | ⏳ Phase 7 |

---

### 8.5 Diseases Coverage (145 Target)

#### Tier A — Infectious & Vector-Borne (High India Burden)
Dengue, Malaria (P. vivax + P. falciparum), Chikungunya, Typhoid, Tuberculosis, Pneumonia, UTI, Hepatitis A & E, Hepatitis B, Cholera, Amoebic Dysentery, Giardiasis, Kala-Azar, Japanese Encephalitis, Lymphatic Filariasis, Leptospirosis, Scrub Typhus, Rabies, Tetanus, Leprosy

#### Tier B — Non-Communicable Diseases
Hypertension, Type 2 Diabetes, Asthma, COPD, Heart Disease, Stroke, CKD, Obesity, NAFLD, Depression, Anxiety, Cervical Cancer, Breast Cancer, Lung Cancer, Sickle Cell Disease, Thalassaemia

#### Tier C — Maternal & Neonatal
Anaemia in Pregnancy, Pre-eclampsia, Eclampsia, PPH, Puerperal Sepsis, Obstructed Labour, Neonatal Sepsis, Neonatal Jaundice, Neonatal Fever, Preterm Birth, SAM in Children, Rickets, PEM

#### Tier D — Nutritional & Environmental
Iron Deficiency Anaemia, Vitamin A Deficiency, Iodine Deficiency (Goitre), Fluorosis, Arsenicosis, Night Blindness

#### Tier E — Skin & Parasitic
Scabies, Tinea (Fungal), Soil-Transmitted Helminths, Pediculosis, Allergic Rhinitis, Acute Respiratory Infection

#### Tier F — Gastrointestinal
Severe Dehydration, Diarrhoea, Dysentery, Viral Gastroenteritis, Acute Abdomen (referral only)

#### Tier G — Emergency / Acute
Snake Bite, Acute Poisoning, Burns, Trauma (referral triage only)

---

### 8.6 Open / Academic Datasets

| # | Source | Coverage | URL |
|---|---|---|---|
| 1 | NFHS-5 (National Family Health Survey) | Anaemia, malnutrition, maternal health, NCD prevalence by state | https://rchiips.org/nfhs |
| 2 | Global Health Observatory (WHO GHO) | Country-level disease prevalence | https://who.int/data/gho |
| 3 | UCI ML Repository | Heart disease, diabetes, kidney disease | https://archive.ics.uci.edu |
| 4 | PhysioNet | Vital sign time-series, ICU records | https://physionet.org |
| 5 | OpenMRS | EHR-based symptom/diagnosis records | https://openmrs.org |
| 6 | Sample Registration System (SRS) | Cause-of-death data for India | https://censusindia.gov.in |

---

### 8.7 Classification Standards

| Resource | Purpose | URL |
|---|---|---|
| ICD-10 Online Browser (WHO) | Disease code lookup and hierarchy | https://icd.who.int/browse10 |
| ICD-11 | Next-generation disease classification | https://icd.who.int/browse11 |
| ATC Classification (WHO) | Medicine classification by therapeutic use | https://whocc.no/atc_ddd_index |

---

### 8.8 Voice & Language Sources

| # | Source | Languages | URL |
|---|---|---|---|
| 1 | **Bhashini** (Govt. of India, free) | 22 Indian languages — Odia, Hindi, Bengali, Marathi, Kannada, Tamil etc. ASR + TTS | https://bhashini.gov.in |
| 2 | AI4Bharat IndicNLP | NLP models for Indian languages | https://ai4bharat.org |
| 3 | IndicTrans2 | Translation across 22 Indian languages | https://github.com/AI4Bharat/IndicTrans2 |

---

## 9. Cloud Infrastructure

### 9.1 Vector Database

| Property | Value |
|---|---|
| Provider | Qdrant Cloud |
| Tier | Free (1 GB) — sufficient for Phase 1–3 |
| Cost | ₹0 |
| No EC2 | ✅ |
| No VPC | ✅ |
| No NAT Gateway | ✅ |
| Auth | API Key (stored in AWS Secrets Manager) |
| Client | `@qdrant/js-client-rest` |

### 9.2 AWS Bedrock

| Property | Value |
|---|---|
| Model | Claude 3 Haiku |
| Region | `ap-south-1` Mumbai |
| Access | IAM Role on Lambda (no keys in code) |
| Guardrails | Enabled — custom DhanwantariAI guardrail config |
| Cost | ~₹0.004 per escalated query |

### 9.3 Future Cloud (Phase 4+)

| Service | Purpose | When |
|---|---|---|
| S3 `ap-south-1` | OTA model updates (GGUF/LoRA) | Phase 4 |
| DynamoDB | Anonymised usage analytics | Phase 4 |
| CloudWatch | Cost monitoring, query volume | Phase 3 |
| Cognito | Optional ANM/CHO user accounts | Phase 5 |

---

## 10. Privacy & Compliance

### 10.1 DPDP Act 2023

| Requirement | Implementation |
|---|---|
| Data minimisation | No patient PII collected — symptom entry only |
| Purpose limitation | Health guidance only — no analytics on patient data |
| Storage limitation | All patient session data stays on-device, cleared on session end |
| Cross-border restriction | All cloud in `ap-south-1` Mumbai — no US/EU routing |
| Consent | Explicit consent screen before any cloud escalation |
| Right to erasure | Local data — cleared by uninstall |

### 10.2 Data Flow Guarantee

```
Patient Data Flow:
    Device → [Never] → Cloud

Anonymised Vector Flow (future Phase 4):
    Device → PII Strip → Hash → Qdrant Cloud (no re-identification possible)

Bedrock Escalation Flow:
    Query + Clinical Context → PII Strip → Bedrock (ap-south-1) → Response → Device
    [No storage of query in Bedrock — stateless API call]
```

---

## 11. Project File Structure

```
DhanwantariAI/
├── App.tsx
├── index.js
├── package.json
├── tsconfig.json
│
├── src/
│   ├── ai/
│   │   ├── DeviceCapabilityDetector.ts   ← Tier assignment (react-native-device-info)
│   │   ├── DiagnosisEngine.ts            ← 145-disease scoring engine
│   │   ├── LLMEngine.ts                  ← Tier detection + on-device inference
│   │   └── RuleEngine.ts                 ← Deterministic referral/risk rules
│   │
│   ├── retrieval/
│   │   ├── HybridRetrieval.ts            ← PageIndex + FTS5 + Qdrant orchestration
│   │   ├── PageIndexNavigator.ts         ← JSON tree traversal
│   │   ├── FTS5Search.ts                 ← SQLite FTS5 queries
│   │   └── VectorSearch.ts               ← Qdrant Cloud / LanceDB search
│   │
│   ├── cloud/
│   │   ├── BedrockEscalationHandler.ts   ← Confidence check + Bedrock call
│   │   ├── PIIStripper.ts                ← Remove patient identity before cloud
│   │   └── CostMonitor.ts                ← Token usage logging
│   │
│   ├── confidence/
│   │   ├── ConfidenceScorer.ts           ← 0.0–1.0 score from bundle
│   │   └── ResultReconciler.ts           ← Merge + conflict detection
│   │
│   ├── guardrails/
│   │   ├── OnDeviceGuardrails.ts         ← Pre-LLM safety checks
│   │   └── ResponseValidator.ts          ← Post-LLM output validation
│   │
│   ├── db/
│   │   └── LocalDatabase.ts              ← op-sqlite (AES-256)
│   │
│   ├── voice/
│   │   └── BhashiniEngine.ts             ← Odia/Hindi/English ASR + TTS
│   │
│   └── screens/
│       ├── SymptomCheckerScreen.tsx
│       ├── MedicineScreen.tsx
│       ├── LLMChatScreen.tsx
│       └── LLMDownloadPromptScreen.tsx   ← Tier 2/3 opt-in flow
│
├── assets/
│   ├── models/
│   │   ├── gemma3-1b-int4.gguf           ← Tier 2 primary (529 MB, post-install)
│   │   ├── gemma3-4b-int4.gguf           ← Tier 2/3 optional (post-install)
│   │   └── mobilebert-intent.tflite      ← Intent router (25 MB, bundled)
│   │
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
│   │
│   └── vectors/
│       └── lancedb/                      ← Offline fallback vector store
│           └── core_medical/
│
└── scripts/
    ├── build_pageindex.py                ← PDF → PageIndex JSON
    └── ingest_vectors.py                 ← Datasets → LanceDB + Qdrant seed
```

---

## 12. Artefacts Status

| Artefact | Status | Notes |
|---|---|---|
| `disease_profiles.json` (31 diseases) | ✅ Complete | Needs expansion to 145 |
| `symptom_registry.json` (276 symptoms) | ✅ Complete | |
| `symptom_ui_groups.json` (15 categories) | ✅ Complete | |
| `janaushadhi_disease_mapping.json` | ✅ Complete | 2,438 products |
| `ayurvedic_disease_mapping_deduped.json` | ✅ Complete | 49 diseases |
| `llm_training_dataset.jsonl` | ✅ Complete | 3,639 Q&A pairs |
| Ayurvedic Excel datasets (3 files) | ✅ Complete | 6,000 records, 49 diseases |
| Synthetic disease CSVs (13 diseases) | ✅ Complete | 1,000 records each |
| Bare React Native app shell | ✅ Complete | |
| Gemma 3 1B GGUF (RunPod) | ✅ Complete | |
| `DeviceCapabilityDetector.ts` | ⏳ Phase 0 | |
| LLM opt-in download UX | ⏳ Phase 0 | |
| PageIndex tree generation (all PDFs) | ⏳ Phase 1 | Source PDFs needed |
| `HybridRetrieval.ts` | ⏳ Phase 1 | |
| `ConfidenceScorer.ts` | ⏳ Phase 1 | |
| `BedrockEscalationHandler.ts` | ⏳ Phase 3 | |
| Qdrant Cloud setup | ⏳ Phase 3 | Free tier, no infra needed |
| Bedrock Guardrails config | ⏳ Phase 3 | |
| Bhashini voice integration | ⏳ Phase 5 | |
| LoRA language adapters | ⏳ Phase 5 | Hindi, Odia, Marathi, Kannada |
| DPDP compliance audit | ⏳ Phase 6 | |

---

*Document maintained by AppScale LLP — DhanwantariAI Project*  
*LLPIN: ACP-6024 | appscale.in | Bengaluru, India*
