/**
 * PIIStripper.ts
 *
 * Strips personally identifiable information from clinical query strings
 * before any Bedrock / Qdrant API calls.
 *
 * Per DhanwantariAI Architecture v2.2 §11.3 and DPDP Act 2023 compliance.
 *
 * Strips:
 *   - Aadhaar numbers (12-digit, possibly space/dash separated)
 *   - Indian mobile numbers (10-digit starting 6–9, with optional +91/0 prefix)
 *   - Patient name patterns ("patient Ramesh", "my patient Sunita Devi")
 *   - Indian PIN codes (6-digit preceded by "pin"/"pincode")
 *   - Village / gram / tehsil location references
 */

// ─── PII Patterns ─────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{regex: RegExp; replacement: string}> = [
  // Aadhaar: 12 digits, possibly space/dash separated: XXXX-XXXX-XXXX
  {
    regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[AADHAAR]',
  },
  // Indian mobile: 10 digits starting 6–9, optional +91 or 0 prefix
  {
    regex: /\b(?:\+91|0)?[6-9]\d{9}\b/g,
    replacement: '[PHONE]',
  },
  // PIN codes: 6-digit codes preceded by "pin" or "pincode"
  {
    regex: /\bpin(?:code)?[\s:-]*\d{6}\b/gi,
    replacement: '[PINCODE]',
  },
  // "patient <Name>" or "my patient <Name>"
  {
    regex: /\b(?:my\s+)?patient\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/g,
    replacement: 'patient [NAME]',
  },
  // "for <Name>" — single capitalised proper noun following "for"
  {
    regex: /\bfor\s+([A-Z][a-z]{2,})\b/g,
    replacement: 'for [NAME]',
  },
  // Village / gram / tehsil / taluka location references
  {
    regex: /\b(?:village|gram|tehsil|taluka|mandal)\s+[\w\s]{2,20}/gi,
    replacement: '[LOCATION]',
  },
];

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Remove PII from a clinical query string.
 * Returns a sanitised version safe to send to Bedrock or Qdrant.
 *
 * Pure function — no side effects.
 */
export function stripPII(text: string): string {
  let result = text;
  for (const {regex, replacement} of PII_PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result.trim();
}
