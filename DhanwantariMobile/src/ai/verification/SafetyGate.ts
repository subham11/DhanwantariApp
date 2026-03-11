/**
 * SafetyGate.ts — V2: Self-Verification Stage
 *
 * Ensures LLM output never contradicts or weakens a ClinicalSafetyEngine
 * or RuleEngine determination. Pure rule-based — zero LLM calls, sub-ms
 * execution, works offline on all tiers.
 *
 * Per DhanwantariAI Self-Verification Strategy §4.1 V2.
 */

import type {
  SafetyEvaluation,
  RuleEngineResult,
  StageResult,
} from '@store/types';

// ─── Dangerous phrases that minimise serious symptoms ─────────────────────────

const MINIMISATION_PATTERNS: readonly RegExp[] = [
  /no\s+need\s+to\s+worry/i,
  /can\s+wait/i,
  /home\s+remed/i,
  /not\s+serious/i,
  /monitor\s+at\s+home/i,
  /nothing\s+to\s+worry/i,
  /don'?t\s+worry/i,
  /no\s+cause\s+for\s+(concern|alarm)/i,
  /mild\s+(condition|issue)/i,
  /will\s+(go|pass)\s+(away|on\s+its\s+own)/i,
  /self[- ]?limiting/i,
  /no\s+immediate\s+(danger|risk)/i,
];

const MEDICATION_CHANGE_PATTERNS: readonly RegExp[] = [
  /stop\s+taking/i,
  /discontinue\s+(your|the)\s+(medication|medicine|drug|tablet)/i,
  /switch\s+(from|to)\s+/i,
  /change\s+your\s+(dosage|dose|medication|medicine)/i,
  /reduce\s+your\s+(dosage|dose)/i,
  /increase\s+your\s+(dosage|dose)/i,
];

const REFERRAL_KEYWORDS = [
  'refer', 'referral', 'hospital', 'phc', 'chc', 'fru',
  'health centre', 'health center', 'doctor', 'physician',
  'emergency', '108', 'ambulance',
];

// ─── Main API ─────────────────────────────────────────────────────────────────

export function checkSafetyGate(
  llmResponse: string,
  safetyEval: SafetyEvaluation,
  ruleResult: RuleEngineResult,
): StageResult {
  // Rule 1: If suppressLLM was true, LLM output should never have reached here
  if (safetyEval.suppressLLM) {
    return {
      stage: 'V2_SAFETY',
      verdict: 'BLOCK',
      reason: 'suppressLLM was active (CRITICAL red flag) — LLM output must not be shown',
      replacement: safetyEval.displayMessage,
    };
  }

  const lower = llmResponse.toLowerCase();

  // Rule 2: IMMEDIATE risk — block minimisation phrases
  if (ruleResult.riskLevel === 'IMMEDIATE') {
    for (const pattern of MINIMISATION_PATTERNS) {
      if (pattern.test(llmResponse)) {
        return {
          stage: 'V2_SAFETY',
          verdict: 'BLOCK',
          reason: `LLM minimises IMMEDIATE risk with "${llmResponse.match(pattern)?.[0]}"`,
          replacement: buildReferralFallback(ruleResult),
        };
      }
    }
  }

  // Rule 3: URGENT risk — LLM must include referral recommendation
  if (ruleResult.riskLevel === 'URGENT') {
    const hasReferral = REFERRAL_KEYWORDS.some(kw => lower.includes(kw));
    if (!hasReferral) {
      return {
        stage: 'V2_SAFETY',
        verdict: 'WARN',
        reason: 'LLM omits referral recommendation for URGENT risk — referral banner appended',
      };
    }
  }

  // Rule 4: Block medication change advice (ASHA workers cannot advise this)
  for (const pattern of MEDICATION_CHANGE_PATTERNS) {
    if (pattern.test(llmResponse)) {
      return {
        stage: 'V2_SAFETY',
        verdict: 'BLOCK',
        reason: `LLM advises medication change ("${llmResponse.match(pattern)?.[0]}") — outside ASHA scope`,
        replacement: 'Medication changes should only be made by a qualified doctor. ' +
          `Please refer to ${ruleResult.referralLevel.replace(/_/g, ' ')}.`,
      };
    }
  }

  // Rule 5: IMMEDIATE risk — block minimisation by negation near referral
  if (ruleResult.riskLevel === 'IMMEDIATE') {
    if (/no\s+need\s+(to|for)\s+(refer|hospital|ambulance)/i.test(llmResponse)) {
      return {
        stage: 'V2_SAFETY',
        verdict: 'BLOCK',
        reason: 'LLM contradicts IMMEDIATE referral requirement',
        replacement: buildReferralFallback(ruleResult),
      };
    }
  }

  return {
    stage: 'V2_SAFETY',
    verdict: 'PASS',
    reason: 'LLM output does not contradict safety determinations',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildReferralFallback(ruleResult: RuleEngineResult): string {
  const lines = [
    `Risk level: ${ruleResult.riskLevel}`,
    `Refer to: ${ruleResult.referralLevel.replace(/_/g, ' ')}`,
    '',
    'Immediate actions:',
    ...ruleResult.immediateActions.map(a => `• ${a}`),
    '',
    'This is clinical decision support only. Verify with a qualified doctor.',
  ];
  return lines.join('\n');
}
