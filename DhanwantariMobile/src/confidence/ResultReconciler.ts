/**
 * ResultReconciler.ts
 *
 * Detects agreements (same disease from 2+ retrieval sources) and conflicts
 * (contradicting top disease between FTS and Vector).
 *
 * Per DhanwantariAI Architecture v2.2 §7.4.
 * Used by HybridRetrieval to populate RetrievalBundle.agreements[] and .conflicts[].
 */

import type {FTSRecord, PageIndexNode, VectorRecord} from '@store/types';

export interface ReconciliationResult {
  agreements: string[];
  conflicts: string[];
}

// ─── Agreements ───────────────────────────────────────────────────────────────

/**
 * Find disease names that appear in >= 2 of the three retrieval sources
 * (FTS, PageIndex, Vector).
 */
function findAgreements(
  ftsResults: FTSRecord[],
  vectorMatches: VectorRecord[],
  pageIndexNodes: PageIndexNode[],
): string[] {
  const ftsNames = new Set(ftsResults.map(r => r.diseaseName.toLowerCase()));
  const piTitles = pageIndexNodes.map(n => n.title.toLowerCase());
  const agreed = new Set<string>();

  // FTS ∩ Vector
  for (const v of vectorMatches) {
    const name = String(v.payload?.disease_name ?? '').toLowerCase();
    if (name && ftsNames.has(name)) {
      agreed.add(name);
    }
  }

  // FTS ∩ PageIndex (substring match)
  for (const name of ftsNames) {
    if (piTitles.some(pi => pi.includes(name) || name.includes(pi))) {
      agreed.add(name);
    }
  }

  // Vector ∩ PageIndex (substring match)
  for (const v of vectorMatches) {
    const name = String(v.payload?.disease_name ?? '').toLowerCase();
    if (name && piTitles.some(pi => pi.includes(name) || name.includes(pi))) {
      agreed.add(name);
    }
  }

  return [...agreed];
}

// ─── Conflicts ────────────────────────────────────────────────────────────────

/**
 * Detect top-level disagreeement: FTS top result vs Vector top result.
 */
function findConflicts(
  ftsResults: FTSRecord[],
  vectorMatches: VectorRecord[],
): string[] {
  if (!ftsResults.length || !vectorMatches.length) return [];
  const ftTop = ftsResults[0].diseaseName.toLowerCase();
  const vecTop = String(
    vectorMatches[0]?.payload?.disease_name ?? '',
  ).toLowerCase();
  if (!vecTop) return [];
  if (ftTop !== vecTop) {
    return [
      `FTS: "${ftsResults[0].diseaseName}" vs Vector: "${vectorMatches[0].payload?.disease_name}"`,
    ];
  }
  return [];
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function reconcile(
  ftsResults: FTSRecord[],
  vectorMatches: VectorRecord[],
  pageIndexNodes: PageIndexNode[],
): ReconciliationResult {
  return {
    agreements: findAgreements(ftsResults, vectorMatches, pageIndexNodes),
    conflicts: findConflicts(ftsResults, vectorMatches),
  };
}
