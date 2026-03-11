/**
 * CitationBinder.ts — V5: Self-Verification Stage
 *
 * Attaches verifiable source citations to factual claims in the final
 * response shown to the ASHA worker.
 *
 * Per DhanwantariAI Self-Verification Strategy §4.1 V5.
 */

import type {
  RetrievalBundle,
  Citation,
  StageResult,
} from '@store/types';

// ─── Citation generation ──────────────────────────────────────────────────────

function buildCitations(
  text: string,
  retrievalBundle: RetrievalBundle,
): Citation[] {
  const citations: Citation[] = [];
  const lower = text.toLowerCase();
  const seen = new Set<string>();

  // Match against PageIndex nodes (primary protocol source)
  for (const node of retrievalBundle.pageIndexNodes) {
    const titleLower = node.title.toLowerCase();
    // Check if any substantial word from the node title appears in the response
    const titleWords = titleLower
      .split(/\s+/)
      .filter(w => w.length > 3);

    const relevant = titleWords.some(w => lower.includes(w));
    if (relevant && !seen.has(node.source)) {
      const section = node.section ?? node.title;
      citations.push({
        claim: node.title,
        source: node.source,
        section,
      });
      seen.add(node.source);
    }
  }

  // Match against FTS results (disease-level citations)
  for (const fts of retrievalBundle.ftsResults) {
    const nameLower = fts.diseaseName.toLowerCase();
    if (lower.includes(nameLower) && !seen.has(`fts:${fts.diseaseId}`)) {
      citations.push({
        claim: fts.diseaseName,
        source: `Disease Database (${fts.diseaseId})`,
      });
      seen.add(`fts:${fts.diseaseId}`);
    }
  }

  // Match against Vector results
  for (const vec of retrievalBundle.vectorMatches) {
    const diseaseName = String(vec.payload?.disease_name ?? '').toLowerCase();
    if (
      diseaseName &&
      lower.includes(diseaseName) &&
      !seen.has(`vec:${vec.id}`)
    ) {
      citations.push({
        claim: String(vec.payload?.disease_name ?? ''),
        source: `Vector Search (score: ${vec.score.toFixed(2)})`,
      });
      seen.add(`vec:${vec.id}`);
    }
  }

  return citations;
}

// ─── Inline citation insertion ────────────────────────────────────────────────

function insertInlineCitations(
  text: string,
  citations: Citation[],
): string {
  let enriched = text;

  for (const c of citations) {
    // Find the claim in the text and append a short citation tag
    const claimLower = c.claim.toLowerCase();
    const idx = enriched.toLowerCase().indexOf(claimLower);
    if (idx !== -1) {
      const end = idx + c.claim.length;
      const tag = c.section
        ? ` [${c.source} ${c.section}]`
        : ` [${c.source}]`;
      // Only insert once — find exact position
      enriched = enriched.slice(0, end) + tag + enriched.slice(end);
    }
  }

  return enriched;
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function bindCitations(
  llmResponse: string,
  retrievalBundle: RetrievalBundle,
): StageResult {
  const citations = buildCitations(llmResponse, retrievalBundle);

  if (citations.length === 0) {
    return {
      stage: 'V5_CITATION',
      verdict: 'WARN',
      reason: 'No source citations could be attached — response lacks traceable claims',
      citations: [],
    };
  }

  // We don't modify the response text for WARN/BLOCK — that's handled by VerdictEngine
  return {
    stage: 'V5_CITATION',
    verdict: 'PASS',
    reason: `${citations.length} citation(s) attached to response`,
    citations,
  };
}

/** Utility: enrich a verified response with inline citation tags. */
export function enrichWithCitations(
  text: string,
  retrievalBundle: RetrievalBundle,
): {enrichedText: string; citations: Citation[]} {
  const citations = buildCitations(text, retrievalBundle);
  const enrichedText = insertInlineCitations(text, citations);
  return {enrichedText, citations};
}
