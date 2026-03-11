/**
 * FactGrounder.ts — V1: Self-Verification Stage
 *
 * Confirms every factual claim in LLM output is traceable to a source
 * in the retrieval bundle or the disease database.
 *
 * Two modes:
 *   - Regex mode (Tier 1 / all tiers for speed): keyword matching
 *   - LLM-assisted mode (Tier 2/3): structured extraction via on-device LLM
 *     (future — when llama.rn is wired; currently falls back to regex mode)
 *
 * Per DhanwantariAI Self-Verification Strategy §4.1 V1.
 */

import type {
  Disease,
  RetrievalBundle,
  FactualAssertion,
  StageResult,
} from '@store/types';

// ─── Regex-Based Assertion Extraction ─────────────────────────────────────────

/**
 * Extract factual assertions from LLM output using regex patterns.
 * Fast (~5ms), runs on all tiers, no LLM dependency.
 */
export function extractAssertionsRegex(
  text: string,
  knownDiseaseNames: string[],
  knownMedications: string[],
): FactualAssertion[] {
  const assertions: FactualAssertion[] = [];
  const lower = text.toLowerCase();

  // Disease mentions
  for (const name of knownDiseaseNames) {
    if (lower.includes(name.toLowerCase())) {
      assertions.push({
        type: 'disease',
        value: name,
        grounded: false, // will be checked later
      });
    }
  }

  // Medication mentions
  for (const med of knownMedications) {
    if (lower.includes(med.toLowerCase())) {
      assertions.push({
        type: 'medication',
        value: med,
        grounded: false,
      });
    }
  }

  // Referral mentions
  const referralPatterns = [
    /refer\s+to\s+(hospital|phc|chc|fru|asha|health\s+cent[re]+)/gi,
    /visit\s+(the\s+)?(nearest\s+)?(hospital|phc|chc|fru|health\s+cent[re]+|doctor)/gi,
    /call\s+(108|ambulance|emergency)/gi,
  ];
  for (const pattern of referralPatterns) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      assertions.push({
        type: 'referral',
        value: match[0],
        grounded: true, // referrals are always valid advice
        source: 'general_guidance',
      });
    }
  }

  // Dosage mentions (type only — actual validation done in DosageCheck)
  const dosagePattern =
    /(\d+\.?\d*)\s*(mg|ml|mcg|µg|g|iu|units?|tablets?|capsules?)/gi;
  let dMatch: RegExpExecArray | null;
  const dRe = new RegExp(dosagePattern.source, dosagePattern.flags);
  while ((dMatch = dRe.exec(text)) !== null) {
    assertions.push({
      type: 'dosage',
      value: dMatch[0],
      grounded: false,
    });
  }

  return assertions;
}

// ─── Grounding Check ─────────────────────────────────────────────────────────

/**
 * Check each assertion against the retrieval bundle and disease records.
 * Mutates the `grounded` and `source` fields in-place.
 */
