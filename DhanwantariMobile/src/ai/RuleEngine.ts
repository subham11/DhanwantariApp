/**
 * RuleEngine.ts
 *
 * Deterministic clinical decision support layer.
 * Runs BEFORE any LLM/vector retrieval — fast, offline, no network required.
 *
 * Classifies IMMEDIATE / URGENT / ROUTINE risk and routes to the correct
 * referral facility (ASHA_MANAGE / PHC / CHC / FRU / HOSPITAL).
 *
 * All symptom strings are compared case-insensitively.
 */

import type {
  MatchedDisease,
  ReferralLevel,
  RiskLevel,
  RuleEngineResult,
} from '@store/types';

// ─── Red-Flag Symptom Definitions ─────────────────────────────────────────────

/**
 * Any of these symptoms → IMMEDIATE risk + HOSPITAL referral.
 * An ASHA worker MUST call an ambulance / 108.
 */
const IMMEDIATE_RED_FLAGS: readonly string[] = [
  'loss of consciousness',
  'unconscious',
  'unresponsive',
  'fainting',
  'syncope',
  'seizure',
  'convulsion',
  'eclampsia',
  'stroke',
  'facial droop',
  'sudden weakness',
  'sudden paralysis',
  'paralysis',
  'severe chest pain',
  'chest pain',
  'heart attack',
  'myocardial infarction',
  'respiratory failure',
  'severe shortness of breath',
  'unable to breathe',
  'choking',
  'cyanosis',
  'blue lips',
  'hemoptysis',
  'coughing blood',
  'severe bleeding',
  'uncontrolled bleeding',
  'postpartum haemorrhage',
  'pph',
  'eclamptic seizure',
  'anaphylaxis',
  'anaphylactic shock',
  'septic shock',
  'severe sepsis',
  'meningitis',
  'stiff neck fever',
  'high-grade fever with neck stiffness',
  'severe malaria',
  'cerebral malaria',
  'altered sensorium',
  'confusion with fever',
  'suspected poisoning',
  'poisoning',
  'snake bite',
  'snakebite',
  'drowning',
  'burn more than 10 percent',
];

/**
 * These symptoms escalate to URGENT if not already IMMEDIATE.
 * Refer to PHC or CHC depending on other factors.
 */
const URGENT_SYMPTOMS: readonly string[] = [
  'high fever',
  'fever above 103',
  'fever above 104',
  'fever above 39',
  'fever above 40',
  'persistent fever',
  'fever with chills',
  'fever with rash',
  'rigors',
  'difficulty breathing',
  'shortness of breath',
  'wheezing',
  'breathlessness',
  'dehydration',
  'severe diarrhoea',
  'blood in stool',
  'bloody diarrhea',
  'vomiting blood',
  'haematemesis',
  'jaundice with fever',
  'severe abdominal pain',
  'acute abdomen',
  'child not feeding',
  'infant not feeding',
  'severe malnutrition',
  'oedema',
  'pitting oedema',
  'severe anaemia',
  'extreme pallor',
  'dengue hemorrhagic',
  'dengue shock',
  'positive tourniquet test',
  'typhoid',
  'leptospirosis',
  'hepatitis',
  'acute liver failure',
  'urinary retention',
  'unable to urinate',
  'vaginal bleeding in pregnancy',
  'leaking amniotic fluid',
  'reduced fetal movement',
  'prolonged labour',
  'obstructed labour',
  'neonatal jaundice',
  'neonatal fever',
  'infant convulsion',
  'pediatric convulsion',
  'dog bite',
  'rabies exposure',
];

// ─── Disease-Category Rules ────────────────────────────────────────────────────

/**
 * If the top-matched disease belongs to one of these categories,
 * override the referral level upward.
 */
const CATEGORY_REFERRAL_OVERRIDES: Record<string, ReferralLevel> = {
  'Neurological Conditions': 'CHC',
  'Cardiovascular Conditions': 'CHC',
  'Pregnancy & Maternal Health': 'PHC',
  'Neonatal & Infant Health': 'PHC',
  'Surgical Conditions': 'CHC',
  'Mental Health Conditions': 'PHC',
  'Serious Infectious Diseases': 'PHC',
};

// ─── Immediate-Action Lookup ───────────────────────────────────────────────────

const IMMEDIATE_ACTIONS: Record<string, string[]> = {
  IMMEDIATE: [
    'Call ambulance / Dial 108 immediately',
    'Keep patient lying down, maintain airway',
    'Do NOT give anything by mouth if unconscious',
    'Monitor breathing and pulse',
    'Inform nearest PHC / CHC enroute',
  ],
  URGENT: [
    'Transport to PHC/CHC within 2 hours',
    'Record vitals (temp, pulse, BP if possible)',
    'Keep patient comfortable and hydrated if conscious',
    'Inform the ASHA supervisor',
  ],
  ROUTINE: [
    'Manage at community level with standard protocol',
    'Follow up in 3–5 days if no improvement',
    'Refer to PHC if symptoms worsen',
  ],
};

