/**
 * VerdictEngine.ts — Self-Verification Orchestrator
 *
 * Runs V1–V5 sequentially and aggregates results into a final
 * display decision (PASS / WARN / BLOCK).
 *
 * Per DhanwantariAI Self-Verification Strategy §4.2.
 */

import type {
  Disease,
  MatchedDisease,
  SafetyEvaluation,
  RuleEngineResult,
  RetrievalBundle,
  StageResult,
  VerificationOutput,
  VerificationVerdict,
  Citation,
} from '@store/types';

import {checkFactGrounding} from './FactGrounder';
import {checkSafetyGate} from './SafetyGate';
import {checkDosage} from './DosageCheck';
import {checkContradictions} from './ContradictionDetector';
import {bindCitations, enrichWithCitations} from './CitationBinder';

// ─── Main API ─────────────────────────────────────────────────────────────────

export interface VerifyInput {
  llmResponse: string;
  safetyEval: SafetyEvaluation;
  ruleResult: RuleEngineResult;
  matchedDiseases: MatchedDisease[];
  retrievalBundle: RetrievalBundle;
  /** Top disease record for dosage lookup (may be null on Tier 1) */
  topDiseaseRecord: Disease | null;
  /** Source: on-device LLM or Bedrock cloud response */
  source: 'on_device' | 'bedrock';
}

export function verifyResponse(input: VerifyInput): VerificationOutput {
  const stages: StageResult[] = [];

  // V1: FactGrounder
  const diseaseRecords = input.matchedDiseases.map(d => d.disease);
  const v1 = checkFactGrounding(
    input.llmResponse,
    input.retrievalBundle,
    diseaseRecords,
  );
  stages.push(v1);

  // V2: SafetyGate
  const v2 = checkSafetyGate(
    input.llmResponse,
    input.safetyEval,
    input.ruleResult,
  );
  stages.push(v2);

  // V3: DosageCheck
  const v3 = checkDosage(input.llmResponse, input.topDiseaseRecord);
  stages.push(v3);

  // V4: ContradictionDetector
  const v4 = checkContradictions(
    input.llmResponse,
    input.matchedDiseases,
    input.ruleResult,
    input.retrievalBundle,
  );
  stages.push(v4);

  // V5: CitationBinder
  const v5 = bindCitations(input.llmResponse, input.retrievalBundle);
  stages.push(v5);

  // ── Aggregate verdict ───────────────────────────────────────────────────
  const overall = aggregateVerdict(stages);

  // ── Build display response ──────────────────────────────────────────────
  let displayResponse: string;
  let allCitations: Citation[] = [];

  if (overall === 'BLOCK') {
    // Use the first BLOCK stage's replacement text, or a generic fallback
    const blockStage = stages.find(
      s => s.verdict === 'BLOCK' && s.replacement,
    );
    displayResponse =
      blockStage?.replacement ??
      'The AI response could not be verified. Please consult a qualified doctor.';
  } else {
    // PASS or WARN: enrich with citations
    const {enrichedText, citations} = enrichWithCitations(
      input.llmResponse,
      input.retrievalBundle,
    );
    displayResponse = enrichedText;
    allCitations = citations;

    // Append warnings inline if WARN
    if (overall === 'WARN') {
      const warnings = stages
        .filter(s => s.verdict === 'WARN')
        .map(s => s.reason);
      displayResponse +=
        '\n\n⚠ Note: ' + warnings.join('. ') + '.';
    }
  }

  // ── Verification score ──────────────────────────────────────────────────
  const verificationScore = computeScore(stages);

  return {
    overall,
    stages,
    displayResponse,
    verificationScore,
    auditLog: {
      ts: new Date().toISOString(),
      overall,
      stages: stages.map(s => ({
        stage: s.stage,
        verdict: s.verdict,
        reason: s.reason,
      })),
      source: input.source,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function aggregateVerdict(stages: StageResult[]): VerificationVerdict {
  if (stages.some(s => s.verdict === 'BLOCK')) return 'BLOCK';
  if (stages.some(s => s.verdict === 'WARN')) return 'WARN';
  return 'PASS';
}

function computeScore(stages: StageResult[]): number {
  // Each stage contributes 0.20 if PASS, 0.10 if WARN, 0.00 if BLOCK
  let score = 0;
  for (const s of stages) {
    switch (s.verdict) {
      case 'PASS':
        score += 0.20;
        break;
      case 'WARN':
        score += 0.10;
        break;
      case 'BLOCK':
        score += 0;
        break;
    }
  }
  return Math.min(score, 1.0);
}
