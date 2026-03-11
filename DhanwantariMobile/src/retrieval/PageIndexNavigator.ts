/**
 * PageIndexNavigator.ts
 *
 * Traverses the bundled PageIndex JSON trees to find clinically relevant
 * nodes matching a symptom list or free-text query.
 *
 * PageIndex JSON format (react-native-pageindex compatible):
 *   { title, content, children?: PageIndexNode[] }
 *
 * Bundled files live in the assets/data/ folder and are loaded via
 * require(). At runtime they are part of the JS bundle — no file I/O needed.
 *
 * Scoring: BM25-inspired word-overlap between query tokens and node content.
 */

import type {PageIndexNode} from '@store/types';

// ─── Bundled PageIndex sources ────────────────────────────────────────────────

// Each file exports a JSON tree of { title, content, children[] }
// Add more as clinical PDFs are indexed.
const PAGEINDEX_SOURCES: Array<{source: string; tree: RawNode}> = [];

try {
  // Primary clinical protocols tree (diseases, symptoms, management)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const clinicalTree = require('@assets/data/clinical_protocols_pageindex.json');
  PAGEINDEX_SOURCES.push({source: 'clinical_protocols', tree: clinicalTree});
} catch {
  // File doesn't exist yet — skip gracefully
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const referralTree = require('@assets/data/referral_guidelines_pageindex.json');
  PAGEINDEX_SOURCES.push({source: 'referral_guidelines', tree: referralTree});
} catch {
  // File doesn't exist yet — skip gracefully
}

// ─── Raw node type ────────────────────────────────────────────────────────────

interface RawNode {
  title?: string;
  content?: string;
  section?: string;
  children?: RawNode[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten a nested tree into a list of leaf + branch nodes. */
function flattenTree(
  node: RawNode,
  source: string,
  accumulator: PageIndexNode[] = [],
): PageIndexNode[] {
  if (node.title || node.content) {
    accumulator.push({
      title: node.title ?? '',
      content: node.content ?? '',
      source,
      section: node.section,
    });
  }
  if (node.children) {
    for (const child of node.children) {
      flattenTree(child, source, accumulator);
    }
  }
  return accumulator;
}

/** Tokenise a string into lowercase words. */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/** Count how many query tokens appear in the node's combined text. */
function overlapScore(queryTokens: string[], node: PageIndexNode): number {
  const nodeText = `${node.title} ${node.content}`.toLowerCase();
  return queryTokens.filter(t => nodeText.includes(t)).length;
}

// ─── Pre-flattened all nodes (memo) ──────────────────────────────────────────

let _allNodes: PageIndexNode[] | null = null;

function getAllNodes(): PageIndexNode[] {
  if (_allNodes) return _allNodes;
  _allNodes = PAGEINDEX_SOURCES.flatMap(({source, tree}) =>
    flattenTree(tree, source),
  );
  return _allNodes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Find the top-K pageindex nodes most relevant to a free-text query
 * or a list of symptoms.
 *
 * Returns results sorted by overlap score (descending).
 */
export function searchPageIndex(
  query: string | string[],
  topK = 5,
): PageIndexNode[] {
  const text = Array.isArray(query) ? query.join(' ') : query;
  if (!text.trim()) return [];

  const queryTokens = tokenise(text);
  if (!queryTokens.length) return [];

  const allNodes = getAllNodes();

  const scored = allNodes
    .map(node => ({node, score: overlapScore(queryTokens, node)}))
    .filter(({score}) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(({node}) => node);
}

/**
 * Invalidate the node cache (call this after new PageIndex assets are
 * written to disk at runtime).
 */
export function clearPageIndexCache(): void {
  _allNodes = null;
}
