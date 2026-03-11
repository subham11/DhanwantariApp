// ─── User Profile ─────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  bmi: number;
  bmiCategory: string;
  maintenanceCalories: number;
  hereditaryDiseases: string[];
  createdAt: string;
  lastUsedAt: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  isOffline?: boolean;
}

// ─── Symptoms ─────────────────────────────────────────────────────────────────

export type SeverityLevel = 'Mild' | 'Moderate' | 'Severe';
export type MatchTier = 'High Match' | 'Medium Match' | 'Low Match';

export interface SymptomEntry {
  name: string;
  description?: string;
}

export interface SymptomCategory {
  name: string;
  symptoms: SymptomEntry[];
}

// ─── Disease & Analysis ───────────────────────────────────────────────────────

export interface Disease {
  id: string;
  name: string;
  file: string;
  symptoms: string[];
  symptoms_by_category: Record<string, string[]>;
  symptom_count: number;
  tests: string;
  generic_medicines: string;
  janaushadhi_medicines: string;
  ayurvedic_medicines: string;
  india_specific: string;
  important_notes: string;
  gender: 'male' | 'female' | 'both';
  category_tag: string;
  confirmation_tests_curated?: string;
}

export interface MatchedDisease {
  disease: Disease;
  score: number;
  tier: MatchTier;
  matchedSymptoms: string[];
  symptomScore: number;
  profileBoost: number;
  explanation: string;
}

export interface AnalysisResult {
  symptoms: string[];
  severity: SeverityLevel;
  personalizedAnalysis: string;
  matchedDiseases: MatchedDisease[];
  analysedAt: string;
}

// ─── Device Capability Tiers ──────────────────────────────────────────────────

export type DeviceTier = 'TIER_1' | 'TIER_2' | 'TIER_3';
export type CpuArch = 'arm64' | 'arm32' | 'x86_64';

export interface DeviceProfile {
  tier: DeviceTier;
  ramGB: number;
  freeDiskGB: number;
  isLowRam: boolean;
  model: string;
  apiLevel: number;
  cpuArch: CpuArch;        // v2.2: arm64 / arm32 / x86_64
  nnApiSupported: boolean; // v2.2: API ≥ 27 && arm64
  llmEligible: boolean;
  llmModelSuggested: string | null;
}

// ─── Rule Engine & Clinical Safety ───────────────────────────────────────────

export type RiskLevel = 'IMMEDIATE' | 'URGENT' | 'ROUTINE';
export type ReferralLevel = 'ASHA_MANAGE' | 'PHC' | 'CHC' | 'FRU' | 'HOSPITAL';
export type RedFlagOperator = 'contains' | 'contains_any';

/** Typed red-flag rule per v2.2 §6.1 — 18 rules RF001–RF018 */
export interface RedFlagRule {
  id: string;                         // e.g. 'RF001'
  symptom: string;                    // human-readable label
  operator: RedFlagOperator;
  value: string | string[];           // symptom string(s) to match
  reason: string;                     // clinical rationale
  referTo: ReferralLevel;             // minimum referral facility
  icdRef: string;                     // ICD-10 code
  sourceRef: string;                  // guideline / protocol reference
}

/** Result from ClinicalSafetyEngine.evaluateSafety() */
export interface SafetyEvaluation {
  status: 'SAFE' | 'URGENT' | 'CRITICAL';
  firedRules: RedFlagRule[];
  referTo: ReferralLevel;
  suppressLLM: boolean;               // true on CRITICAL — block all LLM calls
  displayMessage: string;
  sourcesCited: string[];
}

export interface RuleEngineResult {
  riskLevel: RiskLevel;
  referralLevel: ReferralLevel;
  triggeredRules: string[];
  redFlagSymptoms: string[];
  immediateActions: string[];
}

// ─── Retrieval / Hybrid ───────────────────────────────────────────────────────

export interface PageIndexNode {
  title: string;
  content: string;
  source: string;
  section?: string;
}

export interface FTSRecord {
  diseaseId: string;
  diseaseName: string;
  snippet: string;
}

export interface VectorRecord {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface RetrievalBundle {
  pageIndexNodes: PageIndexNode[];
  ftsResults: FTSRecord[];
  vectorMatches: VectorRecord[];
  agreements: string[];
  conflicts: string[];
  confidenceScore: number;
  escalationReason: string | null;
}

// ─── Diagnosis Engine ─────────────────────────────────────────────────────────

export interface DiagnosisResult {
  matchedDiseases: MatchedDisease[];
  severity: SeverityLevel;
  ruleEngineResult: RuleEngineResult;
  retrievalBundle: RetrievalBundle;
  confidenceScore: number;
  shouldEscalateToBedrock: boolean;
  escalationReason: string | null;
  personalizedAnalysis: string;
}

// ─── Consent ──────────────────────────────────────────────────────────────────

export type ConsentType = 'advisory_acknowledgement' | 'cloud_escalation';

export interface ConsentRecord {
  type: ConsentType;
  granted: boolean;
  grantedAt: string;  // ISO timestamp
  version: string;    // consent text version — re-collect on change
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  sessionId: string;
  ts: string;                       // ISO timestamp
  tier: DeviceTier;
  queryIntent: 'symptom_check' | 'chat_query' | 'medicine_lookup' | 'referral_lookup';
  redFlagRulesFired: string[];      // Rule IDs only — NO symptom text (no PII)
  riskLevel: RiskLevel;
  confidenceScore: number;
  escalatedTo: 'local' | 'bedrock' | null;
  sourcesCited: string[];
  kbVersion: string;
  appVersion: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Consent: undefined;
  ProfileList: undefined;
  NewProfile: {editProfileId?: string};
  Chat: {profileId: string; analysisResult?: AnalysisResult};
  SymptomChecker: {profileId: string};
  SymptomAnalysis: {profileId: string; result: AnalysisResult};
  Classifications: undefined;
  CategoryDiseases: {category: string};
  MedicineDetail: {diseaseId: string; diseaseName: string};
  ReferralGuidance: {diseaseId: string; diseaseName: string; riskLevel: RiskLevel; referralLevel: ReferralLevel; reasons: string[]};
};

// ─── LLM ──────────────────────────────────────────────────────────────────────

export interface LLMRequest {
  model: string;
  messages: Array<{role: MessageRole; content: string}>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  id: string;
  choices: Array<{
    message: {role: string; content: string};
    finish_reason: string;
  }>;
  usage?: {prompt_tokens: number; completion_tokens: number; total_tokens: number};
}

// ─── Data JSON root ───────────────────────────────────────────────────────────

export interface SymptomDiseaseDB {
  metadata: {
    total_diseases: number;
    total_symptoms: number;
    categories: string[];
    symptoms_per_category: Record<string, number>;
  };
  symptom_categories: Record<string, string[]>;
  diseases: Disease[];
  reverse_index: Record<string, string[]>;
  scoring_algorithm: {
    match_tiers: Record<string, {min: number; color: string}>;
    severity_rules: Record<string, string>;
    weights: {
      symptom_match: {max: number; formula: string};
      profile_boost: {max: number; sub: {bmi: number; age: number; gender: number}};
      hereditary_boost: {max: number; rule: string};
    };
  };
}
