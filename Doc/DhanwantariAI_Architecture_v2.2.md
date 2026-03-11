# DhanwantariAI — Full System Architecture v2.2

> **Version:** v2.2 — Production-Grade Clinical AI Architecture  
> **Owner:** AppScale LLP · Satyam Kumar Das  
> **LLPIN:** ACP-6024 · appscale.in  
> **Last Updated:** March 2026  
> **Tagline:** *Ancient Name. Modern Intelligence.*  
> **Product:** Offline-first AI Clinical Decision Support for Rural Healthcare Professionals  
> **Regulatory Classification:** Clinical Decision Support System (CDSS) — non-autonomous, advisory only

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Regulatory Classification & Compliance Roadmap](#2-regulatory-classification--compliance-roadmap)
3. [Liability Architecture & Human Oversight](#3-liability-architecture--human-oversight)
4. [Device Capability Detection](#4-device-capability-detection)
5. [Tier Definitions & AI Stack](#5-tier-definitions--ai-stack)
6. [Clinical Safety Engine](#6-clinical-safety-engine)
7. [Hybrid Retrieval Architecture](#7-hybrid-retrieval-architecture)
8. [Confidence Scoring — Multi-Signal Architecture](#8-confidence-scoring--multi-signal-architecture)
9. [AWS Bedrock + Claude Haiku Integration](#9-aws-bedrock--claude-haiku-integration)
10. [Medical Liability Protection Layer](#10-medical-liability-protection-layer)
11. [Security Architecture](#11-security-architecture)
12. [Patient Data Privacy & Consent Management](#12-patient-data-privacy--consent-management)
13. [Multilingual Normalization Layer](#13-multilingual-normalization-layer)
14. [Dataset Governance & Medical Provenance](#14-dataset-governance--medical-provenance)
15. [Knowledge Update & KB Patch Architecture](#15-knowledge-update--kb-patch-architecture)
16. [Model Update & Rollback Governance](#16-model-update--rollback-governance)
17. [Observability & Telemetry](#17-observability--telemetry)
18. [Bias & Safety Evaluation Framework](#18-bias--safety-evaluation-framework)
19. [Clinical Validation Framework](#19-clinical-validation-framework)
20. [Structured Feedback Loop](#20-structured-feedback-loop)
21. [Real-World Risk Management](#21-real-world-risk-management)
22. [Data Sources & Knowledge Base](#22-data-sources--knowledge-base)
23. [Cloud Infrastructure](#23-cloud-infrastructure)
24. [Project File Structure](#24-project-file-structure)
25. [Artefacts Status & TODO](#25-artefacts-status--todo)

---

## 1. System Overview

DhanwantariAI is an **offline-first Clinical Decision Support System (CDSS)** for ASHA workers, ANMs, and rural healthcare professionals in India. It provides advisory guidance on disease assessment, medicine information, and referral triage — it does **not** diagnose, prescribe, or replace a qualified clinician.

### Core Design Principles

| Principle | Implementation |
|---|---|
| Offline first | 100% functionality with zero internet on Tier 1 |
| Advisory only | System suggests — ASHA worker decides |
| PageIndex is the truth | LLM synthesises language; clinical facts from indexed protocols |
| User consent for LLM | No model loaded without explicit opt-in |
| Zero PII in cloud | Patient data never leaves device |
| Source-cited answers | Every answer traces to a WHO/ICMR/NLEM section |
| DPDP Act 2023 compliant | All cloud in `ap-south-1` Mumbai |
| Clinician override always wins | AI output never supersedes human judgement |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ON-DEVICE LAYER                          │
│                                                                 │
│  User Query (voice/text)                                        │
│       │                                                         │
│       ▼                                                         │
│  Multilingual Normalizer ──→ Medical Ontology Mapper            │
│       │                                                         │
│       ▼                                                         │
│  DeviceCapabilityDetector → Tier 1 / 2 / 3                     │
│       │                                                         │
│       ▼                                                         │
│  Clinical Safety Engine (always runs — pre-retrieval)           │
│  └── Red Flag Detector → IMMEDIATE REFERRAL if triggered        │
│       │                                                         │
│       ▼                                                         │
│  HybridRetrieval (PageIndex + SQLite FTS5)                      │
│  [+ Qdrant Cloud vectors when online]                           │
│       │                                                         │
│       ▼                                                         │
│  Multi-Signal Confidence Scorer                                 │
│       │                                                         │
│  ┌────┴──────────────────────┐                                  │
│  │ Score ≥ 0.80              │ Score < 0.80                     │
│  │ On-Device Answer          │ Bedrock Escalation               │
│  │ (LLM Tier 2/3 or          │ (online only)                    │
│  │  structured Tier 1)       │                                  │
│  └───────────────────────────┘                                  │
│       │                                                         │
│       ▼                                                         │
│  Medical Liability Layer                                        │
│  └── Source citation, disclaimer, ASHA scope check             │
│       │                                                         │
│       ▼                                                         │
│  Response Validator → User Display                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     CLOUD LAYER (Online Only)                   │
│                                                                 │
│  Qdrant Cloud (Free) ← Vector semantic search                   │
│  AWS Bedrock Haiku   ← Low-confidence synthesis                 │
│  S3 ap-south-1       ← OTA KB patch delivery (Phase 4)          │
│  CloudWatch          ← Anonymised telemetry                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Regulatory Classification & Compliance Roadmap

### 2.1 Product Classification

DhanwantariAI is classified as a **non-autonomous Clinical Decision Support System (CDSS)** — advisory tier, not diagnostic.

| Classification Dimension | DhanwantariAI Position |
|---|---|
| **Indian (CDSCO)** | Class A Medical Device (low risk) — Software as Medical Device (SaMD) |
| **WHO Digital Health** | Category 3: Decision Support — healthcare worker tools |
| **FDA SaMD equivalent** | Non-significant risk (advisory, human-in-the-loop, no autonomous action) |
| **Autonomous?** | No — every output requires ASHA worker acceptance |
| **Diagnostic?** | No — "possible assessment" language only, never "diagnosis" |
| **Prescriptive?** | No — "medicine information" only, never "I prescribe" |

### 2.2 Regulatory Compliance Roadmap

```
Phase 1 (Now):
└── DPDP Act 2023 — privacy-by-design architecture
└── NHM Digital Health Guidelines — ASHA scope alignment
└── WHO Digital Health Investment Case — framework alignment

Phase 2 (Pre-pilot):
└── CDSCO SaMD registration (Class A — notified body)
└── NHP / Ayushman Bharat Digital Mission (ABDM) integration readiness
└── Ministry of Health and Family Welfare (MoHFW) clearance for ASHA tool

Phase 3 (Post-pilot):
└── IS/ISO 13485 — Medical device quality management
└── IEC 62304 — Medical device software lifecycle
└── ICMR Ethics Committee approval (clinical pilot study)

Phase 4 (Scale):
└── WHO SMART Guidelines alignment
└── G20 Digital Health Declaration compliance review
└── State NHM procurement qualification
```

### 2.3 Compliance Frameworks Reference

| Framework | Applicability | Status |
|---|---|---|
| **DPDP Act 2023** (India) | Patient data privacy, consent, storage | ✅ Designed in |
| **CDSCO Medical Device Rules 2017** | SaMD classification, registration | ⏳ Phase 2 |
| **ABDM Health Data Management Policy** | Health ID integration, data portability | ⏳ Phase 3 |
| **WHO Digital Health Guidelines (2019)** | CDSS for healthcare workers | ✅ Aligned |
| **IEC 62304** | Medical device software lifecycle | ⏳ Phase 3 |
| **IS/ISO 13485** | Medical device quality management | ⏳ Phase 3 |
| **HIPAA** (if US partners/funding) | PHI protection — offshore compliance | ⏳ Phase 4 |

---

## 3. Liability Architecture & Human Oversight

### 3.1 Liability Ownership Framework

```
┌────────────────────────────────────────────────────────────┐
│                   LIABILITY CHAIN                          │
│                                                            │
│  AppScale LLP                                              │
│  └── Platform accuracy, system availability               │
│  └── Knowledge base correctness (WHO/ICMR sourced)         │
│  └── Guardrail effectiveness                               │
│  └── NOT liable for ASHA worker's final clinical action    │
│                                                            │
│  ASHA Worker / ANM                                         │
│  └── Final clinical decision (always human-made)          │
│  └── Referral execution                                    │
│  └── Patient communication                                 │
│                                                            │
│  Government / NHM                                          │
│  └── ASHA worker training standards                        │
│  └── Clinical protocol authority (ICMR/WHO compliance)    │
│  └── Deployment authorization                              │
└────────────────────────────────────────────────────────────┘
```

**Key legal protection measures:**
- All outputs labelled "Advisory Guidance — Not a Diagnosis"
- Every response cites the specific WHO/ICMR/NLEM source section
- Mandatory disclaimer on every screen with medical content
- ASHA worker must tap "I understand this is advisory" to proceed
- Audit log of all interactions (anonymised, no PII) for liability defence
- Terms of Use explicitly state tool is a decision-support aid, not a medical practitioner

### 3.2 Human Oversight Mechanisms

```
Level 1 — ASHA Worker (always)
    Every AI output requires explicit ASHA acknowledgement.
    "Proceed with this guidance" tap before any action.

Level 2 — PHC Medical Officer (when escalated)
    App generates a structured referral summary (PDF/share)
    for the receiving PHC doctor — not a diagnostic document.

Level 3 — Supervisor ANM / CHO (periodic)
    Supervisor review screen showing flagged high-risk cases
    from their ASHA cohort (anonymised, consent-based).

Level 4 — AppScale Clinical Advisory Board (quarterly)
    Medical advisory board reviews aggregate outputs,
    false negative rates, and knowledge base gaps.
    Board composition: 2 public health physicians,
    1 ICMR-affiliated researcher, 1 NHM representative.
```

### 3.3 Override Rules (Non-Negotiable)

```typescript
const OVERRIDE_RULES = {
  // Rule Engine ALWAYS beats LLM — no exceptions
  ruleEngineBeatsLLM: true,

  // If red flag fired → IMMEDIATE REFERRAL shown regardless of LLM output
  redFlagSuppressesLLM: true,

  // Human override always available — ASHA can dismiss any AI suggestion
  humanOverrideAlwaysAvailable: true,

  // No autonomous action — app never sends messages, never calls anyone
  noAutonomousAction: true,

  // Emergency contacts always visible — never hidden by AI output
  emergencyContactsAlwaysPinned: true,
};
```

---

## 4. Device Capability Detection

### 4.1 Library

```bash
npm install react-native-device-info
```

### 4.2 Enhanced Multi-Signal Detection

Device tier is not determined by RAM alone. Five signals are combined:

```typescript
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DeviceTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export interface DeviceProfile {
  tier:               DeviceTier;
  ramGB:              number;
  freeDiskGB:         number;
  isLowRam:           boolean;      // Android system flag
  apiLevel:           number;       // NNAPI available at API 27+
  model:              string;
  brand:              string;
  cpuArch:            string;       // arm64-v8a preferred for LLM
  nnApiSupported:     boolean;      // Hardware acceleration
  llmEligible:        boolean;
  llmModelSuggested:  string | null;
  detectedAt:         string;       // ISO timestamp
}

const TIER_CACHE_KEY = 'dhanwantari_device_profile_v2';

export const detectDeviceCapability = async (): Promise<DeviceProfile> => {
  const cached = await AsyncStorage.getItem(TIER_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const [
    totalRAM, freeDisk, isLowRam,
    model, brand, apiLevel, supportedABIs,
  ] = await Promise.all([
    DeviceInfo.getTotalMemory(),
    DeviceInfo.getFreeDiskStorage(),
    DeviceInfo.isLowRamDevice(),
    DeviceInfo.getModel(),
    DeviceInfo.getBrand(),
    DeviceInfo.getApiLevel(),
    DeviceInfo.supportedAbis(),       // ['arm64-v8a', 'armeabi-v7a'] etc.
  ]);

  const ramGB      = totalRAM / 1024 / 1024 / 1024;
  const freeDiskGB = freeDisk / 1024 / 1024 / 1024;

  // NNAPI hardware acceleration: API 27+ AND arm64
  const cpuArch       = supportedABIs[0] ?? 'unknown';
  const nnApiSupported = apiLevel >= 27 && cpuArch.includes('arm64');

  // Five-signal tier decision
  // Signal 1: Android low-RAM flag (most reliable — set by manufacturer)
  // Signal 2: Physical RAM
  // Signal 3: Free disk (LLM needs 600 MB–2.5 GB free)
  // Signal 4: CPU architecture (arm64 required for efficient LLM)
  // Signal 5: Android API level (modern OS = better memory management)

  let tier: DeviceTier;
  let llmModelSuggested: string | null = null;

  const hardLowRam  = isLowRam || ramGB < 2;
  const noARM64     = !cpuArch.includes('arm64');
  const oldAndroid  = apiLevel < 26;

  if (hardLowRam || noARM64 || oldAndroid) {
    tier = 'TIER_1';
  } else if (ramGB < 8 && freeDiskGB > 2.5) {
    tier = 'TIER_2';
    llmModelSuggested = 'gemma3-1b-int4';   // 529 MB
  } else if (ramGB >= 8 && freeDiskGB > 4) {
    tier = 'TIER_3';
    llmModelSuggested = 'gemma3-4b-int4';   // ~2.5 GB
  } else {
    tier = 'TIER_1';                         // Disk too full — safe fallback
  }

  const profile: DeviceProfile = {
    tier, ramGB: +ramGB.toFixed(2),
    freeDiskGB: +freeDiskGB.toFixed(2),
    isLowRam, apiLevel, model, brand,
    cpuArch, nnApiSupported,
    llmEligible: tier !== 'TIER_1',
    llmModelSuggested,
    detectedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(TIER_CACHE_KEY, JSON.stringify(profile));
  return profile;
};
```

### 4.3 Five-Signal Decision Matrix

| Signal | Tier 1 Trigger | Tier 2 | Tier 3 |
|---|---|---|---|
| `isLowRamDevice()` | `true` → force Tier 1 | `false` | `false` |
| Physical RAM | `< 2 GB` | `2–8 GB` | `≥ 8 GB` |
| Free Disk | Any | `> 2.5 GB` | `> 4 GB` |
| CPU Arch | Not arm64 → force Tier 1 | arm64 | arm64 |
| API Level | `< 26` → force Tier 1 | `≥ 26` | `≥ 27` (NNAPI) |

**Why MobileBERT is replaced:** MobileBERT at 25 MB is acceptable for Tier 1 intent routing, but it requires TFLite runtime which adds memory overhead on < 2 GB devices. Replacement: **SQLite FTS5 keyword-based intent routing** for Tier 1 (zero additional RAM), MobileBERT only on Tier 2+.

---

## 5. Tier Definitions & AI Stack

### 5.1 Tier Summary

| | **Tier 1** | **Tier 2** | **Tier 3** |
|---|---|---|---|
| **RAM** | < 2 GB or isLowRam or non-arm64 | 2–8 GB, arm64 | ≥ 8 GB, arm64 |
| **Typical Devices** | Old budget Androids | Redmi Note 10, Realme 8, Samsung A23 | Redmi Note 12 Pro, Samsung A54 |
| **Typical Users** | ASHA frontline workers | ASHA + ANMs | ANMs, CHOs, supervisors |
| **Intent Router** | SQLite FTS5 keyword match | MobileBERT TFLite | MobileBERT TFLite |
| **PageIndex** | ✅ Always | ✅ Always | ✅ Always |
| **SQLite FTS5** | ✅ Always | ✅ Always | ✅ Always |
| **Vectors (offline)** | ❌ Too heavy | ✅ LanceDB local | ✅ LanceDB local |
| **Vectors (online)** | ❌ | ✅ Qdrant Cloud | ✅ Qdrant Cloud |
| **LLM** | ❌ None | ✅ User opt-in | ✅ User opt-in |
| **LLM Model** | — | Gemma 3 1B int4 (529 MB) | Gemma 3 4B int4 (~2.5 GB) |
| **Bedrock Escalation** | ✅ Online only | ✅ Online only | ✅ Online only |

> **Note on Tier 1 vectors:** LanceDB adds 80–150ms latency and ~200 MB RAM on Tier 1 devices. For < 2 GB RAM devices, vector search is **excluded** — PageIndex + FTS5 provides deterministic retrieval which is sufficient and more reliable.

### 5.2 Tier 2 LLM Opt-In Flow

```
First launch after Tier 2 detection:
┌─────────────────────────────────────────────────────────┐
│  AI Assistant Available                                 │
│                                                         │
│  Download DhanwantariAI Assistant? (529 MB)             │
│  ✓ Works fully offline after download                   │
│  ✓ Requires Wi-Fi · One-time download                   │
│  ✓ Your patient data never leaves this device           │
│                                                         │
│  [Download on Wi-Fi]        [Use basic mode]            │
└─────────────────────────────────────────────────────────┘

Post-download:
- SHA-256 integrity check before activation
- AES-256 encryption, device-bound key
- Model stored in app private directory (inaccessible to other apps)
```

---

## 6. Clinical Safety Engine

The Clinical Safety Engine runs **before any retrieval or LLM inference** on every query. It cannot be bypassed.

### 6.1 Red Flag Detection (Immediate Referral Triggers)

```typescript
interface RedFlagRule {
  id:        string;
  symptom:   string;
  operator:  'lt' | 'gt' | 'eq' | 'present';
  value?:    number | string | boolean;
  reason:    string;
  referTo:   'PHC' | 'CHC' | 'FRU' | 'HOSPITAL_EMERGENCY';
  icdRef:    string;   // ICD-10 associated condition
  sourceRef: string;   // WHO/ICMR guideline reference
}

const RED_FLAG_RULES: RedFlagRule[] = [

  // === RESPIRATORY ===
  { id: 'RF001', symptom: 'SpO2',           operator: 'lt', value: 90,
    reason: 'Severe hypoxia',               referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'J96', sourceRef: 'WHO_IMCI_C3' },

  { id: 'RF002', symptom: 'respiratory_rate', operator: 'gt', value: 60,
    reason: 'Severe respiratory distress (child < 2 months)',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'P22', sourceRef: 'NNF_IMNCI_S2' },

  { id: 'RF003', symptom: 'respiratory_rate', operator: 'gt', value: 50,
    reason: 'Fast breathing (child 2–12 months)',
    referTo: 'CHC',
    icdRef: 'J18', sourceRef: 'WHO_IMCI_C2' },

  // === CARDIOVASCULAR ===
  { id: 'RF004', symptom: 'heart_rate',     operator: 'gt', value: 150,
    reason: 'Tachycardia — possible dengue shock / sepsis',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'R00.0', sourceRef: 'NVBDCP_DENGUE_S4' },

  { id: 'RF005', symptom: 'systolic_bp',    operator: 'lt', value: 90,
    reason: 'Hypotensive shock',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'R57', sourceRef: 'WHO_IMCI_C7' },

  { id: 'RF006', symptom: 'systolic_bp',    operator: 'gt', value: 160,
    reason: 'Hypertensive crisis — possible pre-eclampsia',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'O14', sourceRef: 'WHO_ANC_B4' },

  // === NEUROLOGICAL ===
  { id: 'RF007', symptom: 'consciousness',  operator: 'eq', value: 'unconscious',
    reason: 'Altered sensorium / coma',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'R55', sourceRef: 'WHO_IMCI_C1' },

  { id: 'RF008', symptom: 'convulsions',    operator: 'present',
    reason: 'Active seizure / febrile convulsion',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'R56', sourceRef: 'WHO_IMCI_C4' },

  { id: 'RF009', symptom: 'neck_stiffness', operator: 'present',
    reason: 'Possible meningitis',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'G03', sourceRef: 'WHO_IMCI_C5' },

  // === TEMPERATURE ===
  { id: 'RF010', symptom: 'temperature',    operator: 'gt', value: 40.5,
    reason: 'Hyperpyrexia — immediate cooling + referral',
    referTo: 'CHC',
    icdRef: 'R50', sourceRef: 'WHO_IMCI_C2' },

  { id: 'RF011', symptom: 'temperature',    operator: 'lt', value: 35.5,
    reason: 'Hypothermia — neonatal emergency',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'P80', sourceRef: 'NNF_IMNCI_S3' },

  // === BLEEDING / MATERNAL ===
  { id: 'RF012', symptom: 'bleeding_severity', operator: 'eq', value: 'severe',
    reason: 'Haemorrhage — possible dengue/PPH',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'O72', sourceRef: 'WHO_ANC_B8' },

  { id: 'RF013', symptom: 'postpartum_bleeding', operator: 'present',
    reason: 'Postpartum haemorrhage — life threatening',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'O72.1', sourceRef: 'WHO_ANC_B9' },

  // === NEONATAL ===
  { id: 'RF014', symptom: 'neonatal_age_days', operator: 'lt', value: 7,
    reason: 'Neonate < 7 days with any fever/feeding issue',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'P36', sourceRef: 'NNF_IMNCI_S1' },

  { id: 'RF015', symptom: 'jaundice_day1',    operator: 'present',
    reason: 'Neonatal jaundice day 1 — pathological',
    referTo: 'CHC',
    icdRef: 'P58', sourceRef: 'NNF_IMNCI_S4' },

  // === HYDRATION / NUTRITION ===
  { id: 'RF016', symptom: 'unable_to_drink',  operator: 'present',
    reason: 'Cannot drink/breastfeed — severe dehydration',
    referTo: 'CHC',
    icdRef: 'E86', sourceRef: 'WHO_IMCI_C6' },

  { id: 'RF017', symptom: 'sunken_eyes',      operator: 'present',
    reason: 'Severe dehydration signs',
    referTo: 'PHC',
    icdRef: 'E86', sourceRef: 'WHO_IMCI_C6' },

  // === SNAKEBITE / POISONING ===
  { id: 'RF018', symptom: 'snakebite',        operator: 'present',
    reason: 'Snakebite — anti-venom needed within 2 hours',
    referTo: 'HOSPITAL_EMERGENCY',
    icdRef: 'T63.0', sourceRef: 'NVBDCP_SNAKE' },
];
```

### 6.2 Emergency Triage Logic

```typescript
class ClinicalSafetyEngine {

  evaluate(symptoms: PatientSymptoms): SafetyEvaluation {
    const firedRules = RED_FLAG_RULES.filter(rule =>
      this.evaluateRule(rule, symptoms)
    );

    if (firedRules.length === 0) {
      return { status: 'SAFE_TO_PROCEED', firedRules: [] };
    }

    // Escalate to highest referral level fired
    const referralPriority = ['HOSPITAL_EMERGENCY', 'FRU', 'CHC', 'PHC'];
    const highestReferral = referralPriority.find(level =>
      firedRules.some(r => r.referTo === level)
    ) as ReferralLevel;

    return {
      status:         'IMMEDIATE_REFERRAL',
      firedRules,
      referTo:        highestReferral,
      suppressLLM:    true,    // LLM output hidden — safety takes over
      displayMessage: this.buildEmergencyMessage(firedRules, highestReferral),
      sourcesCited:   firedRules.map(r => r.sourceRef),
    };
  }

  private buildEmergencyMessage(
    rules: RedFlagRule[],
    referTo: ReferralLevel
  ): string {
    const reasons = rules.map(r => `• ${r.reason}`).join('\n');
    return (
      `⚠️ URGENT — Refer to ${referTo} immediately.\n\n` +
      `Warning signs detected:\n${reasons}\n\n` +
      `This guidance is based on: ${rules.map(r => r.sourceRef).join(', ')}\n\n` +
      `Do not delay referral waiting for further assessment.`
    );
  }
}
```

### 6.3 Risk Classification System

```
CRITICAL (Red)  — Life-threatening, immediate action in < 1 hour
    └── Triggers: RF001–RF018 red flag rules
    └── Action: App locks to emergency referral screen
    └── LLM: Suppressed
    └── Show: Emergency contacts (108, local PHC number)

HIGH (Orange)   — Serious, referral within 4–6 hours
    └── Triggers: Top disease score > 0.75 + 2+ moderate symptoms
    └── Action: Strong referral recommendation, track action
    └── LLM: Allowed with mandatory disclaimer

MODERATE (Yellow) — Needs PHC attention within 24–48 hours
    └── Triggers: Disease score 0.50–0.75
    └── Action: PHC referral suggestion, home care guidance
    └── LLM: Allowed

LOW (Green)     — Home management possible
    └── Triggers: Score < 0.50, no red flags
    └── Action: Home care guidance + follow-up cues
    └── LLM: Allowed
```

---

## 7. Hybrid Retrieval Architecture

### 7.1 Strategy by Tier

| Retrieval Layer | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| PageIndex | ✅ | ✅ | ✅ |
| SQLite FTS5 | ✅ | ✅ | ✅ |
| LanceDB (offline vectors) | ❌ | ✅ | ✅ |
| Qdrant Cloud (online vectors) | ❌ | ✅ | ✅ |
| Intent router | FTS5 keyword | MobileBERT | MobileBERT |

**Rationale for excluding vectors from Tier 1:** Deterministic retrieval (PageIndex + FTS5) is more appropriate for < 2 GB devices. It is faster, uses no additional RAM, produces auditable results, and is sufficient for the 145-disease scope defined in the knowledge base.

### 7.2 PageIndex Trees (Bundled in APK)

| Tree File | Source Document | Domain |
|---|---|---|
| `who_imci_tree.json` | WHO IMCI Guidelines | Child illness triage |
| `icmr_tb_tree.json` | ICMR TB Management Guidelines | Tuberculosis |
| `icmr_anaemia_tree.json` | ICMR Nutritional Anaemia Guidelines | Anaemia |
| `nlem_2022_tree.json` | National List of Essential Medicines 2022 | Drug protocols |
| `who_anc_tree.json` | WHO Antenatal Care Recommendations | Maternal health |
| `nnf_imnci_tree.json` | NNF India Neonatal Care Guidelines | Neonatal care |
| `gina_asthma_tree.json` | GINA Global Strategy for Asthma 2023 | Asthma |
| `ayurveda_kb_tree.json` | AYUSH Ayurveda Knowledge Base | Ayurvedic protocols |

### 7.3 Vector Collections (Qdrant Cloud)

**Provider:** Qdrant Cloud Free Tier — no EC2, no VPC, no NAT Gateway  
**Embedding:** MiniLM L6 v2 TFLite (bundled, ~25 MB, 384-dim)

| Collection | Vectors (Est.) | Content |
|---|---|---|
| `disease_symptoms` | ~50,000 | Disease-symptom semantic records |
| `medicines` | ~80,000 | JanAushadhi + Ayurvedic medicine records |
| `clinical_protocols` | ~30,000 | PageIndex node embeddings |

### 7.4 Result Reconciler

```typescript
interface RetrievalBundle {
  pageIndexNodes:   PageIndexNode[];
  ftsResults:       FTSRecord[];
  vectorMatches:    VectorRecord[];   // Empty on Tier 1
  agreements:       Agreement[];      // Facts confirmed by 2+ sources
  conflicts:        Conflict[];       // Facts differing across sources
  sourcesCited:     SourceCitation[]; // For medical liability layer
  retrievalMs:      number;
}

interface SourceCitation {
  text:        string;    // The clinical fact
  source:      string;    // e.g. "WHO IMCI Guidelines, Section 3.2"
  url:         string;    // Source URL
  version:     string;    // e.g. "2023 edition"
  pageRef:     string;    // e.g. "Page 47, Table 3"
}
```

### 7.5 Bedrock Token Budget

```
PageIndex nodes        →  ~800 tokens   (protocol grounding)
Vector top-3 records   →  ~400 tokens   (semantic matches)
Patient context        →  ~200 tokens   (age, gender, symptoms)
System prompt          →  ~300 tokens   (ASHA framing + safety)
────────────────────────────────────────
Total to Haiku         →  ~1,700 tokens (~₹0.004 per escalated query)
```

---

## 8. Confidence Scoring — Multi-Signal Architecture

Replaces the previous single-threshold scoring with a **six-signal weighted model**.

### 8.1 Signal Weights

```typescript
interface ConfidenceSignals {
  retrievalCoverage:  number;  // 0–1: How many retrieval sources returned results
  sourceAgreement:    number;  // 0–1: Do PageIndex + vector results agree?
  diseaseScoreStrength: number; // 0–1: Strength of top disease match
  symptomSpecificity: number;  // 0–1: Are symptoms highly specific to one disease?
  patientContextMatch: number; // 0–1: Does patient age/gender fit disease profile?
  knowledgeDepth:     number;  // 0–1: How deeply indexed is this disease?
}

const SIGNAL_WEIGHTS = {
  retrievalCoverage:    0.20,
  sourceAgreement:      0.25,  // Highest — agreement is the strongest signal
  diseaseScoreStrength: 0.20,
  symptomSpecificity:   0.15,
  patientContextMatch:  0.10,
  knowledgeDepth:       0.10,
};

const computeConfidence = (
  bundle: RetrievalBundle,
  diseaseScores: DiseaseScore[],
  patient: PatientContext,
): number => {
  const signals: ConfidenceSignals = {

    // Signal 1: Coverage — did all available sources return results?
    retrievalCoverage: (
      (bundle.pageIndexNodes.length > 0 ? 0.4 : 0) +
      (bundle.ftsResults.length > 0      ? 0.3 : 0) +
      (bundle.vectorMatches.length > 0   ? 0.3 : 0)
    ),

    // Signal 2: Agreement — do sources say the same thing?
    sourceAgreement: Math.min(bundle.agreements.length * 0.20, 1.0)
                   - (bundle.conflicts.length * 0.15),

    // Signal 3: Disease match strength
    diseaseScoreStrength: diseaseScores[0]?.score ?? 0,

    // Signal 4: Symptom specificity — how unique are the symptoms?
    symptomSpecificity: computeSymptomSpecificity(bundle.ftsResults),

    // Signal 5: Patient context fit
    patientContextMatch: computePatientFit(diseaseScores[0], patient),

    // Signal 6: Knowledge depth
    knowledgeDepth: bundle.pageIndexNodes.length > 3 ? 1.0
                  : bundle.pageIndexNodes.length > 1 ? 0.6
                  : 0.3,
  };

  const weighted = Object.entries(SIGNAL_WEIGHTS).reduce(
    (sum, [key, weight]) =>
      sum + (signals[key as keyof ConfidenceSignals] * weight), 0
  );

  return Math.max(0, Math.min(1, weighted));
};
```

### 8.2 Confidence Bands & Actions

| Band | Score Range | Label | Action |
|---|---|---|---|
| **Very High** | 0.85–1.00 | Confident | On-device answer, no disclaimer |
| **High** | 0.70–0.84 | Likely accurate | On-device answer, soft source citation |
| **Moderate** | 0.55–0.69 | Possible | Answer with "Based on protocol…" framing + verify button |
| **Low** | 0.40–0.54 | Uncertain | Auto-escalate to Bedrock, show loading indicator |
| **Very Low** | 0.00–0.39 | Insufficient | Bedrock escalation + "Consulting clinical database…" |
| **No Retrieval** | 0.00 (special) | Not found | Bedrock + "This may be outside our current knowledge" |

---

## 9. AWS Bedrock + Claude Haiku Integration

### 9.1 Model Selection

| Model | Bedrock ID | Cost | Decision |
|---|---|---|---|
| Claude 3 Haiku | `anthropic.claude-3-haiku-20240307-v1:0` | $0.25/$1.25 per 1M | ✅ **Selected** |
| Amazon Titan Text Express | `amazon.titan-text-express-v1` | $0.20/$0.60 per 1M | Fallback |

### 9.2 Rate Limiting & Cost Control

```typescript
class BedrockCostController {

  private readonly DAILY_LIMIT_QUERIES   = 10_000;  // Hard cap per day
  private readonly MONTHLY_BUDGET_USD    = 15;       // ~₹1,250/month
  private readonly TOKENS_PER_QUERY_AVG  = 2_000;    // Input + output combined
  private readonly ALERT_THRESHOLD       = 0.80;     // Alert at 80% budget used

  async canEscalate(userId: string): Promise<EscalationDecision> {
    const [dailyCount, monthlySpend] = await Promise.all([
      this.getDailyCount(),
      this.getMonthlySpend(),
    ]);

    if (dailyCount >= this.DAILY_LIMIT_QUERIES) {
      return { allowed: false, reason: 'daily_limit', fallback: 'pageindex_only' };
    }

    if (monthlySpend >= this.MONTHLY_BUDGET_USD) {
      return { allowed: false, reason: 'budget_exceeded', fallback: 'pageindex_only' };
    }

    return { allowed: true };
  }

  async logUsage(inputTokens: number, outputTokens: number): Promise<void> {
    const cost = (inputTokens * 0.00000025) + (outputTokens * 0.00000125);
    await this.metricsStore.increment('bedrock_queries', 1);
    await this.metricsStore.increment('bedrock_spend_usd', cost);
    if (await this.getMonthlySpend() > this.MONTHLY_BUDGET_USD * this.ALERT_THRESHOLD) {
      await this.alertOps('Bedrock spend at 80% of monthly budget');
    }
  }
}
```

### 9.3 Fallback Chain

```
Step 1: On-device (always first)
    └── Resolves 70–80% of queries

Step 2: AWS Bedrock Claude 3 Haiku (online, confidence < 0.70)
    └── Region: ap-south-1 Mumbai
    └── Guardrails: Enabled
    └── PII: Stripped before call
    └── Resolves ~20–25%

Step 3: Public Cloud — last resort
    └── Only on Bedrock outage/rate limit
    └── PII stripped, logged separately
    └── < 5% of queries

Step 4: Graceful degradation
    └── If all cloud unavailable → PageIndex structured answer only
    └── Message: "Showing protocol-based guidance (offline mode)"
```

---

## 10. Medical Liability Protection Layer

### 10.1 Source Citation Engine

Every response — on-device or cloud — must include source citations.

```typescript
interface CitedResponse {
  answer:       string;
  riskLevel:    RiskLevel;
  sources:      SourceCitation[];
  guidelineRef: string;          // e.g. "WHO IMCI 2023, Section 3.2, Page 47"
  disclaimer:   string;
  generatedBy:  'pageindex' | 'llm_tier2' | 'llm_tier3' | 'bedrock';
  timestamp:    string;
  appVersion:   string;          // For audit trail
  kbVersion:    string;          // Knowledge base version at time of response
}
```

### 10.2 Mandatory Disclaimers

```typescript
const DISCLAIMERS = {

  general:
    "This guidance is advisory only. It is based on WHO and ICMR clinical protocols. " +
    "DhanwantariAI does not replace a qualified doctor. " +
    "Always use your clinical judgement.",

  referral:
    "⚠️ This assessment suggests referral. Please refer the patient as indicated. " +
    "Do not delay referral based on this app's guidance.",

  medicine:
    "Medicine information is for reference only. Dosages must be confirmed with a " +
    "Medical Officer or the NLEM 2022 before administration.",

  lowConfidence:
    "This response has low confidence. The clinical database has limited information " +
    "on this presentation. Consult a Medical Officer.",

  ayurveda:
    "Ayurvedic information is provided as complementary guidance. " +
    "Follow ASHA protocol guidelines as primary decision basis.",
};
```

### 10.3 Audit Log (No PII)

Every clinical interaction is logged locally (no PII, no cloud sync):

```typescript
interface AuditEntry {
  sessionId:       string;          // Random UUID per session, no user identity
  timestamp:       string;
  tier:            DeviceTier;
  queryIntent:     string;          // e.g. "fever_child"
  redFlagsFired:   string[];        // Rule IDs
  riskLevel:       RiskLevel;
  confidenceScore: number;
  escalatedTo:     'none' | 'bedrock' | 'public_cloud';
  sourcesCited:    string[];        // Source IDs only
  kbVersion:       string;
  appVersion:      string;
  // NO symptoms, NO patient details, NO diagnosis in log
}
```

---

## 11. Security Architecture

### 11.1 Device Security

| Layer | Implementation |
|---|---|
| SQLite encryption | `op-sqlite` with AES-256, device-bound key via Android Keystore |
| LLM model encryption | AES-256, key derived from device hardware ID — not transferable |
| Model integrity | SHA-256 hash verified before every model load |
| App private storage | Models in app-private directory (`/data/data/com.appscale.dhanwantari/`) |
| Jailbreak/root detection | `react-native-device-info.isEmulator()` + root check — warn + restrict if rooted |
| Screen capture | Disabled on clinical screens (medical data privacy) |

### 11.2 API Security

| Control | Implementation |
|---|---|
| Qdrant API Key | Stored in Android Keystore, never in code or `.env` in APK |
| AWS Bedrock | IAM Role on Lambda — no access keys in mobile app |
| Certificate pinning | HTTPS with certificate pinning for all cloud endpoints |
| Request signing | All Lambda calls signed with SigV4 |
| Proxy architecture | Mobile app never calls Bedrock directly — calls NestJS Lambda which calls Bedrock |

### 11.3 Transport Security

```
Mobile App
    │
    └── HTTPS (TLS 1.3, cert pinning)
            │
            └── NestJS Lambda (API Gateway)
                    │
                    ├── Qdrant Cloud (HTTPS, API key)
                    └── AWS Bedrock (VPC endpoint, IAM)
```

**The mobile app never has direct Bedrock credentials.** All cloud calls are proxied through the NestJS Lambda which holds the IAM role. This means:
- Credential rotation happens server-side without app updates
- Rate limiting enforced at Lambda level
- PII stripping enforced before Bedrock call

### 11.4 Compliance Controls

| Control | Standard | Implementation |
|---|---|---|
| Data minimisation | DPDP Act § 6 | No PII collected by design |
| Purpose limitation | DPDP Act § 7 | Health guidance only — no analytics on clinical data |
| Storage security | IS/ISO 27001 | AES-256 at rest, TLS 1.3 in transit |
| Access logging | CDSCO SaMD | Anonymised audit log on-device |
| Vulnerability management | IEC 62304 | Dependency scanning in CI pipeline |

---

## 12. Patient Data Privacy & Consent Management

### 12.1 Data Flow Architecture

```
What stays on device (forever):
    ✓ All symptom inputs
    ✓ Patient age, gender, pregnancy status
    ✓ Session history
    ✓ Downloaded LLM model
    ✓ Audit log (no PII)

What goes to cloud (anonymised, with consent):
    → Bedrock: Query text + clinical context (PII stripped) — no storage
    → Qdrant: Pre-computed embeddings only (no raw text)
    → S3: None in Phase 1–3

What NEVER leaves device:
    ✗ Patient name, Aadhaar, phone number
    ✗ Village / exact location
    ✗ ASHA worker identity
    ✗ Raw symptom-patient combinations
```

### 12.2 Consent Management

```typescript
interface ConsentRecord {
  consentVersion:   string;    // e.g. "v1.2" — update on policy change
  consentedAt:      string;
  cloudEscalation:  boolean;   // Did user consent to Bedrock calls?
  anonymousAnalytics: boolean; // Did user consent to anonymised usage data?
  languageShown:    string;    // Odia / Hindi / English
  // Stored locally only — never synced
}

// Required consents before first use:
const REQUIRED_CONSENTS = [
  {
    id: 'cloud_escalation',
    title: 'Internet-based guidance',
    description:
      'When this device is online and the app needs more information, ' +
      'it may send your question (without your personal details) to a ' +
      'secure medical AI service. Your name and village are never shared.',
    required: false,   // Optional — app works without it (Tier 1 mode)
  },
  {
    id: 'advisory_acknowledgement',
    title: 'Understanding the tool',
    description:
      'DhanwantariAI provides guidance based on health protocols. ' +
      'It is not a doctor. You must use your own judgement and follow ' +
      'ASHA training guidelines.',
    required: true,   // Mandatory
  },
];
```

### 12.3 Right to Erasure

```typescript
const clearAllPatientData = async (): Promise<void> => {
  await SQLiteDB.execute('DELETE FROM sessions');
  await SQLiteDB.execute('DELETE FROM symptom_entries');
  await AsyncStorage.multiRemove([
    'dhanwantari_device_profile_v2',
    'consent_record',
    'audit_log',
  ]);
  // LLM model is NOT deleted — it's a downloaded tool, not patient data
};
```

---

## 13. Multilingual Normalization Layer

### 13.1 Problem

ASHA workers and patients use local language terms that do not map directly to medical ontology. Example:

| Spoken Term | Language | Medical Mapping |
|---|---|---|
| "Peeliya" (पीलिया) | Hindi | Jaundice / Hepatitis A / Hepatitis E |
| "Haathipaon" (हाथीपांव) | Hindi | Lymphatic Filariasis |
| "Julo jwara" (ଜୁଲୋ ଜ୍ୱର) | Odia | Malaria (literally "shivering fever") |
| "Dimagi bukhaar" (दिमागी बुखार) | Hindi | Japanese Encephalitis |
| "Kala azar" (काला ज़ार) | Hindi | Visceral Leishmaniasis |
| "Rataundhi" (रतौंधी) | Hindi | Night Blindness / Vitamin A deficiency |
| "Daad" (दाद) | Hindi | Tinea / Fungal infection |

### 13.2 Normalization Architecture

```
Raw Input (Hindi/Odia/Bengali/etc.)
        │
        ▼
Bhashini ASR → Transliterated text
        │
        ▼
LocalTermNormalizer
    ├── Exact match lookup in local_term_dictionary.json
    ├── Fuzzy match (Levenshtein distance ≤ 2)
    └── Phonetic match (Soundex for romanized terms)
        │
        ▼
MedicalOntologyMapper
    ├── Maps normalized term → ICD-10 code
    ├── Maps to internal symptom registry IDs
    └── Returns canonical English medical term + ICD-10
        │
        ▼
HybridRetrieval (now using canonical terms)
```

### 13.3 Local Term Dictionary Structure

```json
{
  "hi": {
    "peeliya":        { "icd10": ["A15","B16","A09"], "symptoms": ["jaundice","yellow_skin"], "canonical": "jaundice" },
    "dimagi_bukhaar": { "icd10": ["A83.0"],            "symptoms": ["high_fever","headache","altered_consciousness"], "canonical": "japanese_encephalitis" },
    "haathipaon":     { "icd10": ["B74.0"],            "symptoms": ["limb_swelling"],         "canonical": "lymphatic_filariasis" },
    "kala_azar":      { "icd10": ["B55.0"],            "symptoms": ["fever_weeks","weight_loss","splenomegaly"], "canonical": "visceral_leishmaniasis" }
  },
  "or": {
    "julo_jwara":     { "icd10": ["B54"],              "symptoms": ["chills","fever","sweating"], "canonical": "malaria" },
    "banta_roga":     { "icd10": ["A00"],              "symptoms": ["rice_water_stool","vomiting"], "canonical": "cholera" }
  },
  "bn": {
    "kala_jwar":      { "icd10": ["B55.0"],            "symptoms": ["prolonged_fever","splenomegaly"], "canonical": "visceral_leishmaniasis" }
  }
}
```

### 13.4 Post-launch Language Pack Delivery

| Language | LoRA Adapter Size | Term Dictionary | Bhashini ASR |
|---|---|---|---|
| Hindi | ~150 MB | ✅ Phase 1 | ✅ Available |
| Odia | ~150 MB | ✅ Phase 1 | ✅ Available |
| Marathi | ~150 MB | ⏳ Phase 5 | ✅ Available |
| Kannada | ~150 MB | ⏳ Phase 5 | ✅ Available |
| Bengali | ~150 MB | ⏳ Phase 5 | ✅ Available |

---

## 14. Dataset Governance & Medical Provenance

### 14.1 Dataset Classification

Every dataset in DhanwantariAI carries a provenance record:

```typescript
interface DatasetProvenance {
  datasetId:       string;          // e.g. "DS_DISEASE_PROFILES_V3"
  name:            string;
  version:         string;          // Semantic versioning: major.minor.patch
  sourceAuthority: SourceAuthority; // WHO | ICMR | MOHFW | AYUSH | COMMUNITY
  sourceUrl:       string;
  sourceVersion:   string;          // e.g. "NLEM 2022 edition"
  retrievedAt:     string;          // When data was pulled from source
  validatedBy:     string;          // AppScale Clinical Advisory Board member
  validatedAt:     string;
  nextReviewDate:  string;          // Annual review mandatory for medical datasets
  changeLog:       ChangeLogEntry[];
  medicalAccuracy: AccuracyRecord;
}

type SourceAuthority =
  | 'WHO'       // World Health Organization
  | 'ICMR'      // Indian Council of Medical Research
  | 'MOHFW'     // Ministry of Health and Family Welfare
  | 'NHM'       // National Health Mission
  | 'AYUSH'     // Ministry of AYUSH
  | 'NVBDCP'    // National Vector Borne Disease Control Programme
  | 'NNF'       // National Neonatology Forum
  | 'GINA'      // Global Initiative for Asthma
  | 'COMMUNITY' // Community dataset — requires enhanced validation
  ;
```

### 14.2 Validation Pipeline

```
New/Updated Dataset
        │
        ▼
Step 1: Source verification
        └── Is it from an authorised publisher?
        └── Is it the current edition?
        └── Is the URL live and correct?
        │
        ▼
Step 2: Medical accuracy review
        └── Clinical Advisory Board member reviews
        └── Cross-reference against 2 independent sources
        └── Flag any India-specific dosage deviations
        │
        ▼
Step 3: Bias assessment
        └── Gender balance check (symptoms across M/F/Pregnant)
        └── Age group coverage (0–2, 2–12, 12–18, 18–60, 60+)
        └── Regional disease prevalence alignment (Odisha/Northeast/South)
        │
        ▼
Step 4: Version tagging + changelog
        └── Semantic version bump
        └── Change log entry: what changed, why, source
        │
        ▼
Step 5: QA testing
        └── Run regression on 50 benchmark clinical cases
        └── Verify no degradation in known-correct cases
        │
        ▼
Step 6: Approved → KB patch release
```

### 14.3 Dataset Registry (Current)

| Dataset ID | Name | Version | Authority | Validated | Next Review |
|---|---|---|---|---|---|
| DS001 | Disease Profiles (31 diseases) | v2.1 | ICMR/WHO | ✅ | Mar 2027 |
| DS002 | Symptom Registry (276 symptoms) | v1.3 | ICMR | ✅ | Mar 2027 |
| DS003 | JanAushadhi Mapping | v3.0 | MOHFW/PMBJP | ✅ | Sep 2026 |
| DS004 | Ayurvedic Mapping (49 diseases) | v2.0 | AYUSH | ✅ | Mar 2027 |
| DS005 | LLM Training JSONL | v1.0 | AppScale + ICMR | ✅ | Jun 2026 |
| DS006 | Red Flag Rules | v1.2 | WHO/ICMR | ✅ | Continuous |
| DS007 | Local Term Dictionary | v1.0 | AppScale + NHM | ⏳ | — |
| DS008 | Remaining disease CSVs (100+) | v0.1 | Mixed | ⏳ | — |

---

## 15. Knowledge Update & KB Patch Architecture

### 15.1 OTA KB Patch System

```
AppScale Backend (S3 ap-south-1)
        │
        └── kb_manifest.json  ← Version registry for all KB components
        └── patches/
            ├── pageindex/    ← Updated PageIndex tree JSONs
            ├── datasets/     ← Updated disease/medicine datasets
            ├── rules/        ← Updated red flag rules
            └── terms/        ← Updated local term dictionaries
```

### 15.2 Update Flow

```typescript
class KBUpdateManager {

  async checkForUpdates(): Promise<UpdateManifest> {
    // Only check when on Wi-Fi — never on mobile data
    const isWifi = await NetInfo.fetch().then(s => s.type === 'wifi');
    if (!isWifi) return { updatesAvailable: false };

    const remote = await fetch(`${S3_KB_BASE}/kb_manifest.json`);
    const local  = await AsyncStorage.getItem('kb_manifest_local');

    return this.diffManifests(local, remote);
  }

  async applyPatch(patch: KBPatch): Promise<void> {
    // 1. Download patch to temp directory
    // 2. Verify SHA-256 integrity
    // 3. Verify medical authority signature
    // 4. Apply atomically (swap, not overwrite — old version preserved)
    // 5. Update local kb_manifest
    // 6. Log patch application in audit log
  }

  async rollback(patchId: string): Promise<void> {
    // Previous version always preserved — atomic swap back
  }
}
```

### 15.3 KB Component Versioning

```json
{
  "kb_version": "3.2.1",
  "components": {
    "who_imci_tree":    { "version": "2023.1", "sha256": "abc123...", "size_kb": 245 },
    "nlem_2022_tree":   { "version": "2022.3", "sha256": "def456...", "size_kb": 312 },
    "red_flag_rules":   { "version": "1.2.0",  "sha256": "ghi789...", "size_kb": 18  },
    "disease_profiles": { "version": "2.1.0",  "sha256": "jkl012...", "size_kb": 157 },
    "local_terms_hi":   { "version": "1.0.0",  "sha256": "mno345...", "size_kb": 42  }
  },
  "min_app_version": "2.0.0",
  "emergency_update": false
}
```

---

## 16. Model Update & Rollback Governance

### 16.1 Model Release Process

```
Step 1: New model trained / fine-tuned (RunPod)
Step 2: Internal evaluation — 200 benchmark clinical Q&A cases
Step 3: Clinical Advisory Board review — medical accuracy assessment
Step 4: Regression vs. current production model
Step 5: Safety evaluation — red flag response correctness (100%)
Step 6: A/B test on 5% of devices (pilot ring)
Step 7: Staged rollout: 5% → 25% → 50% → 100%
Step 8: Rollback trigger: if error rate increases > 2% at any stage
```

### 16.2 Rollback Architecture

```
Device storage:
├── models/
│   ├── gemma3-1b-int4.gguf        ← Active model
│   └── gemma3-1b-int4.gguf.prev   ← Previous version (always kept)
│
└── model_registry.json
    {
      "active":   { "version": "v2.1", "sha256": "...", "deployed": "2026-03-01" },
      "previous": { "version": "v2.0", "sha256": "...", "deployed": "2026-01-15" }
    }
```

```typescript
class ModelRollbackManager {
  async rollback(): Promise<void> {
    const registry = await this.getRegistry();
    if (!registry.previous) throw new Error('No previous version available');

    // Atomic swap — rename active to .new, previous to active
    await FileSystem.rename(ACTIVE_MODEL, ACTIVE_MODEL + '.new');
    await FileSystem.rename(PREV_MODEL, ACTIVE_MODEL);

    // Verify rolled-back model integrity
    const valid = await this.verifyIntegrity(ACTIVE_MODEL, registry.previous.sha256);
    if (!valid) throw new Error('Rollback integrity check failed');

    await this.updateRegistry(registry.previous, registry.active);
  }
}
```

---

## 17. Observability & Telemetry

### 17.1 On-Device Metrics (Local Only)

```typescript
interface SessionMetrics {
  sessionId:          string;     // Random UUID, no user identity
  timestamp:          string;
  tier:               DeviceTier;
  queryCount:         number;
  confidenceScores:   number[];   // Distribution for this session
  escalationCount:    number;     // How many went to Bedrock
  redFlagsTriggered:  number;     // Safety engine activations
  retrievalLatencyMs: number[];   // PageIndex + FTS latency
  llmLatencyMs:       number[];   // If LLM used
  kbVersion:          string;
  appVersion:         string;
  // NO clinical content in telemetry
}
```

### 17.2 Cloud Telemetry (Anonymised, Consent-Based)

Sent to CloudWatch when user has consented to anonymous analytics:

```typescript
const CLOUDWATCH_METRICS = {
  // Operational metrics (no clinical content)
  'DhanwantariAI/ConfidenceScore':     { unit: 'None',  resolution: 60  },
  'DhanwantariAI/EscalationRate':      { unit: 'Count', resolution: 60  },
  'DhanwantariAI/BedrockCost':         { unit: 'None',  resolution: 300 },
  'DhanwantariAI/RedFlagsTriggered':   { unit: 'Count', resolution: 60  },
  'DhanwantariAI/RetrievalLatency':    { unit: 'Ms',    resolution: 60  },
  'DhanwantariAI/LLMLatency':          { unit: 'Ms',    resolution: 60  },
  'DhanwantariAI/KBPatchAdoption':     { unit: 'Count', resolution: 3600},
};
```

### 17.3 Alerting

| Alert | Threshold | Severity | Action |
|---|---|---|---|
| High escalation rate | > 40% of queries to Bedrock | WARNING | Review confidence tuning |
| Bedrock cost spike | > 120% of daily average | WARNING | Check for abuse / rate limit |
| Monthly budget 80% | $12 of $15 spent | WARNING | Alert AppScale ops |
| Red flag suppression failure | Any | CRITICAL | Immediate hotfix |
| KB patch failure | Any device | WARNING | Rollback patch |
| Model integrity failure | Any | CRITICAL | Disable LLM, fallback to PageIndex |

---

## 18. Bias & Safety Evaluation Framework

### 18.1 Bias Dimensions

| Dimension | Test | Acceptance Criterion |
|---|---|---|
| **Gender** | Same symptoms → different outputs for M/F? | Clinically justified differences only |
| **Age** | Correct risk adjustment for 0–2, 2–12, 12–18, 18–60, 60+? | WHO/ICMR age-stratified thresholds applied |
| **Pregnancy** | Correct identification of pregnancy-specific risks? | 100% PPH, pre-eclampsia red flags fire correctly |
| **Region** | Endemic disease bias (Odisha malaria vs. Delhi dengue)? | Seasonal/geographic boosters balanced |
| **Language** | Same query in Hindi vs. Odia → same clinical output? | < 5% variation in risk classification |
| **Low-RAM device** | Tier 1 output vs. Tier 3 output for same case? | Same risk classification, different language quality only |

### 18.2 Evaluation Benchmark

A set of **200 anonymised clinical vignettes** from ICMR/NHM case studies forms the evaluation benchmark:

```
50 vignettes — Pediatric (0–12 years)
50 vignettes — Maternal/Neonatal
50 vignettes — Infectious diseases (dengue, malaria, TB, typhoid)
30 vignettes — NCDs (hypertension, diabetes, asthma)
20 vignettes — Emergencies (red flag cases — 100% must trigger correctly)
```

**Acceptance thresholds:**
- Red flag detection: **100%** — no misses allowed
- Risk classification accuracy: **≥ 90%**
- Referral level correctness: **≥ 85%**
- Gender/age bias: **< 5%** unjustified variation

### 18.3 Continuous Bias Monitoring

After each KB or model update, the full 200-vignette benchmark is re-run automatically in CI before any release.

---

## 19. Clinical Validation Framework

### 19.1 Validation Stages

```
Stage 1 — Internal (Now, Phase 1–2):
    └── 200-vignette benchmark (ICMR case studies)
    └── Clinical Advisory Board review
    └── Red flag rule 100% correctness test

Stage 2 — Simulated Field (Phase 3):
    └── 500 synthetic patient cases
    └── Blind evaluation by 3 public health physicians
    └── Compare DhanwantariAI output vs. clinician judgement
    └── Acceptable: ≥ 85% clinical concordance

Stage 3 — Pilot Field Study (Phase 4):
    └── 50 ASHA workers, 2 districts in Odisha
    └── ICMR Ethics Committee approval obtained
    └── 6-month prospective observational study
    └── Outcome: Referral appropriateness, time-to-referral
    └── Published as peer-reviewed study

Stage 4 — Post-Market Surveillance (Phase 5+):
    └── Continuous monitoring of aggregate outcomes
    └── Annual clinical review by Advisory Board
    └── Adverse event reporting mechanism in-app
```

### 19.2 Adverse Event Reporting

```typescript
// In-app adverse event button — visible on all clinical screens
const reportAdverseEvent = async (event: AdverseEventReport) => {
  // Stored locally (no PII) + anonymised flag sent to AppScale
  await LocalAuditLog.flagAdverseEvent({
    sessionId:    event.sessionId,
    kbVersion:    event.kbVersion,
    appVersion:   event.appVersion,
    eventType:    event.type,      // 'missed_red_flag' | 'wrong_referral' | 'other'
    reportedAt:   new Date().toISOString(),
    // NO patient details
  });
};
```

---

## 20. Structured Feedback Loop

### 20.1 Field Usage → KB Improvement Pipeline

```
ASHA Worker uses app
        │
        └── [Optional] Tap "Was this helpful?" after each response
                │
                ├── 👍 Helpful → Confidence signal (no content logged)
                └── 👎 Not helpful → Anonymised miss-flag logged locally
                        │
                        ▼
                Monthly KB review by Clinical Advisory Board
                        │
                        ▼
                Identify knowledge gaps from miss-flags
                        │
                        ▼
                Update datasets / PageIndex / red flag rules
                        │
                        ▼
                KB patch released → OTA to all devices
```

### 20.2 Supervisor Feedback Channel

ANM supervisors can flag quality issues through the supervisor review screen:

```typescript
interface SupervisorFeedback {
  caseType:    string;          // e.g. "fever_child"
  issueType:   'wrong_referral' | 'missed_red_flag' | 'wrong_medicine' | 'language_issue';
  kbVersion:   string;
  description: string;          // Free text (no patient details)
  submittedAt: string;
}
```

---

## 21. Real-World Risk Management

### 21.1 Risk Classification System

```
CRITICAL (Red) — Life-threatening, act within 1 hour
    └── 18 red flag rules (RF001–RF018)
    └── App behaviour: Lock to emergency referral screen
    └── Show: 108 number, nearest emergency facility
    └── LLM: Suppressed

HIGH (Orange) — Serious, refer within 4–6 hours
    └── Disease score > 0.75 + critical symptom combination
    └── App behaviour: Strong referral recommendation
    └── Show: PHC/CHC guidance, preparation checklist

MODERATE (Yellow) — PHC attention within 24–48 hours
    └── Disease score 0.50–0.75
    └── App behaviour: PHC referral suggestion + home care

LOW (Green) — ASHA-manageable at community level
    └── Score < 0.50, no red flags
    └── App behaviour: Home care guidance + follow-up triggers
```

### 21.2 Escalation Paths by Risk Level

```
CRITICAL → 108 Emergency / Nearest FRU / District Hospital
HIGH     → CHC (Community Health Centre)
MODERATE → PHC (Primary Health Centre)
LOW      → ASHA home visit + ORS/basic treatment
```

### 21.3 Edge Case Handling

| Edge Case | Handling |
|---|---|
| Query outside knowledge scope | "This presentation is outside current guidance. Refer to PHC." |
| Contradictory symptoms | Lower confidence, escalate to Bedrock, flag to supervisor |
| No internet + Tier 1 + no PageIndex match | "Protocol not available offline. Refer to PHC as precaution." |
| Repeated red flag dismissal by ASHA | Lock screen after 3rd dismissal — force referral confirmation |
| Paediatric + pregnancy simultaneously | Paediatric rules take precedence for child; flag maternal risk separately |

---

## 22. Data Sources & Knowledge Base

### 22.1 Clinical Guidelines (PageIndex Sources)

| # | Source | Publisher | Domain | PageIndex File |
|---|---|---|---|---|
| 1 | WHO IMCI Guidelines | WHO | Child illness triage, fever, cough, diarrhoea | `who_imci_tree.json` |
| 2 | WHO Antenatal Care Recommendations | WHO | ANC protocols, maternal risk | `who_anc_tree.json` |
| 3 | ICMR TB Management Guidelines | ICMR / NTEP | TB diagnosis, treatment | `icmr_tb_tree.json` |
| 4 | ICMR Nutritional Anaemia Guidelines | ICMR | Iron deficiency, B12, folate | `icmr_anaemia_tree.json` |
| 5 | National List of Essential Medicines 2022 | MoHFW | 384 essential drugs | `nlem_2022_tree.json` |
| 6 | NNF Neonatal Care Guidelines | NNF | Neonatal fever, jaundice, sepsis | `nnf_imnci_tree.json` |
| 7 | GINA Asthma Strategy 2023 | GINA | Asthma classification | `gina_asthma_tree.json` |
| 8 | Ayurveda Knowledge Base | AYUSH + CCRAS | Herbs, formulations | `ayurveda_kb_tree.json` |

### 22.2 Medicine Databases

| # | Source | Publisher | Records | URL |
|---|---|---|---|---|
| 1 | PMBJP Janaushadhi Product Basket | Dept. of Pharmaceuticals | 2,400+ | https://janaushadhi.gov.in |
| 2 | NLEM 2022 | MoHFW | 384 | https://mohfw.gov.in |
| 3 | CDSCO Drug Database | CDSCO | All licensed drugs | https://cdsco.gov.in |
| 4 | WHO Essential Medicines 23rd ed. | WHO | 500+ | https://who.int |
| 5 | Ayurvedic Pharmacopoeia of India | Ministry of AYUSH | 635 formulations | https://ayush.gov.in |
| 6 | NLEAM | Ministry of AYUSH | Govt AYUSH essential list | https://ayush.gov.in |
| 7 | CCRAS Clinical Protocols | CCRAS | Disease-specific Ayurvedic | https://ccras.nic.in |
| 8 | A-Z Medicine Dataset (Kaggle) | Community | ~12,000 | https://kaggle.com/datasets/shudhanshusingh/az-medicine-dataset-of-india |

### 22.3 Government Health Programmes

| # | Programme | Diseases Covered | Publisher |
|---|---|---|---|
| 1 | NVBDCP | Dengue, Malaria, Chikungunya, Kala-Azar, JE, Filariasis | MoHFW |
| 2 | NTEP | Tuberculosis | MoHFW |
| 3 | National NCD Programme | Hypertension, Diabetes, Cancer, COPD | MoHFW |
| 4 | NLEP | Leprosy | MoHFW |
| 5 | Janani Suraksha Yojana / PMSMA | Maternal mortality, ANC, PPH | NHM |
| 6 | ICDS | SAM, Stunting, Wasting, Rickets | Min. Women & Child Dev. |
| 7 | RBSK | 4Ds in children | NHM |
| 8 | National Iodine Deficiency Programme | Goitre, Cretinism | MoHFW |
| 9 | National Mental Health Programme | Depression, Anxiety | NIMHANS |
| 10 | ICMR Disease Burden Studies | All India NCDs + infectious | ICMR |

### 22.4 ICD-10 & Classification Standards

| Resource | Purpose | URL |
|---|---|---|
| ICD-10 Browser (WHO) | Disease code lookup | https://icd.who.int/browse10 |
| ICD-11 | Next-gen classification | https://icd.who.int/browse11 |
| ATC Classification | Medicine classification | https://whocc.no/atc_ddd_index |

### 22.5 Voice & Language Sources

| Source | Languages | URL |
|---|---|---|
| Bhashini (Govt. of India, free) | 22 Indian languages ASR + TTS | https://bhashini.gov.in |
| AI4Bharat IndicNLP | NLP models for Indian languages | https://ai4bharat.org |
| IndicTrans2 | Translation across 22 Indian languages | https://github.com/AI4Bharat/IndicTrans2 |

---

## 23. Cloud Infrastructure

### 23.1 Vector Database

| Property | Value |
|---|---|
| Provider | **Qdrant Cloud Free Tier** |
| Cost | **₹0** |
| EC2 | ❌ None |
| VPC | ❌ None |
| NAT Gateway | ❌ None (never) |
| Auth | API Key in Android Keystore |

### 23.2 AWS Bedrock

| Property | Value |
|---|---|
| Model | Claude 3 Haiku |
| Region | `ap-south-1` Mumbai |
| Access | IAM Role on Lambda (no mobile credentials) |
| Guardrails | Enabled |
| Cost | ~₹0.004 per escalated query |
| Budget cap | $15/month hard limit |

### 23.3 Future Cloud (Phase 4+)

| Service | Purpose | When |
|---|---|---|
| S3 `ap-south-1` | OTA KB patch delivery | Phase 4 |
| DynamoDB | Anonymised usage analytics | Phase 4 |
| CloudWatch | Cost monitoring + alerting | Phase 3 |
| Cognito | Optional ANM user accounts | Phase 5 |

---

## 24. Project File Structure

```
DhanwantariAI/
├── App.tsx
├── src/
│   ├── ai/
│   │   ├── DeviceCapabilityDetector.ts   ← 5-signal tier detection
│   │   ├── ClinicalSafetyEngine.ts       ← Red flag rules, triage
│   │   ├── DiagnosisEngine.ts            ← 145-disease scoring
│   │   ├── LLMEngine.ts                  ← On-device inference
│   │   └── RuleEngine.ts                 ← Deterministic referral rules
│   ├── retrieval/
│   │   ├── HybridRetrieval.ts            ← PageIndex + FTS5 + Qdrant
│   │   ├── PageIndexNavigator.ts
│   │   ├── FTS5Search.ts
│   │   └── VectorSearch.ts               ← Qdrant Cloud / LanceDB
│   ├── cloud/
│   │   ├── BedrockEscalationHandler.ts
│   │   ├── BedrockCostController.ts      ← Rate limiting + budget
│   │   └── PIIStripper.ts
│   ├── confidence/
│   │   ├── ConfidenceScorer.ts           ← 6-signal weighted model
│   │   └── ResultReconciler.ts
│   ├── guardrails/
│   │   ├── OnDeviceGuardrails.ts
│   │   └── ResponseValidator.ts
│   ├── liability/
│   │   ├── SourceCitationEngine.ts       ← Citation + guideline refs
│   │   ├── DisclaimerManager.ts
│   │   └── AuditLogger.ts                ← No-PII audit trail
│   ├── privacy/
│   │   ├── ConsentManager.ts
│   │   └── DataErasure.ts
│   ├── language/
│   │   ├── LocalTermNormalizer.ts        ← Hindi/Odia → medical ontology
│   │   ├── MedicalOntologyMapper.ts
│   │   └── BhashiniEngine.ts
│   ├── kb/
│   │   ├── KBUpdateManager.ts            ← OTA patch system
│   │   └── ModelRollbackManager.ts
│   ├── telemetry/
│   │   └── ObservabilityEngine.ts        ← Anonymised metrics
│   └── feedback/
│       └── FeedbackCollector.ts
│
├── assets/
│   ├── models/
│   │   ├── gemma3-1b-int4.gguf           ← Tier 2 (529 MB, post-install)
│   │   ├── gemma3-4b-int4.gguf           ← Tier 3 (post-install)
│   │   └── mobilebert-intent.tflite      ← Tier 2/3 only (25 MB)
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
│   └── lang/
│       ├── local_terms_hi.json
│       └── local_terms_or.json
│
└── scripts/
    ├── build_pageindex.py
    ├── ingest_vectors.py
    └── run_benchmark.py                  ← 200-vignette clinical eval
```

---

## 25. Artefacts Status & TODO

### Completed ✅

| Artefact | Version | Notes |
|---|---|---|
| Disease profiles JSON (31 diseases) | v2.1 | Expand to 145 |
| Symptom registry (276 symptoms) | v1.3 | |
| JanAushadhi mapping (2,438 products) | v3.0 | |
| Ayurvedic datasets (49 diseases, 6,000 records) | v2.0 | |
| LLM training JSONL (3,639 Q&A pairs) | v1.0 | |
| Synthetic disease CSVs (13 diseases) | v1.0 | |
| Bare React Native app shell | — | |
| Gemma 3 1B GGUF (RunPod) | v1.0 | |

### In Progress / Planned ⏳

| # | Task | Phase |
|---|---|---|
| P0.1 | `DeviceCapabilityDetector.ts` — 5-signal tier detection | 0 |
| P0.2 | LLM opt-in download UX | 0 |
| P0.3 | Secure model download (SHA-256 + AES-256 device-bound) | 0 |
| P1.1 | `ClinicalSafetyEngine.ts` — all 18 red flag rules | 1 |
| P1.2 | `HybridRetrieval.ts` — PageIndex + FTS5 (Tier 1) | 1 |
| P1.3 | PageIndex tree generation (all 8 source PDFs) | 1 |
| P1.4 | `ConfidenceScorer.ts` — 6-signal weighted model | 1 |
| P1.5 | `local_terms_hi.json` + `local_terms_or.json` | 1 |
| P1.6 | `SourceCitationEngine.ts` + `DisclaimerManager.ts` | 1 |
| P1.7 | `ConsentManager.ts` — DPDP consent flow | 1 |
| P2.1 | LanceDB + Qdrant vector integration (Tier 2/3) | 2 |
| P2.2 | `LLMEngine.ts` — llama.rn on-device inference | 2 |
| P2.3 | QLoRA fine-tuning pipeline completion (RunPod) | 2 |
| P3.1 | `BedrockEscalationHandler.ts` | 3 |
| P3.2 | `BedrockCostController.ts` — rate limiting + budget | 3 |
| P3.3 | Bedrock Guardrails configuration (ap-south-1) | 3 |
| P3.4 | Qdrant Cloud setup (free tier) | 3 |
| P3.5 | CloudWatch telemetry + alerting | 3 |
| P4.1 | Full React Native screen set | 4 |
| P4.2 | S3 KB patch OTA system | 4 |
| P4.3 | 200-vignette benchmark + `run_benchmark.py` | 4 |
| P5.1 | Bhashini ASR + TTS | 5 |
| P5.2 | LoRA language adapters (Hindi, Odia, Marathi, Kannada) | 5 |
| P5.3 | `LocalTermNormalizer.ts` — full multilingual mapping | 5 |
| P6.1 | CDSCO SaMD registration (Class A) | 6 |
| P6.2 | ICMR Ethics Committee approval | 6 |
| P6.3 | Model rollback governance (`ModelRollbackManager.ts`) | 6 |
| P6.4 | Clinical Advisory Board formation | 6 |
| P7.1 | Dataset expansion to 145 diseases | 7 |
| P7.2 | 200-vignette clinical validation benchmark | 7 |
| P7.3 | Bias evaluation across gender/age/region/language | 7 |

---

*Document maintained by AppScale LLP — DhanwantariAI Project*  
*LLPIN: ACP-6024 | appscale.in | Bengaluru, India*  
*Clinical Advisory: [To be constituted — Phase 4]*  
*Regulatory: CDSCO Class A SaMD registration — Phase 2 target*