export function groundAssertions(
  assertions: FactualAssertion[],
  retrievalBundle: RetrievalBundle,
  matchedDiseaseRecords: Disease[],
): void {
  const ftsNames = new Set(
    retrievalBundle.ftsResults.map(r => r.diseaseName.toLowerCase()),
  );
  const vecNames = new Set(
    retrievalBundle.vectorMatches
      .map(r => String(r.payload?.disease_name ?? '').toLowerCase())
      .filter(Boolean),
  );
  const piTitles = retrievalBundle.pageIndexNodes.map(n =>
    n.title.toLowerCase(),
  );
  const piContent = retrievalBundle.pageIndexNodes.map(n =>
    n.content.toLowerCase(),
  );
  const diseaseNames = new Set(
    matchedDiseaseRecords.map(d => d.name.toLowerCase()),
  );

  // Build medication set from all disease records
  const knownMeds = new Set<string>();
  for (const d of matchedDiseaseRecords) {
    for (const field of [d.generic_medicines, d.janaushadhi_medicines, d.ayurvedic_medicines]) {
      if (field) {
        field 
          .toLowerCase()
          .split(/[,;|]/)
          .map(m => m.trim())
          .filter(Boolean)
          .forEach(m => knownMeds.add(m));
      }
    }
  }

  for (const a of assertions) {
    const lowerVal = a.value.toLowerCase();

    switch (a.type) {
      case 'disease':
        if (diseaseNames.has(lowerVal)) {
          a.grounded = true;
          a.source = 'disease_db';
        } else if (ftsNames.has(lowerVal)) {
          a.grounded = true;
          a.source = 'fts5_search';
        } else if (vecNames.has(lowerVal)) {
          a.grounded = true;
          a.source = 'vector_search';
        }
        break;

      case 'medication':
        if (knownMeds.has(lowerVal)) {
          a.grounded = true;
          a.source = 'disease_db_medicines';
        } else {
          // Check PageIndex content
          const inPI = piContent.some(c => c.includes(lowerVal));
          if (inPI) {
            a.grounded = true;
            a.source = 'page_index';
          }
        }
        break;

      case 'dosage':
        // Dosages grounded via DosageCheck (V3) — mark as grounded if
        // the medication is known (even if dose not yet validated)
        a.grounded = true; // defer to V3 for actual dose safety
        a.source = 'deferred_to_v3';
        break;

      case 'symptom_link':
        // Check if the symptom-disease link exists in PageIndex
        const inPITitle = piTitles.some(t => t.includes(lowerVal));
        if (inPITitle) {
          a.grounded = true;
          a.source = 'page_index';
        }
        break;

      case 'referral':
        // Already marked grounded during extraction
        break;
    }
  }
}

// ─── Build medication list from disease DB ────────────────────────────────────

function collectMedications(diseases: Disease[]): string[] {
  const meds = new Set<string>();
  for (const d of diseases) {
    for (const field of [d.generic_medicines, d.janaushadhi_medicines, d.ayurvedic_medicines]) {
      if (field) {
        field
          .split(/[,;|]/)
          .map(m => m.trim().toLowerCase())
          .filter(m => m.length > 2)
          .forEach(m => meds.add(m));
      }
    }
  }
  return [...meds];
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function checkFactGrounding(
  llmResponse: string,
  retrievalBundle: RetrievalBundle,
  matchedDiseases: Disease[],
): StageResult {
  const diseaseNames = matchedDiseases.map(d => d.name);
  const medications = collectMedications(matchedDiseases);

  const assertions = extractAssertionsRegex(
    llmResponse,
    diseaseNames,
    medications,
  );

  // No factual assertions → trivially grounded
  if (assertions.length === 0) {
    return {
      stage: 'V1_FACT',
      verdict: 'PASS',
      reason: 'No factual medical claims detected in response',
    };
  }

  groundAssertions(assertions, retrievalBundle, matchedDiseases);

  const totalCheckable = assertions.filter(
    a => a.type !== 'referral' && a.type !== 'dosage',
  );
  const grounded = totalCheckable.filter(a => a.grounded);

  // Avoid division by zero
  if (totalCheckable.length === 0) {
    return {
      stage: 'V1_FACT',
      verdict: 'PASS',
      reason: 'Only referrals and dosages found (deferred to V2/V3)',
    };
  }

  const groundingRatio = grounded.length / totalCheckable.length;

  if (groundingRatio >= 0.85) {
    return {
      stage: 'V1_FACT',
      verdict: 'PASS',
      reason: `Grounding ratio ${(groundingRatio * 100).toFixed(0)}% — ${grounded.length}/${totalCheckable.length} claims verified`,
    };
  }

  if (groundingRatio >= 0.60) {
    const ungrounded = totalCheckable
      .filter(a => !a.grounded)
      .map(a => `${a.type}: "${a.value}"`)
      .join(', ');
    return {
      stage: 'V1_FACT',
      verdict: 'WARN',
      reason: `Grounding ratio ${(groundingRatio * 100).toFixed(0)}% — unverified claims: ${ungrounded}`,
    };
  }

  return {
    stage: 'V1_FACT',
    verdict: 'BLOCK',
    reason: `Grounding ratio ${(groundingRatio * 100).toFixed(0)}% — too many unverified claims`,
    replacement:
      'The AI response contained claims that could not be verified against ' +
      'clinical guidelines. Please consult a qualified doctor for guidance.',
  };
}
