/**
 * ConsentManager.ts
 *
 * Manages user consent records per DhanwantariAI Architecture v2.2 §12.2.
 *
 * Consent types:
 *   advisory_acknowledgement — mandatory before accessing any clinical screen.
 *     The ASHA worker acknowledges DhanwantariAI is advisory-only, not a diagnostic device.
 *   cloud_escalation — optional, grants permission to send anonymised queries to Bedrock.
 *
 * Storage: Local AsyncStorage only — never synced to cloud.
 * Versioned: if CONSENT_VERSION changes, existing consent is invalidated and re-collected.
 *
 * DPDP Act 2023 compliance: consent must be free, specific, informed, and unambiguous.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {ConsentRecord, ConsentType} from '@store/types';

/** Increment when consent text changes — forces re-collection from all users */
const CONSENT_VERSION = '1.0';

const STORAGE_KEY_PREFIX = 'dhanwantari_consent_v1_';

function storageKey(type: ConsentType): string {
  return `${STORAGE_KEY_PREFIX}${type}`;
}

/**
 * Check if a specific consent has been granted (and is current version).
 */
export async function hasConsent(type: ConsentType): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(type));
    if (!raw) return false;
    const record = JSON.parse(raw) as ConsentRecord;
    return record.granted && record.version === CONSENT_VERSION;
  } catch {
    return false;
  }
}

/**
 * Grant a consent type. Records a timestamp and the current version.
 */
export async function grantConsent(type: ConsentType): Promise<void> {
  const record: ConsentRecord = {
    type,
    granted: true,
    grantedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  await AsyncStorage.setItem(storageKey(type), JSON.stringify(record));
}

/**
 * Revoke a consent type. Record is retained (for audit) but marked not granted.
 */
export async function revokeConsent(type: ConsentType): Promise<void> {
  const record: ConsentRecord = {
    type,
    granted: false,
    grantedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  await AsyncStorage.setItem(storageKey(type), JSON.stringify(record));
}

/**
 * Get the full consent record for a type. Returns null if never set.
 */
export async function getConsentRecord(
  type: ConsentType,
): Promise<ConsentRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(type));
    return raw ? (JSON.parse(raw) as ConsentRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Invalidate all consents — used on data erasure request (DPDP §12).
 */
export async function clearAllConsents(): Promise<void> {
  const types: ConsentType[] = ['advisory_acknowledgement', 'cloud_escalation'];
  await AsyncStorage.multiRemove(types.map(storageKey));
}
