/**
 * DiagnosisEngine.ts
 *
 * Central orchestrator that combines:
 *   1. symptomMatcher   — deterministic symptom scoring
 *   2. RuleEngine       — red-flag / referral classification
 *   3. HybridRetrieval  — FTS5 + PageIndex + Vector retrieval
 *
 * Returns a DiagnosisResult with a final confidence score and a flag
 * indicating whether Bedrock escalation is needed.
 *
 * The caller (ChatScreen / SymptomAnalysisScreen) can then decide whether
 * to invoke BedrockEscalationHandler based on device tier and user consent.
 */

import {analyzeSymptoms} from '@utils/symptomMatcher';
import {assessRisk} from './RuleEngine';
import {evaluateSafety} from './ClinicalSafetyEngine';
import {retrieveHybrid} from '@retrieval/HybridRetrieval';
import {Config} from '@config';
import type {
  DiagnosisResult,
  SeverityLevel,
  UserProfile,
} from '@store/types';

// ─── Severity → numeric score ────────────────────────────────────────────────

function severityWeight(s: SeverityLevel): number {
  switch (s) {
    case 'Severe':
      return 0.0; // severe → boosts escalation
    case 'Moderate':
      return 0.05;
    case 'Mild':
      return 0.10;
  }
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Full diagnostic cycle for a symptom checklist.
 *
 * @param symptoms    Selected symptom names (from SymptomChecker)
 * @param profile     Active user profile (may be null for guest)
 * @param freeQuery   Optional free-text query from chat (improves retrieval)
 */
export async function diagnose(
  symptoms: string[],
  profile: UserProfile | null,
  freeQuery = '',
): Promise<DiagnosisResult> {
  // ── Step 0: ClinicalSafetyEngine — MUST BE FIRST (v2.2 §6.1) ──────────────
  // Evaluates 18 typed red-flag rules. On CRITICAL: suppressLLM = true.
  const safetyEval = evaluateSafety(symptoms);

  // ── Step 1: Deterministic symptom matching ─────────────────────────────────
  const {matchedDiseases, severity} = analyzeSymptoms(symptoms, profile);

  // ── Step 2: Rule engine — red flag / referral classification ───────────────
  const ruleEngineResult = assessRisk(symptoms, matchedDiseases);

  // ── Step 3: Hybrid retrieval (async, gracefully degrades offline) ──────────
  const retrievalBundle = await retrieveHybrid(symptoms, freeQuery);

  // ── Step 4: Combined confidence score ──────────────────────────────────────
  // symptomMatcher score (0–100) normalized to 0–0.5 weight
  const matcherScore =
    matchedDiseases.length > 0
      ? Math.min((matchedDiseases[0].score / 100) * 0.5, 0.5)
      : 0;

  // Retrieval confidence (0–1) weighted at 0.4
  const retrievalScore = retrievalBundle.confidenceScore * 0.4;

  // Severity bonus (Mild helps, Severe hurts — Severe needs escalation)
  const severityBonus = severityWeight(severity);

  const rawConfidence = matcherScore + retrievalScore + severityBonus;
  const confidenceScore = Math.min(rawConfidence, 1.0);

  // ── Step 5: Escalation decision ────────────────────────────────────────────
  let shouldEscalateToBedrock = false;
  let escalationReason: string | null = null;

  // CRITICAL safety status: suppress LLM to prevent contradictory guidance
  if (safetyEval.suppressLLM) {
    shouldEscalateToBedrock = false;
    escalationReason = null;
  } else if (ruleEngineResult.riskLevel === 'IMMEDIATE') {
    shouldEscalateToBedrock = true;
    escalationReason = 'IMMEDIATE risk — Bedrock confirmation required before referral';
  } else if (confidenceScore < Config.CONFIDENCE_AUTO_ESCALATE) {
    shouldEscalateToBedrock = true;
    escalationReason =
      retrievalBundle.escalationReason ??
      `Confidence too low (${Math.round(confidenceScore * 100)}%) for safe local diagnosis`;
  } else if (
    confidenceScore < Config.CONFIDENCE_MEDIUM &&
    ruleEngineResult.riskLevel === 'URGENT'
  ) {
    shouldEscalateToBedrock = true;
    escalationReason = `URGENT risk with medium confidence (${Math.round(confidenceScore * 100)}%) — Bedrock verification recommended`;
  }

  // Suppress unused variable warning (safetyEval used for suppressLLM decision above;
  // displayMessage and fired rules available for callers via ruleEngineResult)
  void safetyEval.displayMessage;

  // ── Step 6: Personalised summary ───────────────────────────────────────────
  const personalizedAnalysis = buildPersonalizedSummary(
    symptoms,
    matchedDiseases,
    ruleEngineResult,
    profile,
    confidenceScore,
  );

  return {
    matchedDiseases,
    severity,
    ruleEngineResult,
    retrievalBundle,
    confidenceScore,
    shouldEscalateToBedrock,
    escalationReason,
    personalizedAnalysis,
  };
}

// ─── Personalised summary builder ────────────────────────────────────────────

function buildPersonalizedSummary(
  symptoms: string[],
  matchedDiseases: ReturnType<typeof analyzeSymptoms>['matchedDiseases'],
  ruleResult: ReturnType<typeof assessRisk>,
  profile: UserProfile | null,
  confidence: number,
): string {
  const name = profile ? profile.firstName : 'the patient';
  const topDisease = matchedDiseases[0];

  const lines: string[] = [];

  if (topDisease) {
    lines.push(
      `Based on ${symptoms.length} reported symptom${symptoms.length !== 1 ? 's' : ''}, ` +
        `the most likely condition for ${name} is **${topDisease.disease.name}** ` +
        `(match score: ${topDisease.score}/100).`,
    );
  } else {
    lines.push(
      `The reported symptoms could not be matched with sufficient confidence to a specific condition.`,
    );
  }

  lines.push(
    `Risk assessment: **${ruleResult.riskLevel}** — ${ruleResult.referralLevel.replace(/_/g, ' ')}.`,
  );

  if (ruleResult.redFlagSymptoms.length > 0) {
    lines.push(
      `Red flag symptom${ruleResult.redFlagSymptoms.length > 1 ? 's' : ''} detected: ${ruleResult.redFlagSymptoms.slice(0, 3).join(', ')}.`,
    );
  }

  lines.push(
    `Diagnostic confidence: ${Math.round(confidence * 100)}%${confidence < 0.60 ? ' — please verify with a health worker.' : '.'}`,
  );

  return lines.join(' ');
}
