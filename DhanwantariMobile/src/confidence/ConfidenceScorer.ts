/**
 * ConfidenceScorer.ts
 *
 * 6-signal confidence scoring per DhanwantariAI Architecture v2.2 §8.1.
 *
 * Signals and weights:
 *   retrievalCoverage    0.20 — fraction of retrieval sources (FTS/PageIndex/Vector) with results
 *   sourceAgreement      0.25 — agreement count among all three sources on the same disease
 *   diseaseScoreStrength 0.20 — quality/strength of the top FTS + Vector match scores
 *   symptomSpecificity   0.15 — number of reported symptoms (more → more specific query)
 *   patientContextMatch  0.10 — age/gender alignment between profile and matched disease
 *   knowledgeDepth       0.10 — richness of PageIndex nodes retrieved
 *
 * Total maximum: 1.00
 */

import type {FTSRecord, PageIndexNode, VectorRecord} from '@store/types';
import {Config} from '@config';

// ─── Input / Output types ────────────────────────────────────────────────────

export interface ConfidenceInput {
  ftsResults: FTSRecord[];
  pageIndexNodes: PageIndexNode[];
  vectorMatches: VectorRecord[];
  agreements: string[];
  symptoms: string[];
  profileGender?: 'male' | 'female' | 'other' | null;
  topDiseaseGender?: 'male' | 'female' | 'both' | null;
}

export interface ConfidenceSignals {
  retrievalCoverage: number;
  sourceAgreement: number;
  diseaseScoreStrength: number;
  symptomSpecificity: number;
  patientContextMatch: number;
  knowledgeDepth: number;
}

export interface ConfidenceOutput {
  score: number;
  signals: ConfidenceSignals;
  escalationReason: string | null;
}

// ─── Signal calculators ───────────────────────────────────────────────────────

/**
 * Signal 1: retrievalCoverage (weight 0.20)
 * How many of the 3 retrieval sources returned at least one result.
 */
function calcRetrievalCoverage(
  ftsResults: FTSRecord[],
  pageIndexNodes: PageIndexNode[],
  vectorMatches: VectorRecord[],
): number {
  let active = 0;
  if (ftsResults.length > 0) active++;
  if (pageIndexNodes.length > 0) active++;
  if (vectorMatches.length > 0) active++;
  return (active / 3) * 0.20;
}

/**
 * Signal 2: sourceAgreement (weight 0.25)
 * How many unique disease names appear in 2+ sources.
 */
function calcSourceAgreement(agreements: string[]): number {
  // Each agreement adds 0.083 (3 × 0.083 ≈ 0.25)
  return Math.min(agreements.length * 0.083, 0.25);
}

/**
 * Signal 3: diseaseScoreStrength (weight 0.20)
 * FTS count-based (max 0.10) + Vector top-score-based (max 0.10).
 */
function calcDiseaseScoreStrength(
  ftsResults: FTSRecord[],
  vectorMatches: VectorRecord[],
): number {
  let score = 0;
  // FTS: ≥3 results → 0.10, 2 → 0.08, 1 → 0.06
  if (ftsResults.length >= 3) score += 0.10;
  else if (ftsResults.length === 2) score += 0.08;
  else if (ftsResults.length === 1) score += 0.06;

  // Vector: top score proportionally mapped to 0–0.10
  const topVecScore = vectorMatches[0]?.score ?? 0;
  score += Math.min(topVecScore * 0.10, 0.10);

  return Math.min(score, 0.20);
}

/**
 * Signal 4: symptomSpecificity (weight 0.15)
 * More symptoms → more specific query → higher confidence.
 */
function calcSymptomSpecificity(symptoms: string[]): number {
  if (symptoms.length === 0) return 0;
  if (symptoms.length === 1) return 0.04;
  if (symptoms.length === 2) return 0.08;
  if (symptoms.length === 3 || symptoms.length === 4) return 0.12;
  return 0.15; // 5+ symptoms
}

/**
 * Signal 5: patientContextMatch (weight 0.10)
 * Gender alignment between the user profile and the top matched disease.
 */
function calcPatientContextMatch(
  profileGender: 'male' | 'female' | 'other' | null | undefined,
  topDiseaseGender: 'male' | 'female' | 'both' | null | undefined,
): number {
  if (!profileGender || !topDiseaseGender) return 0.05; // neutral
  if (topDiseaseGender === 'both') return 0.10;         // gender-agnostic disease
  if (topDiseaseGender === profileGender) return 0.10;  // match
  return 0.02; // gender mismatch
}

/**
 * Signal 6: knowledgeDepth (weight 0.10)
 * Number of PageIndex protocol nodes matched.
 */
function calcKnowledgeDepth(pageIndexNodes: PageIndexNode[]): number {
  if (pageIndexNodes.length >= 3) return 0.10;
  if (pageIndexNodes.length === 2) return 0.07;
  if (pageIndexNodes.length === 1) return 0.04;
  return 0;
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Compute 6-signal confidence score for a retrieval result.
 */
export function scoreConfidence(input: ConfidenceInput): ConfidenceOutput {
  const retrievalCoverage = calcRetrievalCoverage(
    input.ftsResults,
    input.pageIndexNodes,
    input.vectorMatches,
  );
  const sourceAgreement = calcSourceAgreement(input.agreements);
  const diseaseScoreStrength = calcDiseaseScoreStrength(
    input.ftsResults,
    input.vectorMatches,
  );
  const symptomSpecificity = calcSymptomSpecificity(input.symptoms);
  const patientContextMatch = calcPatientContextMatch(
    input.profileGender,
    input.topDiseaseGender,
  );
  const knowledgeDepth = calcKnowledgeDepth(input.pageIndexNodes);

  const score = Math.min(
    retrievalCoverage +
      sourceAgreement +
      diseaseScoreStrength +
      symptomSpecificity +
      patientContextMatch +
      knowledgeDepth,
    1.0,
  );

  let escalationReason: string | null = null;
  if (score < Config.CONFIDENCE_AUTO_ESCALATE) {
    escalationReason = `Low retrieval confidence (${Math.round(score * 100)}%) — insufficient local data for this query`;
  } else if (score < Config.CONFIDENCE_MEDIUM) {
    escalationReason = `Medium confidence (${Math.round(score * 100)}%) — Bedrock verification recommended`;
  }

  return {
    score,
    signals: {
      retrievalCoverage,
      sourceAgreement,
      diseaseScoreStrength,
      symptomSpecificity,
      patientContextMatch,
      knowledgeDepth,
    },
    escalationReason,
  };
}
