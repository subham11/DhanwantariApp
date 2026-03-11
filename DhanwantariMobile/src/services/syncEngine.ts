/**
 * syncEngine.ts
 * -------------
 * TypeScript port of DhanwantariAI/sync/client_sync_engine.py
 *
 * Runs silently in the background whenever the app starts or comes to the
 * foreground. Never blocks the UI. Degrades gracefully when offline.
 *
 * Policy (mirrors OFFLINE_TIER_RULES in client_sync_engine.py):
 *   0–7 days offline  → prefer delta updates
 *   8–30 days offline → full download for price_catalog, delta for disease_db if available
 *   31–90 days offline → full downloads for all data packages
 *   > 90 days offline  → full downloads + model_weights prominent banner
 *
 * Throttle: manifest is not re-checked within 6 hours of the last check
 * (unless force:true is passed). This prevents hammering the CDN every time
 * the user switches apps and comes back.
 *
 * Storage layout (AsyncStorage):
 *   @dhanwantari/sync_state     — PackageSyncState for each package (version + timestamp)
 *   @dhanwantari/price_catalog  — latest price catalog JSON blob
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {seedDiseases, getDB} from './db';
import type {Disease} from '@store/types';

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * CDN manifest URL. Update this once the server-side Bedrock agent is live.
 * See DhanwantariAI/sync/bedrock_sync_agent.py for the server-side publisher.
 */
const MANIFEST_URL = 'https://cdn.dhanwantariai.in/sync_manifest.json';

/** Do not re-check the manifest more than once every 6 hours per launch */
const CHECK_THROTTLE_MS = 6 * 60 * 60 * 1000;

/** Network request timeout — health workers may have slow 2G connections */
const FETCH_TIMEOUT_MS = 15_000;

/** Returns an AbortSignal that fires after the given delay (ms). */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncAction =
  | 'skip'
  | 'apply_delta'
  | 'download_full'
  | 'notify_only'
  | 'prominent_banner';

export interface PackageSyncState {
  version: string;
  lastSyncedAt: string; // ISO 8601 UTC
  sha256: string;
}

export interface SyncState {
  lastCheckedAt: string | null;
  disease_db: PackageSyncState | null;
  price_catalog: PackageSyncState | null;
  model_weights: PackageSyncState | null;
}

export interface SyncResult {
  disease_db: SyncAction;
  price_catalog: SyncAction;
  model_weights: SyncAction;
  skippedThrottle?: boolean;
  error?: string;
}

interface ManifestPackage {
  version: string;
  sha256?: string;
  size_bytes: number;
  url: string;
  delta_url?: string;
  delta_sha256?: string;
  delta_from_version?: string;
  sync_policy: {
    auto_update: boolean;
    wifi_only: boolean;
    prompt_user?: boolean;
  };
}

interface Manifest {
  manifest_version: string;
  generated_at: string;
  packages: {
    disease_db?: ManifestPackage;
    price_catalog?: ManifestPackage;
    model_weights?: ManifestPackage;
  };
}

// ─── AsyncStorage keys ────────────────────────────────────────────────────────

const SYNC_STATE_KEY = '@dhanwantari/sync_state';

// ─── State persistence ────────────────────────────────────────────────────────

async function loadSyncState(): Promise<SyncState> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_STATE_KEY);
    if (raw) {
      return JSON.parse(raw) as SyncState;
    }
  } catch {
    // Corrupt storage — start fresh
  }
  return {
    lastCheckedAt: null,
    disease_db: null,
    price_catalog: null,
    model_weights: null,
  };
}

async function saveSyncState(state: SyncState): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[Sync] Failed to save sync state:', e);
  }
}

// ─── Policy engine (mirrors SyncPolicyEngine in client_sync_engine.py) ────────

function offlineDays(local: PackageSyncState | null): number {
  if (!local) {
    return 9999; // never synced
  }
  const elapsed = Date.now() - new Date(local.lastSyncedAt).getTime();
  return Math.max(0, Math.floor(elapsed / 86_400_000));
}

