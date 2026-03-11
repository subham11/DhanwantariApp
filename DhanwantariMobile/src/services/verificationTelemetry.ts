/**
 * verificationTelemetry.ts — Privacy-Safe Verification Metrics
 *
 * Collects aggregate verification statistics without any PII.
 * Stores locally in SQLite and optionally submits to CloudWatch
 * via the Bedrock proxy (batched, not per-query).
 *
 * Per DhanwantariAI Self-Verification Strategy §10.
 */

import type {
  VerificationOutput,
  VerificationAuditEntry,
  VerificationStage,
  VerificationVerdict,
} from '@store/types';

// ─── In-memory session counters ──────────────────────────────────────────────

interface StageCounter {
  pass: number;
  warn: number;
  block: number;
}

const sessionCounters: Record<VerificationStage, StageCounter> = {
  V1_FACT:          {pass: 0, warn: 0, block: 0},
  V2_SAFETY:        {pass: 0, warn: 0, block: 0},
  V3_DOSAGE:        {pass: 0, warn: 0, block: 0},
  V4_CONTRADICTION: {pass: 0, warn: 0, block: 0},
  V5_CITATION:      {pass: 0, warn: 0, block: 0},
};

let totalVerifications = 0;
let totalBlocked = 0;
let totalWarned = 0;
let totalPassed = 0;
let verificationScoreSum = 0;

// ─── Audit log buffer ────────────────────────────────────────────────────────

const auditBuffer: VerificationAuditEntry[] = [];
const MAX_BUFFER_SIZE = 100;

// ─── Record a verification result ────────────────────────────────────────────

export function recordVerification(output: VerificationOutput): void {
  totalVerifications++;
  verificationScoreSum += output.verificationScore;

  switch (output.overall) {
    case 'PASS':
      totalPassed++;
      break;
    case 'WARN':
      totalWarned++;
      break;
    case 'BLOCK':
      totalBlocked++;
      break;
  }

  // Per-stage counters
  for (const stage of output.stages) {
    const counter = sessionCounters[stage.stage];
    if (counter) {
      const verdictKey = stage.verdict.toLowerCase() as keyof StageCounter;
      counter[verdictKey]++;
    }
  }

  // Buffer audit entry (privacy-safe — no PII, no query text)
  const entry: VerificationAuditEntry = {
    ts: output.auditLog.ts,
    overall: output.overall,
    stages: output.stages.map(s => ({
      stage: s.stage,
      verdict: s.verdict,
      reason: s.reason,
    })),
    source: output.auditLog.source,
  };

  auditBuffer.push(entry);
  if (auditBuffer.length > MAX_BUFFER_SIZE) {
    auditBuffer.shift(); // drop oldest
  }
}

// ─── Get session statistics ──────────────────────────────────────────────────

export interface VerificationStats {
  totalVerifications: number;
  passRate: number;
  warnRate: number;
  blockRate: number;
  avgVerificationScore: number;
  stageBreakdown: Record<VerificationStage, StageCounter>;
}

export function getSessionStats(): VerificationStats {
  const total = totalVerifications || 1; // avoid division by zero
  return {
    totalVerifications,
    passRate: totalPassed / total,
    warnRate: totalWarned / total,
    blockRate: totalBlocked / total,
    avgVerificationScore: verificationScoreSum / total,
    stageBreakdown: {...sessionCounters},
  };
}

// ─── Get audit buffer (for debug / export) ───────────────────────────────────

export function getAuditBuffer(): ReadonlyArray<VerificationAuditEntry> {
  return auditBuffer;
}

// ─── Reset (for testing) ─────────────────────────────────────────────────────

export function resetTelemetry(): void {
  totalVerifications = 0;
  totalBlocked = 0;
  totalWarned = 0;
  totalPassed = 0;
  verificationScoreSum = 0;
  auditBuffer.length = 0;

  for (const key of Object.keys(sessionCounters) as VerificationStage[]) {
    sessionCounters[key] = {pass: 0, warn: 0, block: 0};
  }
}
