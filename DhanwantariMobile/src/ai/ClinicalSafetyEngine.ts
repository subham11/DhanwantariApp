/**
 * ClinicalSafetyEngine.ts
 *
 * Safety-first clinical rule engine per DhanwantariAI Architecture v2.2 §6.1–6.2.
 *
 * MUST be called FIRST in the query path — before any retrieval or LLM call.
 * Calling order: ClinicalSafetyEngine → analyzeSymptoms → RuleEngine → HybridRetrieval
 *
 * Implements 18 typed RedFlagRule structs (RF001–RF018) with:
 *   - ICD-10 codes for traceability
 *   - Authoritative source references (WHO, IAP, FOGSI, NVBDCP, etc.)
 *   - suppressLLM flag: set to true on CRITICAL to block all LLM calls
 */

import type {RedFlagRule, ReferralLevel, SafetyEvaluation} from '@store/types';

// ─── 18 Typed Red Flag Rules (RF001–RF018) ────────────────────────────────────

export const RED_FLAG_RULES: ReadonlyArray<RedFlagRule> = [
  {
    id: 'RF001',
    symptom: 'Loss of consciousness',
    operator: 'contains_any',
    value: ['loss of consciousness', 'unconscious', 'unresponsive', 'fainting', 'syncope'],
    reason:
      'Sudden loss of consciousness indicates life-threatening cardiac, neurological, or metabolic emergency',
    referTo: 'HOSPITAL',
    icdRef: 'R55',
    sourceRef: 'WHO IMCI 2014 §3.1 Emergency triage assessment',
  },
  {
    id: 'RF002',
    symptom: 'Seizure or convulsion',
    operator: 'contains_any',
    value: ['seizure', 'convulsion', 'febrile convulsion', 'fits'],
    reason:
      'Seizure requires rapid assessment for eclampsia, meningitis, cerebral malaria, or epilepsy',
    referTo: 'HOSPITAL',
    icdRef: 'G40',
    sourceRef: 'IAP PALS 2018 §2 Convulsion management',
  },
  {
    id: 'RF003',
    symptom: 'Eclampsia',
    operator: 'contains_any',
    value: ['eclampsia', 'eclamptic seizure'],
    reason:
      'Eclampsia is a maternal emergency requiring immediate obstetric care; associated with 15% maternal mortality',
    referTo: 'HOSPITAL',
    icdRef: 'O15',
    sourceRef: 'RCOG Green-top Guideline No. 10A 2022',
  },
  {
    id: 'RF004',
    symptom: 'Severe chest pain',
    operator: 'contains_any',
    value: ['severe chest pain', 'chest pain', 'heart attack', 'myocardial infarction'],
    reason:
      'Chest pain may indicate acute MI, pulmonary embolism, or aortic dissection — time-critical',
    referTo: 'HOSPITAL',
    icdRef: 'I21',
    sourceRef: 'ESC STEMI Guidelines 2023',
  },
  {
    id: 'RF005',
    symptom: 'Respiratory failure or cyanosis',
    operator: 'contains_any',
    value: [
      'respiratory failure',
      'unable to breathe',
      'choking',
      'cyanosis',
      'blue lips',
      'severe shortness of breath',
    ],
    reason:
      'Severe respiratory compromise requires immediate airway management and oxygen',
    referTo: 'HOSPITAL',
    icdRef: 'J96',
    sourceRef: 'WHO IMCI 2014 §3.2 Severe respiratory distress',
  },
  {
    id: 'RF006',
    symptom: 'Stroke symptoms',
    operator: 'contains_any',
    value: [
      'stroke',
      'facial droop',
      'sudden weakness',
      'sudden paralysis',
      'paralysis',
      'slurred speech',
    ],
    reason:
      'Suspected stroke: thrombolysis window is 4.5 hours — every minute counts',
    referTo: 'HOSPITAL',
    icdRef: 'I63',
    sourceRef: 'AHA/ASA Stroke Guidelines 2023',
  },
  {
    id: 'RF007',
    symptom: 'Postpartum haemorrhage',
    operator: 'contains_any',
    value: ['postpartum haemorrhage', 'pph', 'severe bleeding', 'uncontrolled bleeding'],
    reason:
      'PPH is the leading cause of maternal mortality in India — immediate haemostasis required',
    referTo: 'HOSPITAL',
    icdRef: 'O72',
    sourceRef: 'WHO PPH Prevention Guidelines 2012; FOGSI MNHRC Safe Motherhood 2019',
  },
  {
    id: 'RF008',
    symptom: 'Anaphylaxis',
    operator: 'contains_any',
    value: ['anaphylaxis', 'anaphylactic shock', 'allergic shock'],
    reason:
      'Anaphylaxis is fatal without immediate epinephrine — requires emergency care within minutes',
    referTo: 'HOSPITAL',
    icdRef: 'T78.2',
    sourceRef: 'WAO Anaphylaxis Guidelines 2020',
  },
  {
    id: 'RF009',
    symptom: 'Septic shock / Severe sepsis',
    operator: 'contains_any',
    value: ['septic shock', 'severe sepsis'],
    reason:
      'Septic shock carries >30% mortality — early IV antibiotics and fluid resuscitation critical',
    referTo: 'HOSPITAL',
    icdRef: 'A41',
    sourceRef: 'SSC International Guidelines 2021',
  },
  {
    id: 'RF010',
    symptom: 'Suspected meningitis',
    operator: 'contains_any',
    value: [
      'meningitis',
      'stiff neck fever',
      'high-grade fever with neck stiffness',
      'photophobia with fever',
    ],
    reason:
      'Bacterial meningitis is fatal without IV antibiotics — do not delay for LP',
    referTo: 'HOSPITAL',
    icdRef: 'G03',
    sourceRef: 'WHO Bacterial Meningitis Management Protocol 2018',
  },
  {
    id: 'RF011',
    symptom: 'Severe or cerebral malaria',
    operator: 'contains_any',
    value: ['cerebral malaria', 'severe malaria', 'altered sensorium', 'confusion with fever'],
    reason:
      'Cerebral malaria requires IV artesunate — oral therapy is insufficient',
    referTo: 'HOSPITAL',
    icdRef: 'B50.0',
    sourceRef: 'NVBDCP Treatment Guidelines 2021 §4.3',
  },
  {
    id: 'RF012',
    symptom: 'Haemoptysis or haematemesis',
    operator: 'contains_any',
    value: ['hemoptysis', 'coughing blood', 'vomiting blood', 'haematemesis'],
    reason:
      'Blood from respiratory or GI tract requires urgent investigation for TB, varices, or malignancy',
    referTo: 'HOSPITAL',
    icdRef: 'R04.2',
    sourceRef: 'RNTCP TB Treatment Guidelines 2019',
  },
  {
    id: 'RF013',
    symptom: 'Suspected poisoning',
    operator: 'contains_any',
    value: [
      'suspected poisoning',
      'poisoning',
      'organophosphate',
      'toxic ingestion',
      'pesticide ingestion',
    ],
    reason:
      'Poisoning requires decontamination, antidote, and monitored resuscitation',
    referTo: 'HOSPITAL',
    icdRef: 'T65.9',
    sourceRef: 'AIIMS Poisoning Management Protocol 2020',
  },
  {
    id: 'RF014',
    symptom: 'Snake bite',
    operator: 'contains_any',
    value: ['snake bite', 'snakebite', 'ophiotoxicosis'],
    reason:
      'Snakebite requires anti-venom within 2–6 hours — immobilise, do not cut or suck',
    referTo: 'HOSPITAL',
    icdRef: 'T63.0',
    sourceRef: 'WHO Guidelines for Management of Snakebite 2016',
  },
  {
    id: 'RF015',
    symptom: 'Neonatal or infant convulsion',
    operator: 'contains_any',
    value: ['infant convulsion', 'neonatal convulsion', 'pediatric convulsion'],
    reason:
      'Neonatal convulsion may indicate HIE, meningitis, or metabolic crisis',
    referTo: 'HOSPITAL',
    icdRef: 'P90',
    sourceRef: 'NNF IMNCI Protocol 2014 §5.2',
  },
  {
    id: 'RF016',
    symptom: 'Dengue shock / Haemorrhagic fever',
    operator: 'contains_any',
    value: ['dengue shock', 'dengue hemorrhagic', 'dengue haemorrhagic', 'positive tourniquet test'],
    reason:
      'Dengue shock syndrome requires IV fluid resuscitation under monitoring',
    referTo: 'FRU',
    icdRef: 'A91',
    sourceRef: 'NVBDCP Dengue Clinical Management Guidelines 2015 §3.4',
  },
  {
    id: 'RF017',
    symptom: 'Obstructed or prolonged labour',
    operator: 'contains_any',
    value: ['obstructed labour', 'prolonged labour', 'leaking amniotic fluid with fever'],
    reason:
      'Obstructed labour causes maternal and fetal death — surgical intervention required',
    referTo: 'FRU',
    icdRef: 'O65',
    sourceRef: 'FOGSI MNHRC Safe Motherhood Guidelines 2019',
  },
  {
    id: 'RF018',
    symptom: 'Drowning or near-drowning',
    operator: 'contains_any',
    value: ['drowning', 'near drowning', 'near-drowning', 'water aspiration'],
    reason:
      'Submersion injury causes hypoxic brain injury — CPR and hospital monitoring required',
    referTo: 'HOSPITAL',
    icdRef: 'T75.1',
    sourceRef: 'ILCOR Resuscitation 2020 §8 Water Rescue',
  },
];