function decideSyncAction(
  pkg: ManifestPackage | undefined,
  local: PackageSyncState | null,
  packageKey: 'disease_db' | 'price_catalog' | 'model_weights',
): SyncAction {
  if (!pkg) {
    return 'skip'; // package not in manifest
  }

  // Already on latest version
  if (local && local.version === pkg.version) {
    return 'skip';
  }

  const days = offlineDays(local);

  // model_weights: never auto-download — inform the UI, let the user decide
  if (packageKey === 'model_weights') {
    return days > 90 ? 'prominent_banner' : 'notify_only';
  }

  // disease_db + price_catalog: auto-update silently
  // Delta preferred when offline <= 30 days AND chain version matches
  const canUseDelta =
    days <= 30 &&
    !!pkg.delta_url &&
    !!local &&
    local.version === pkg.delta_from_version;

  return canUseDelta ? 'apply_delta' : 'download_full';
}

// ─── Downloaders ──────────────────────────────────────────────────────────────

interface DiseaseDbPayload {
  diseases: Disease[];
}

async function downloadDiseaseDb(url: string): Promise<Disease[]> {
  const resp = await fetch(url, {
    headers: {'Accept-Encoding': 'gzip'},
    signal: timeoutSignal(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`disease_db HTTP ${resp.status}`);
  }
  const payload = (await resp.json()) as DiseaseDbPayload;
  if (!Array.isArray(payload.diseases)) {
    throw new Error('Invalid disease_db payload: missing "diseases" array');
  }
  return payload.diseases;
}

async function applyDiseaseDbFull(url: string, version: string): Promise<void> {
  const diseases = await downloadDiseaseDb(url);
  const db = getDB();
  // Full replace: wipe normalised rows first, then re-seed
  await db.execute('DELETE FROM disease_symptoms;');
  await db.execute('DELETE FROM diseases;');
  await seedDiseases(diseases);
  console.log(`[Sync] disease_db replaced → v${version} (${diseases.length} diseases)`);
}

async function applyDiseaseDbDelta(
  deltaUrl: string,
  version: string,
): Promise<void> {
  // Delta format: same {diseases:[...]} shape, but only contains changed/new records.
  // INSERT OR REPLACE handles both inserts and updates without full wipe.
  const diseases = await downloadDiseaseDb(deltaUrl);
  await seedDiseases(diseases); // seedDiseases uses INSERT OR REPLACE — safe for delta
  console.log(`[Sync] disease_db delta applied → v${version} (+${diseases.length} records)`);
}

async function applyPriceCatalog(url: string, version: string): Promise<void> {
  const resp = await fetch(url, {
    headers: {'Accept-Encoding': 'gzip'},
    signal: timeoutSignal(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`price_catalog HTTP ${resp.status}`);
  }
  const data = await resp.json();
  await AsyncStorage.setItem('@dhanwantari/price_catalog', JSON.stringify(data));
  console.log(`[Sync] price_catalog updated → v${version}`);
}

// ─── Main sync entry point ────────────────────────────────────────────────────

let _isSyncing = false; // guard against concurrent runs

/**
 * Run a background sync cycle.
 *
 * - Called on app start (after DB init) and whenever the app comes to the foreground.
 * - Returns null if a sync is already running or the throttle window hasn't elapsed.
 * - Never throws — all errors are caught and returned in SyncResult.error.
 *
 * @param options.force  Skip the 6-hour throttle and re-check immediately.
 */
export async function runSync(options?: {force?: boolean}): Promise<SyncResult | null> {
  if (_isSyncing) {
    return null;
  }
  _isSyncing = true;

  const result: SyncResult = {
    disease_db: 'skip',
    price_catalog: 'skip',
    model_weights: 'skip',
  };

  try {
    const state = await loadSyncState();

    // ── Throttle check ──────────────────────────────────────────────────────
    if (!options?.force && state.lastCheckedAt) {
      const msSinceCheck =
        Date.now() - new Date(state.lastCheckedAt).getTime();
      if (msSinceCheck < CHECK_THROTTLE_MS) {
        result.skippedThrottle = true;
        return result;
      }
    }

    // ── Fetch manifest ──────────────────────────────────────────────────────
    const manifestResp = await fetch(MANIFEST_URL, {
      signal: timeoutSignal(FETCH_TIMEOUT_MS),
    });
    if (!manifestResp.ok) {
      throw new Error(`Manifest HTTP ${manifestResp.status}`);
    }
    const manifest = (await manifestResp.json()) as Manifest;
    const pkgs = manifest.packages ?? {};
    const now = new Date().toISOString();

    // Record that we checked (even if individual packages skip)
    state.lastCheckedAt = now;

    // ── disease_db ──────────────────────────────────────────────────────────
    const dbAction = decideSyncAction(pkgs.disease_db, state.disease_db, 'disease_db');
    result.disease_db = dbAction;

    if (dbAction === 'download_full' && pkgs.disease_db?.url) {
      await applyDiseaseDbFull(pkgs.disease_db.url, pkgs.disease_db.version);
      state.disease_db = {
        version: pkgs.disease_db.version,
        lastSyncedAt: now,
        sha256: pkgs.disease_db.sha256 ?? '',
      };
    } else if (dbAction === 'apply_delta' && pkgs.disease_db?.delta_url) {
      await applyDiseaseDbDelta(pkgs.disease_db.delta_url, pkgs.disease_db.version);
      state.disease_db = {
        version: pkgs.disease_db.version,
        lastSyncedAt: now,
        sha256: pkgs.disease_db.sha256 ?? '',
      };
    } else if (dbAction === 'skip' && state.disease_db) {
      // Touch timestamp so the 6h throttle works correctly
      state.disease_db.lastSyncedAt = now;
    }

    // ── price_catalog ───────────────────────────────────────────────────────
    const priceAction = decideSyncAction(
      pkgs.price_catalog,
      state.price_catalog,
      'price_catalog',
    );
    result.price_catalog = priceAction;

    if (
      (priceAction === 'download_full' || priceAction === 'apply_delta') &&
      pkgs.price_catalog
    ) {
      // Both full and delta use the same JSON shape — apply_delta url is delta_url
      const priceUrl =
        priceAction === 'apply_delta' && pkgs.price_catalog.delta_url
          ? pkgs.price_catalog.delta_url
          : pkgs.price_catalog.url;
      await applyPriceCatalog(priceUrl, pkgs.price_catalog.version);
      state.price_catalog = {
        version: pkgs.price_catalog.version,
        lastSyncedAt: now,
        sha256: pkgs.price_catalog.sha256 ?? '',
      };
    } else if (priceAction === 'skip' && state.price_catalog) {
      state.price_catalog.lastSyncedAt = now;
    }

    // ── model_weights ───────────────────────────────────────────────────────
    // Never auto-downloaded — UI observes the action and shows a prompt/banner
    const modelAction = decideSyncAction(
      pkgs.model_weights,
      state.model_weights,
      'model_weights',
    );
    result.model_weights = modelAction;

    if (modelAction === 'notify_only' || modelAction === 'prominent_banner') {
      console.log(
        `[Sync] model_weights update available → v${pkgs.model_weights?.version ?? '?'} (${modelAction})`,
      );
    }

    // ── Persist updated state ────────────────────────────────────────────────
    await saveSyncState(state);

    return result;
  } catch (e: unknown) {
    // Network failures are completely normal for health workers in rural areas.
    // Log quietly and return — never crash or alert the user.
    const msg = e instanceof Error ? e.message : String(e);
    console.log('[Sync] Background sync skipped (offline or CDN unreachable):', msg);
    result.error = msg;
    return result;
  } finally {
    _isSyncing = false;
  }
}

/**
 * Call this after the user explicitly confirms a model weights download.
 * Returns the latest model_weights entry from the last fetched manifest,
 * or null if no manifest has been checked yet.
 */
export async function getLatestModelWeightsInfo(): Promise<{
  version: string;
  url: string;
  sizeBytes: number;
  changelog: string;
} | null> {
  try {
    const resp = await fetch(MANIFEST_URL, {
      signal: timeoutSignal(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      return null;
    }
    const manifest = (await resp.json()) as Manifest & {
      packages: {
        model_weights?: ManifestPackage & {
          size_bytes: number;
          changelog?: string;
        };
      };
    };
    const m = manifest.packages?.model_weights;
    if (!m) {
      return null;
    }
    return {
      version: m.version,
      url: m.url,
      sizeBytes: m.size_bytes,
      changelog: (m as {changelog?: string}).changelog ?? '',
    };
  } catch {
    return null;
  }
}
