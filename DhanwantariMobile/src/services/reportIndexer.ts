/**
 * reportIndexer.ts
 * Offline document indexing using react-native-pageindex.
 * Uses keyword mode for buildReverseIndex — zero LLM cost at search time.
 * The pageIndexMd step uses a stub LLM (no network) when local server is unavailable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  pageIndexMd,
  buildReverseIndex,
  searchReverseIndex,
  LLMProvider,
} from 'react-native-pageindex';
import type {PageIndexResult} from 'react-native-pageindex';

// ─── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_PREFIX = 'dhanwantari_report_';

export interface StoredReport {
  docName: string;
  indexedAt: string;
  result: PageIndexResult;
}

// ─── LLM providers ───────────────────────────────────────────────────────────

/**
 * Stub LLM: returns empty string for all prompts.
 * This means no LLM-generated summaries — structure comes from Markdown headings only.
 * Fully offline, zero cost.
 */
const stubLlm: LLMProvider = async () => ({
  content: '',
  finishReason: 'stop',
});

/**
 * Local llama.cpp LLM provider.
 * Falls back to stub silently if the server is not reachable.
 */
function makeLocalLlm(baseUrl: string): LLMProvider {
  return async (prompt: string) => {
    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          model: 'local-model',
          messages: [{role: 'user', content: prompt}],
          max_tokens: 256,
          temperature: 0.1,
          stream: false,
        }),
      });
      const data = await res.json();
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        finishReason: data.choices?.[0]?.finish_reason ?? 'stop',
      };
    } catch {
      return {content: '', finishReason: 'stop'};
    }
  };
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Index a Markdown document offline (or with local LLM for summaries).
 * Persists result to AsyncStorage for later retrieval.
 */
export async function indexMarkdownReport(
  content: string,
  docName: string,
  llmBaseUrl?: string,
): Promise<PageIndexResult> {
  const llm = llmBaseUrl ? makeLocalLlm(llmBaseUrl) : stubLlm;

  const result = await pageIndexMd({
    content,
    docName,
    llm,
    options: {
      ifAddNodeSummary: false,     // skip LLM summaries → fully offline
      ifAddDocDescription: false,  // skip LLM doc description → fully offline
      ifAddNodeText: true,         // keep raw text in nodes for keyword matching
    },
  });

  const stored: StoredReport = {
    docName,
    indexedAt: new Date().toISOString(),
    result,
  };
  await AsyncStorage.setItem(
    `${STORAGE_PREFIX}${docName}`,
    JSON.stringify(stored),
  );

  return result;
}

/**
 * Search an indexed report using keyword reverse index.
 * Returns formatted top-K results as a display string.
 */
export async function searchReport(
  result: PageIndexResult,
  query: string,
  topK = 5,
): Promise<{hits: SearchHit[]; formatted: string}> {
  const reverseIndex = await buildReverseIndex({
    result,
    options: {
      mode: 'keyword',
      minTermLength: 3,
      maxTermsPerNode: 15,
    },
  });

  const hits = searchReverseIndex(reverseIndex, query, topK);

  const formatted =
    hits.length > 0
      ? hits
          .map(
            h =>
              `• **${h.nodeTitle}** — matched: _${h.matchedTerm}_ (score ${h.totalScore.toFixed(1)})`,
          )
          .join('\n')
      : 'No relevant sections found for that query.';

  return {hits, formatted};
}

export type SearchHit = ReturnType<typeof searchReverseIndex>[number];

/**
 * Load a previously indexed report from AsyncStorage.
 */
export async function loadStoredReport(
  docName: string,
): Promise<StoredReport | null> {
  const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${docName}`);
  if (!raw) return null;
  return JSON.parse(raw) as StoredReport;
}

/**
 * List all stored report names.
 */
export async function listStoredReports(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys
    .filter(k => k.startsWith(STORAGE_PREFIX))
    .map(k => k.replace(STORAGE_PREFIX, ''));
}

// ─── Sample report for testing ────────────────────────────────────────────────

export const SAMPLE_BLOOD_REPORT = `# Blood Test Report

**Patient:** Test Patient  
**Date:** 2026-03-07  
**Lab:** PathCare Diagnostics

## Complete Blood Count (CBC)

- Hemoglobin: 10.2 g/dL (Normal: 13.0–17.0) ⚠️ LOW
- WBC Count: 11,200 cells/μL (Normal: 4,000–11,000) ⚠️ HIGH
- Platelets: 320,000 /μL (Normal: 150,000–400,000) Normal
- RBC Count: 3.8 M/μL (Normal: 4.5–5.5) ⚠️ LOW
- Hematocrit: 31% (Normal: 40–54%) ⚠️ LOW

## Blood Glucose

- Fasting Glucose: 128 mg/dL (Normal: 70–100) ⚠️ HIGH
- HbA1c: 7.2% (Normal: <5.7%) ⚠️ HIGH
- Post-Prandial Glucose: 198 mg/dL (Normal: <140) ⚠️ HIGH

## Lipid Profile

- Total Cholesterol: 220 mg/dL (Normal: <200) ⚠️ HIGH
- LDL: 148 mg/dL (Normal: <100) ⚠️ HIGH
- HDL: 38 mg/dL (Normal: >40) ⚠️ LOW
- Triglycerides: 185 mg/dL (Normal: <150) ⚠️ HIGH

## Thyroid Profile

- TSH: 6.8 μIU/mL (Normal: 0.4–4.0) ⚠️ HIGH
- T3: 82 ng/dL (Normal: 80–200) Normal
- T4: 5.2 μg/dL (Normal: 5.0–12.0) Normal

## Liver Function Tests

- SGOT/AST: 32 U/L (Normal: 10–40) Normal
- SGPT/ALT: 28 U/L (Normal: 7–40) Normal
- Total Bilirubin: 0.8 mg/dL (Normal: 0.2–1.2) Normal

## Summary of Abnormal Values

Multiple abnormal values noted. Low hemoglobin with low RBC and hematocrit suggests anemia.
Elevated fasting glucose and HbA1c indicate prediabetes or early diabetes.
Elevated TSH with normal T3/T4 suggests subclinical hypothyroidism.
High LDL and triglycerides with low HDL indicate dyslipidemia.
Mildly elevated WBC may suggest mild infection or inflammation.
`;
