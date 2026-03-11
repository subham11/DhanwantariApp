/**
 * DosageCheck.ts — V3: Self-Verification Stage
 *
 * Blocks any dosage information the LLM fabricates or misquotes.
 * Regex-only — works offline on all tiers at <5ms.
 *
 * Per DhanwantariAI Self-Verification Strategy §4.1 V3.
 */

import type {
  Disease,
  ExtractedDosage,
  StageResult,
} from '@store/types';

// ─── Dosage regex ─────────────────────────────────────────────────────────────

const DOSAGE_PATTERN =
  /(\d+\.?\d*)\s*(mg|ml|mcg|µg|g|iu|units?|tablets?|capsules?|drops?|puffs?|teaspoons?|tsp|tablespoons?|tbsp)/gi;

const MEDICATION_PATTERN =
  /(?:take|administer|give|prescribe|use)\s+(\w[\w\s-]{2,30}?)\s+(\d+\.?\d*)\s*(mg|ml|mcg|µg|g|iu|units?|tablets?|capsules?)/gi;

// ─── Known safe dosage ranges (common NLEM medications) ──────────────────────

/** Medication → { min, max, unit } in standard single-dose */
const KNOWN_DOSAGE_RANGES: Readonly<Record<string, {min: number; max: number; unit: string}>> = {
  paracetamol:     {min: 250, max: 1000, unit: 'mg'},
  ibuprofen:       {min: 200, max: 800, unit: 'mg'},
  amoxicillin:     {min: 250, max: 1000, unit: 'mg'},
  metformin:       {min: 250, max: 1000, unit: 'mg'},
  atenolol:        {min: 25, max: 100, unit: 'mg'},
  amlodipine:      {min: 2.5, max: 10, unit: 'mg'},
  omeprazole:      {min: 10, max: 40, unit: 'mg'},
  azithromycin:    {min: 250, max: 500, unit: 'mg'},
  cetirizine:      {min: 5, max: 10, unit: 'mg'},
  metoprolol:      {min: 25, max: 200, unit: 'mg'},
  losartan:        {min: 25, max: 100, unit: 'mg'},
  atorvastatin:    {min: 10, max: 80, unit: 'mg'},
  aspirin:         {min: 75, max: 650, unit: 'mg'},
  ciprofloxacin:   {min: 250, max: 750, unit: 'mg'},
  doxycycline:     {min: 50, max: 200, unit: 'mg'},
  chloroquine:     {min: 150, max: 600, unit: 'mg'},
  artemether:      {min: 20, max: 80, unit: 'mg'},
  ors:             {min: 200, max: 1000, unit: 'ml'},
  'iron tablets':  {min: 60, max: 200, unit: 'mg'},
  'folic acid':    {min: 0.4, max: 5, unit: 'mg'},
  albendazole:     {min: 200, max: 400, unit: 'mg'},
  ivermectin:      {min: 3, max: 18, unit: 'mg'},
  salbutamol:      {min: 2, max: 8, unit: 'mg'},
};

// ─── Extraction ───────────────────────────────────────────────────────────────

export function extractDosages(text: string): ExtractedDosage[] {
  const results: ExtractedDosage[] = [];
  let match: RegExpExecArray | null;

  // Try medication-specific pattern first
  const medRegex = new RegExp(MEDICATION_PATTERN.source, MEDICATION_PATTERN.flags);
  while ((match = medRegex.exec(text)) !== null) {
    results.push({
      medication: match[1].trim().toLowerCase(),
      amount: parseFloat(match[2]),
      unit: match[3].toLowerCase(),
      rawText: match[0],
    });
  }

  // If no medication-pattern matches, extract standalone dosages
  if (results.length === 0) {
    const doseRegex = new RegExp(DOSAGE_PATTERN.source, DOSAGE_PATTERN.flags);
    while ((match = doseRegex.exec(text)) !== null) {
      results.push({
        medication: 'unknown',
        amount: parseFloat(match[1]),
        unit: match[2].toLowerCase(),
        rawText: match[0],
      });
    }
  }

  return results;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isKnownMedication(name: string, diseaseRecord: Disease | null): boolean {
  if (KNOWN_DOSAGE_RANGES[name]) return true;
  if (!diseaseRecord) return false;

  const meds = [
    diseaseRecord.generic_medicines,
    diseaseRecord.janaushadhi_medicines,
    diseaseRecord.ayurvedic_medicines,
  ].join(' ').toLowerCase();

  return meds.includes(name);
}

function isDosageSafe(dosage: ExtractedDosage): 'safe' | 'unsafe' | 'unknown' {
  const range = KNOWN_DOSAGE_RANGES[dosage.medication];
  if (!range) return 'unknown';

  // Unit must match (normalise plural)
  const normUnit = dosage.unit.replace(/s$/, '');
  const rangeNormUnit = range.unit.replace(/s$/, '');
  if (normUnit !== rangeNormUnit) return 'unknown';

  // Allow ±2x tolerance for different formulations
  if (dosage.amount < range.min / 2 || dosage.amount > range.max * 2) {
    return 'unsafe';
  }

  return 'safe';
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function checkDosage(
  llmResponse: string,
  diseaseRecord: Disease | null,
): StageResult {
  const dosages = extractDosages(llmResponse);

  if (dosages.length === 0) {
    return {
      stage: 'V3_DOSAGE',
      verdict: 'PASS',
      reason: 'No dosage information found in response',
    };
  }

  let hasUnsafe = false;
  let hasUnverified = false;
  const issues: string[] = [];

  for (const d of dosages) {
    const safety = isDosageSafe(d);

    if (safety === 'unsafe') {
      hasUnsafe = true;
      issues.push(`${d.rawText} — outside safe range for ${d.medication}`);
    } else if (safety === 'unknown') {
      const known = isKnownMedication(d.medication, diseaseRecord);
      if (!known) {
        hasUnverified = true;
        issues.push(`${d.rawText} — unverified medication "${d.medication}"`);
      }
    }
  }

  if (hasUnsafe) {
    return {
      stage: 'V3_DOSAGE',
      verdict: 'BLOCK',
      reason: `Unsafe dosage detected: ${issues.join('; ')}`,
      replacement: 'Dosage should be confirmed by a doctor. ' +
        'Please refer to the nearest health centre for prescriptions.',
    };
  }

  if (hasUnverified) {
    return {
      stage: 'V3_DOSAGE',
      verdict: 'WARN',
      reason: `Unverified dosage: ${issues.join('; ')}`,
    };
  }

  return {
    stage: 'V3_DOSAGE',
    verdict: 'PASS',
    reason: 'All dosages within known safe ranges',
  };
}