// ─── Referral Facility Levels ─────────────────────────────────────────────────

/**
 * Determines the minimum facility level needed for URGENT cases.
 * IMMEDIATE cases always go to HOSPITAL.
 */
function urgentReferralLevel(
  redFlags: string[],
  topDisease: MatchedDisease | undefined,
): ReferralLevel {
  // Category-based override
  if (topDisease) {
    const override =
      CATEGORY_REFERRAL_OVERRIDES[topDisease.disease.category_tag];
    if (override) return override;
  }

  // Symptom-based override for urgent cases
  const lower = redFlags.join(' ').toLowerCase();

  if (
    lower.includes('pregnancy') ||
    lower.includes('maternal') ||
    lower.includes('neonatal') ||
    lower.includes('infant convulsion')
  ) {
    return 'FRU';
  }

  if (
    lower.includes('dengue') ||
    lower.includes('malaria') ||
    lower.includes('typhoid') ||
    lower.includes('hepatitis')
  ) {
    return 'PHC';
  }

  return 'PHC';
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Assess clinical risk from a set of symptoms and matched diseases.
 * Pure function — no side effects, no async, no network.
 */
export function assessRisk(
  symptoms: string[],
  diseaseMatches: MatchedDisease[],
): RuleEngineResult {
  const lowerSymptoms = symptoms.map(s => s.toLowerCase().trim());

  // Detect red-flag symptoms
  const triggeredImmediateFlags = IMMEDIATE_RED_FLAGS.filter(flag =>
    lowerSymptoms.some(s => s.includes(flag) || flag.includes(s)),
  );

  const triggeredUrgentFlags = URGENT_SYMPTOMS.filter(flag =>
    lowerSymptoms.some(s => s.includes(flag) || flag.includes(s)),
  );

  const redFlagSymptoms = [
    ...triggeredImmediateFlags,
    ...triggeredUrgentFlags,
  ].filter((v, i, a) => a.indexOf(v) === i); // unique

  const triggeredRules: string[] = [];

  let riskLevel: RiskLevel;
  let referralLevel: ReferralLevel;

  const topDisease = diseaseMatches[0];

  if (triggeredImmediateFlags.length > 0) {
    riskLevel = 'IMMEDIATE';
    referralLevel = 'HOSPITAL';
    triggeredRules.push(
      `IMMEDIATE red flag(s) detected: ${triggeredImmediateFlags.slice(0, 3).join(', ')}`,
    );
  } else if (triggeredUrgentFlags.length > 0) {
    riskLevel = 'URGENT';
    referralLevel = urgentReferralLevel(triggeredUrgentFlags, topDisease);
    triggeredRules.push(
      `URGENT symptom(s) detected: ${triggeredUrgentFlags.slice(0, 3).join(', ')}`,
    );
  } else {
    riskLevel = 'ROUTINE';
    referralLevel = 'ASHA_MANAGE';

    // Bump ROUTINE to PHC if top disease category requires it
    if (topDisease) {
      const override =
        CATEGORY_REFERRAL_OVERRIDES[topDisease.disease.category_tag];
      if (override) {
        referralLevel = override;
        triggeredRules.push(
          `Category "${topDisease.disease.category_tag}" triggers ${override} referral`,
        );
      }
    }

    if (triggeredRules.length === 0) {
      triggeredRules.push('No red flags — standard community management');
    }
  }

  // Additional rule: if confidence is very high (score > 0.85) for a serious disease
  if (
    topDisease &&
    topDisease.score > 0.85 &&
    riskLevel === 'ROUTINE' &&
    (topDisease.disease.important_notes?.toLowerCase().includes('urgent') ||
      topDisease.disease.important_notes?.toLowerCase().includes('immediate'))
  ) {
    riskLevel = 'URGENT';
    referralLevel = 'PHC';
    triggeredRules.push(
      `High-confidence match (${Math.round(topDisease.score * 100)}%) for ${topDisease.disease.name} with clinician notes indicating urgency`,
    );
  }

  return {
    riskLevel,
    referralLevel,
    triggeredRules,
    redFlagSymptoms,
    immediateActions: IMMEDIATE_ACTIONS[riskLevel],
  };
}

/**
 * Human-readable label for risk level.
 */
export function riskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'IMMEDIATE':
      return '🚨 Immediate Emergency — Call 108';
    case 'URGENT':
      return '⚠️ Urgent — Refer within 2 hours';
    case 'ROUTINE':
      return '✅ Routine — Community Management';
  }
}

/**
 * Human-readable label for referral level.
 */
export function referralLevelLabel(level: ReferralLevel): string {
  switch (level) {
    case 'ASHA_MANAGE':
      return 'ASHA can manage at community level';
    case 'PHC':
      return 'Refer to Primary Health Centre (PHC)';
    case 'CHC':
      return 'Refer to Community Health Centre (CHC)';
    case 'FRU':
      return 'Refer to First Referral Unit (FRU)';
    case 'HOSPITAL':
      return 'Emergency — Refer to District Hospital';
  }
}
