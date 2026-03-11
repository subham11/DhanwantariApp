/**
 * HybridRetrieval.ts
 *
 * Orchestrates all three retrieval methods in parallel and merges their
 * results into a single RetrievalBundle with a confidence score.
 *
 * Retrieval pipeline:
 *   1. FTS5Search     — SQLite full-text over diseases + reports (offline)
 *   2. PageIndex      — Bundled clinical protocol trees (offline)
 *   3. VectorSearch   — Qdrant Cloud semantic search (online, graceful fallback)
 *
 * Confidence scoring:
 *   - Each source contributes up to 0.33 to the final score
 *   - Agreement between FTS + Vector on the same disease adds a bonus
 *   - Conflicts (different top disease) are reported for transparency
 */

import {searchBySymptomList, searchDiseasesFTS} from './FTS5Search';
import {searchPageIndex} from './PageIndexNavigator';
import {searchDiseasesByVector} from './VectorSearch';
import {scoreConfidence} from '../confidence/ConfidenceScorer';
import {reconcile} from '../confidence/ResultReconciler';
import type {FTSRecord, PageIndexNode, RetrievalBundle, VectorRecord} from '@store/types';
import {Config} from '@config';

// ─── Embedding helper (stub — replace with TFLite model output) ───────────────

/**
 * Generate a 384-dim MiniLM-L6-v2 embedding for the given text.
 *
 * STUB: Returns a zero vector until the TFLite model is integrated.
 * Vector search will return random/empty results until real embeddings are used.
 */
async function embedText(text: string): Promise<number[]> {
  // TODO: Replace with actual TFLite inference via @tensorflow/tfjs-react-native
  void text;
  return new Array(Config.EMBEDDING_DIMS).fill(0);
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Run all three retrieval methods in parallel and merge results.
 *
 * @param symptoms   Structured symptom list (from SymptomChecker)
 * @param freeQuery  Optional free-text from chat input
 */
export async function retrieveHybrid(
  symptoms: string[],
  freeQuery = '',
): Promise<RetrievalBundle> {
  const combinedQuery = [
    ...symptoms,
    ...(freeQuery ? [freeQuery] : []),
  ].join(' ');

  // Run all three in parallel — each degrades gracefully on network failure
  const [ftsResults, pageIndexNodes, vectorMatches] = await Promise.all([
    searchBySymptomList(symptoms, Config.FTS5_MAX_RESULTS).catch(
      (): FTSRecord[] => [],
    ),
    Promise.resolve(searchPageIndex(combinedQuery, 5)),
    embedText(combinedQuery).then(vec =>
      searchDiseasesByVector(vec, Config.VECTOR_TOP_K).catch(
        (): VectorRecord[] => [],
      ),
    ),
  ]);

  // If FTS returned nothing, try a broader free-text FTS5 search
  const finalFtsResults =
    ftsResults.length === 0 && freeQuery
      ? await searchDiseasesFTS(freeQuery, Config.FTS5_MAX_RESULTS).catch(
          (): FTSRecord[] => [],
        )
      : ftsResults;

  const {agreements, conflicts} = reconcile(finalFtsResults, vectorMatches, pageIndexNodes);
  const {score, escalationReason} = scoreConfidence({
    ftsResults: finalFtsResults,
    pageIndexNodes,
    vectorMatches,
    agreements,
    symptoms,
  });

  // Debug log for development
  if (__DEV__) {
    console.log(
      `[HybridRetrieval] fts:${finalFtsResults.length} pi:${pageIndexNodes.length} vec:${vectorMatches.length} score:${score.toFixed(2)}`,
    );
  }

  return {
    pageIndexNodes,
    ftsResults: finalFtsResults,
    vectorMatches,
    agreements,
    conflicts,
    confidenceScore: score,
    escalationReason,
  };
}