// ─── Rule Matching ────────────────────────────────────────────────────────────

function matchRule(rule: RedFlagRule, lowerSymptoms: string[]): boolean {
  const values = Array.isArray(rule.value) ? rule.value : [rule.value];
  return values.some(v =>
    lowerSymptoms.some(s => s.includes(v) || v.includes(s)),
  );
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Evaluate symptoms against all 18 red-flag rules.
 *
 * MUST be the first call in the diagnostic query path.
 *
 * Returns:
 *  - CRITICAL: any HOSPITAL-referral rule fired → suppressLLM: true, navigation lock
 *  - URGENT:   FRU-level rules fired → suppressLLM: false
 *  - SAFE:     no red flags → proceed with normal retrieval pipeline
 */
export function evaluateSafety(symptoms: string[]): SafetyEvaluation {
  const lower = symptoms.map(s => s.toLowerCase().trim());
  const firedRules = RED_FLAG_RULES.filter(rule => matchRule(rule, lower));

  if (firedRules.length === 0) {
    return {
      status: 'SAFE',
      firedRules: [],
      referTo: 'ASHA_MANAGE',
      suppressLLM: false,
      displayMessage: '',
      sourcesCited: [],
    };
  }

  // Highest referral level among all fired rules
  const referralPriority: ReferralLevel[] = [
    'ASHA_MANAGE',
    'PHC',
    'CHC',
    'FRU',
    'HOSPITAL',
  ];
  const highestReferral = firedRules.reduce<ReferralLevel>((prev, rule) => {
    return referralPriority.indexOf(rule.referTo) >
      referralPriority.indexOf(prev)
      ? rule.referTo
      : prev;
  }, 'ASHA_MANAGE');

  // CRITICAL if any rule escalates to HOSPITAL
  const isCritical = firedRules.some(r => r.referTo === 'HOSPITAL');
  const status = isCritical ? 'CRITICAL' : 'URGENT';

  const sourcesCited = [...new Set(firedRules.map(r => r.sourceRef))];
  const ruleList = firedRules.map(r => `${r.id}: ${r.symptom}`).join('; ');

  const displayMessage = isCritical
    ? `🚨 EMERGENCY: ${firedRules[0].reason}. Dial 108 immediately — refer to ${highestReferral}. (${ruleList})`
    : `⚠️ URGENT: Clinical red flags detected — refer to ${highestReferral}. (${ruleList})`;

  return {
    status,
    firedRules,
    referTo: highestReferral,
    // CRITICAL: suppress LLM to prevent contradictory guidance during emergencies
    suppressLLM: isCritical,
    displayMessage,
    sourcesCited,
  };
}
