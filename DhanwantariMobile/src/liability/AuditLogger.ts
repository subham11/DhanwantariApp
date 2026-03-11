/**
 * AuditLogger.ts
 *
 * Records every clinical interaction for audit and safety review.
 * Per DhanwantariAI Architecture v2.2 §10.3.
 *
 * STRICT NO-PII POLICY:
 *   - No symptom text (could identify patient condition)
 *   - No disease names in raw form
 *   - No patient identifiers of any kind
 *   - Only structural metadata: tier, risk level, confidence, escalation destination
 *
 * Storage: Local AsyncStorage only — never synced to cloud.
 * Rotation: Oldest entries evicted when log exceeds MAX_ENTRIES.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AuditEntry, DeviceTier, RiskLevel} from '@store/types';

const AUDIT_STORAGE_KEY = 'dhanwantari_audit_log_v1';
const MAX_ENTRIES = 500;

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Append a new audit entry. Rotates log if it exceeds MAX_ENTRIES.
 * Fails silently — audit MUST never disrupt the clinical flow.
 */
export async function writeAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(AUDIT_STORAGE_KEY);
    const log: AuditEntry[] = raw ? JSON.parse(raw) : [];
    log.push(entry);
    const trimmed =
      log.length > MAX_ENTRIES ? log.slice(log.length - MAX_ENTRIES) : log;
    await AsyncStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Silent failure — audit errors must never block clinical screens
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a structured audit entry.
 *
 * queryIntent must be a generic label — NEVER include raw query text.
 * redFlagRulesFired must contain rule IDs only (e.g. ['RF001']) — no symptom text.
 */
export function createAuditEntry(params: {
  tier: DeviceTier;
  queryIntent: AuditEntry['queryIntent'];
  redFlagRulesFired: string[];
  riskLevel: RiskLevel;
  confidenceScore: number;
  escalatedTo: 'local' | 'bedrock' | null;
  sourcesCited: string[];
  kbVersion: string;
  appVersion: string;
}): AuditEntry {
  return {
    sessionId: `SID_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    ...params,
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function readAuditLog(): Promise<AuditEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

export async function clearAuditLog(): Promise<void> {
  await AsyncStorage.removeItem(AUDIT_STORAGE_KEY);
}
