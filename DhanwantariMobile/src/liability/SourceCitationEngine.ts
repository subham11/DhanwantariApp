/**
 * SourceCitationEngine.ts
 *
 * Generates source citations for DhanwantariAI clinical responses.
 * Per DhanwantariAI Architecture v2.2 §10.1.
 *
 * Every clinical response must include CitedResponse.sources[] so ASHA workers
 * and PHC MOs can trace the clinical basis of each recommendation.
 *
 * generatedBy field distinguishes the response tier:
 *   'pageindex'  — fully offline, from bundled protocol trees
 *   'llm_tier2'  — Gemma 3 1B on-device
 *   'llm_tier3'  — Gemma 3 4B on-device
 *   'bedrock'    — AWS Bedrock Claude 3 Haiku via proxy
 */

import type {RetrievalBundle} from '@store/types';

export type GeneratedBy = 'pageindex' | 'llm_tier2' | 'llm_tier3' | 'bedrock';

export interface CitedSource {
  source: string;
  url: string | null;
  version: string;
  pageRef?: string;
}

export interface CitedResponse {
  sources: CitedSource[];
  generatedBy: GeneratedBy;
}

// ─── Known source registry ────────────────────────────────────────────────────

const SOURCE_REGISTRY: Record<string, {url: string | null; version: string}> = {
  'WHO IMCI': {url: null, version: '2014'},
  'WHO PPH': {url: null, version: '2012'},
  'RNTCP': {url: null, version: '2019'},
  'NLEM': {url: null, version: '2022'},
  'NVBDCP': {url: null, version: '2021'},
  'NNF IMNCI': {url: null, version: '2014'},
  'FOGSI': {url: null, version: '2019'},
  'AIIMS': {url: null, version: '2020'},
  'IAP PALS': {url: null, version: '2018'},
  'NHM': {url: null, version: '2023'},
};

function resolveSource(sourceStr: string): CitedSource {
  for (const [key, meta] of Object.entries(SOURCE_REGISTRY)) {
    if (sourceStr.toUpperCase().includes(key.toUpperCase())) {
      return {source: sourceStr, url: meta.url, version: meta.version};
    }
  }
  return {source: sourceStr, url: null, version: 'unknown'};
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Build a CitedResponse from a retrieval bundle.
 *
 * @param bundle      The retrieval result
 * @param generatedBy Which layer produced the final response
 */
export function citeSources(
  bundle: RetrievalBundle,
  generatedBy: GeneratedBy = 'pageindex',
): CitedResponse {
  const sources: CitedSource[] = [];
  const seen = new Set<string>();

  // PageIndex nodes — most authoritative offline sources
  for (const node of bundle.pageIndexNodes.slice(0, 3)) {
    if (!seen.has(node.source)) {
      seen.add(node.source);
      sources.push({
        source: node.source,
        url: null,
        version: 'bundled',
        pageRef: node.section ?? undefined,
      });
    }
  }

  // FTS disease entries — internal knowledge base
  if (bundle.ftsResults.length > 0) {
    const src = 'DhanwantariAI Disease Knowledge Base';
    if (!seen.has(src)) {
      seen.add(src);
      sources.push({source: src, url: null, version: 'bundled'});
    }
  }

  // Bedrock responses include the model as a source
  if (generatedBy === 'bedrock') {
    const src = 'AWS Bedrock — Claude 3 Haiku (Anthropic)';
    if (!seen.has(src)) {
      seen.add(src);
      sources.push({
        source: src,
        url: null,
        version: 'claude-3-haiku-20240307',
      });
    }
  }

  return {sources, generatedBy};
}

/**
 * Cite sources from a ClinicalSafetyEngine evaluation (rule-based).
 *
 * @param sourceRefs  Rule .sourceRef strings from fired RedFlagRules
 */
export function citeRuleSources(sourceRefs: string[]): CitedResponse {
  const uniqueRefs = [...new Set(sourceRefs)];
  return {
    sources: uniqueRefs.map(resolveSource),
    generatedBy: 'pageindex',
  };
}
