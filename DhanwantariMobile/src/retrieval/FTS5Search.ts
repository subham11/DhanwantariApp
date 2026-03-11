/**
 * FTS5Search.ts
 *
 * SQLite Full-Text Search (FTS5) wrapper for disease and report search.
 * Uses the existing `db.ts` helpers — no new dependencies.
 *
 * Exposed functions:
 *   searchDiseasesFTS(query)   — search diseases via symptom text
 *   searchReportsFTS(query)    — search indexed report chunks
 */

import {getDB} from '@services/db';
import type {FTSRecord} from '@store/types';

// ─── Disease FTS ──────────────────────────────────────────────────────────────

/**
 * Full-text search over the `disease_symptoms` FTS5 virtual table.
 * Returns up to `limit` records sorted by BM25 rank.
 *
 * The FTS table is keyed on disease_id, disease_name, and symptom_text
 * (joined from disease_symptoms). We return a FTSRecord per matched disease.
 */
export async function searchDiseasesFTS(
  query: string,
  limit = 10,
): Promise<FTSRecord[]> {
  if (!query.trim()) return [];

  try {
    const db = await getDB();

    // Use FTS5 MATCH — sanitise to avoid syntax errors
    const safeQuery = query.replace(/['"\\]/g, ' ').trim();

    const result = await db.execute(
      `SELECT disease_id, disease_name,
              snippet(chunks_fts, 2, '<b>', '</b>', '...', 20) AS snippet
       FROM   chunks_fts
       WHERE  chunks_fts MATCH ?
       ORDER  BY rank
       LIMIT  ?`,
      [safeQuery, limit],
    );

    if (!result.rows) return [];

    return result.rows.map((row: Record<string, unknown>) => ({
      diseaseId: String(row.disease_id ?? ''),
      diseaseName: String(row.disease_name ?? ''),
      snippet: String(row.snippet ?? ''),
    }));
  } catch (err) {
    // FTS query can throw on malformed input — degrade gracefully
    console.warn('[FTS5Search] searchDiseasesFTS error:', err);
    return [];
  }
}

// ─── Report FTS ───────────────────────────────────────────────────────────────

/**
 * Full-text search over indexed health-report chunks.
 * `report_chunks` is kept in the same FTS5 virtual table `chunks_fts`
 * alongside diseases — their disease_id is null for report rows.
 *
 * Returns plain-text snippets from matching report chunks.
 */
export async function searchReportsFTS(
  query: string,
  limit = 5,
): Promise<string[]> {
  if (!query.trim()) return [];

  try {
    const db = await getDB();
    const safeQuery = query.replace(/['"\\]/g, ' ').trim();

    const result = await db.execute(
      `SELECT snippet(chunks_fts, 2, '', '', '...', 30) AS snippet
       FROM   chunks_fts
       WHERE  chunks_fts MATCH ?
         AND  disease_id IS NULL
       ORDER  BY rank
       LIMIT  ?`,
      [safeQuery, limit],
    );

    if (!result.rows) return [];

    return result.rows.map((row: Record<string, unknown>) =>
      String(row.snippet ?? ''),
    );
  } catch (err) {
    console.warn('[FTS5Search] searchReportsFTS error:', err);
    return [];
  }
}

// ─── Symptom-based FTS shortcut ───────────────────────────────────────────────

/**
 * Convert a symptom list to an FTS5 query and search diseases.
 * Joins symptoms with OR so that any match counts.
 */
export async function searchBySymptomList(
  symptoms: string[],
  limit = 10,
): Promise<FTSRecord[]> {
  if (!symptoms.length) return [];
  // Wrap each multi-word symptom in quotes for phrase matching
  const ftsQuery = symptoms
    .map(s => `"${s.replace(/"/g, '')}"`)
    .join(' OR ');
  return searchDiseasesFTS(ftsQuery, limit);
}
