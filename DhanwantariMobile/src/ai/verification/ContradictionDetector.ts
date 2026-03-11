/**
 * ContradictionDetector.ts — V4: Self-Verification Stage
 *
 * Detects when the LLM output contradicts the deterministic pipeline's
 * conclusions (RuleEngine, ConfidenceScorer, ResultReconciler).
 *
 * Key principle: false escalation is safe; false de-escalation is NOT.
 *
 * Per DhanwantariAI Self-Verification Strategy §4.1 V4.
 */

import type {
  MatchedDisease,
  RuleEngineResult,
  RetrievalBundle,
  StageResult,
} from '@store/types';

// ─── Disease name extraction (regex, no LLM needed) ──────────────────────────

function extractMentionedDiseases(
  text: string,
  knownDiseaseNames: string[],
): string[] {
  const lower = text.toLowerCase();
  return knownDiseaseNames.filter(name =>
    lower.includes(name.toLowerCase()),
  );
}

// ─── Severity language detection ──────────────────────────────────────────────

const ROUTINE_IMPLICATION_PATTERNS: readonly RegExp[] = [
  /mild\s+(condition|issue|problem)/i,
  /not\s+(a\s+)?serious/i,
  /common\s+(ailment|condition)/i,
  /usually\s+(harmless|benign|self[- ]limiting)/i,
  /manage\s+at\s+home/i,
  /home\s+care\s+(is\s+)?sufficient/i,
  /no\s+(immediate\s+)?medical\s+attention\s+(is\s+)?(needed|required)/i,
];

const URGENT_IMPLICATION_PATTERNS: readonly RegExp[] = [
  /seek\s+(immediate|urgent|emergency)\s+(medical\s+)?(help|attention|care)/i,
  /go\s+to\s+(the\s+)?(hospital|emergency|er|a&e)/i,
  /call\s+(an?\s+)?(ambulance|108|emergency)/i,
  /life[- ]threatening/i,
  /medical\s+emergency/i,
  /do\s+not\s+delay/i,
];

// ─── Main API ─────────────────────────────────────────────────────────────────

export function checkContradictions(
  llmResponse: string,
  matchedDiseases: MatchedDisease[],
  ruleResult: RuleEngineResult,
  retrievalBundle: RetrievalBundle,
): StageResult {
  const issues: string[] = [];
  let worstVerdict: 'PASS' | 'WARN' | 'BLOCK' = 'PASS';

  const knownNames = matchedDiseases.map(d => d.disease.name);

  // ── Check 1: Disease contradiction ──────────────────────────────────────
  const mentionedDiseases = extractMentionedDiseases(llmResponse, knownNames);
  const topMatched = matchedDiseases[0]?.disease.name;

  if (topMatched && mentionedDiseases.length > 0) {
    const llmTopDisease = mentionedDiseases[0];
    if (llmTopDisease.toLowerCase() !== topMatched.toLowerCase()) {
      // Check if the LLM's suggestion has any evidence backing
      const hasEvidence =
        retrievalBundle.ftsResults.some(
          r => r.diseaseName.toLowerCase() === llmTopDisease.toLowerCase(),
        ) ||
        retrievalBundle.vectorMatches.some(
          r =>
            String(r.payload?.disease_name ?? '').toLowerCase() ===
            llmTopDisease.toLowerCase(),
        );

      if (!hasEvidence) {
        issues.push(
          `LLM suggests "${llmTopDisease}" but no FTS/Vector evidence supports it (top match: "${topMatched}")`,
        );
        worstVerdict = 'WARN';
      }
    }
  }

  // ── Check 2: Severity contradiction (dangerous direction only) ──────────
  if (ruleResult.riskLevel === 'IMMEDIATE') {
    const impliesRoutine = ROUTINE_IMPLICATION_PATTERNS.some(p =>
      p.test(llmResponse),
    );
    if (impliesRoutine) {
      issues.push(
        'LLM implies ROUTINE when RuleEngine determined IMMEDIATE risk',
      );
      worstVerdict = 'BLOCK';
    }
  }

  // LLM implying URGENT when RuleEngine says ROUTINE → safe, allow
  // (false escalation is safe)

  // ── Check 3: Referral contradiction ─────────────────────────────────────
  if (
    ruleResult.riskLevel !== 'ROUTINE' &&
    ruleResult.referralLevel !== 'ASHA_MANAGE'
  ) {
    const lower = llmResponse.toLowerCase();
    const contradicts =
      lower.includes('manage at home') ||
      lower.includes('no referral') ||
      lower.includes('no need to visit') ||
      lower.includes('asha can manage');

    if (contradicts) {
      issues.push(
        `LLM says "manage at home" but RuleEngine requires ${ruleResult.referralLevel} referral`,
      );
      worstVerdict = 'BLOCK';
    }
  }

  // ── Check 4: Retrieval conflict amplification ───────────────────────────
  if (retrievalBundle.conflicts.length > 0 && topMatched) {
    // If FTS and Vector disagree and LLM took the weaker (Vector) side
    const ftsTop = retrievalBundle.ftsResults[0]?.diseaseName?.toLowerCase();
    const vecPayload = retrievalBundle.vectorMatches[0]?.payload;
    const vecTop = String(vecPayload?.disease_name ?? '').toLowerCase();

    if (ftsTop && vecTop && ftsTop !== vecTop) {
      const mentionedLower = mentionedDiseases.map(d => d.toLowerCase());
      // LLM chose Vector's disease but not FTS's → note conflict
      if (mentionedLower.includes(vecTop) && !mentionedLower.includes(ftsTop)) {
        issues.push(
          `FTS top result "${ftsTop}" disagrees with Vector "${vecTop}" — LLM chose weaker Vector side`,
        );
        if (worstVerdict === 'PASS') worstVerdict = 'WARN';
      }
    }
  }

  if (worstVerdict === 'PASS') {
    return {
      stage: 'V4_CONTRADICTION',
      verdict: 'PASS',
      reason: 'No contradictions detected between LLM and deterministic pipeline',
    };
  }

  const replacement =
    worstVerdict === 'BLOCK'
      ? buildSafeFallback(ruleResult, matchedDiseases)
      : undefined;

  return {
    stage: 'V4_CONTRADICTION',
    verdict: worstVerdict,
    reason: issues.join('; '),
    replacement,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSafeFallback(
  ruleResult: RuleEngineResult,
  matchedDiseases: MatchedDisease[],
): string {
  const lines: string[] = [];
  if (matchedDiseases[0]) {
    lines.push(`Based on reported symptoms, the most likely condition is ${matchedDiseases[0].disease.name}.`);
  }
  lines.push(`Risk level: ${ruleResult.riskLevel}`);
  lines.push(`Refer to: ${ruleResult.referralLevel.replace(/_/g, ' ')}`);
  lines.push('');
  lines.push('This is clinical decision support only. Verify with a qualified doctor.');
  return lines.join('\n');
}
