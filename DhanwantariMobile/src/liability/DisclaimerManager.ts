/**
 * DisclaimerManager.ts
 *
 * Centralises all disclaimer strings for DhanwantariAI.
 * Per DhanwantariAI Architecture v2.2 §10.2.
 *
 * All clinical screens must reference these constants.
 * Do not hardcode disclaimer strings in individual components.
 */

export const Disclaimers = {
  /**
   * General advisory — shown on all clinical output screens.
   * Must be visible, not hidden in fine print.
   */
  general:
    'DhanwantariAI is a clinical decision support tool for trained ASHA workers. ' +
    'It does not replace clinical judgement. Always consult a qualified health worker or doctor for diagnosis and treatment.',

  /**
   * Referral screen — shown below referral guidance.
   */
  referral:
    'Referral guidance is based on National Health Mission protocols. ' +
    'Final referral decisions rest with the ASHA worker and treating physician.',

  /**
   * Medicine screen — shown on medicine recommendations.
   */
  medicine:
    'Medicine suggestions are for informational purposes only. ' +
    'Dosage, contraindications, and drug interactions must be verified with a licensed pharmacist or physician. ' +
    'JanAushadhi prices are approximate and subject to change.',

  /**
   * Low-confidence — shown when confidence < CONFIDENCE_MEDIUM.
   */
  lowConfidence:
    'Local data insufficient for a high-confidence assessment. ' +
    'Cloud verification is recommended. If unavailable, refer to the nearest PHC.',

  /**
   * Ayurvedic alternatives.
   */
  ayurveda:
    'Ayurvedic recommendations are based on traditional texts and AYUSH ministry guidelines. ' +
    'These are complementary options — do not substitute for prescribed allopathic treatment.',

  /**
   * Emergency — shown on IMMEDIATE risk screens.
   * This is the most prominent disclaimer and should be displayed as an overlay.
   */
  emergency:
    '🚨 This is a medical emergency. Call 108 immediately. ' +
    'Do not use this app for further guidance — get the patient to hospital now.',
} as const;

export type DisclaimerKey = keyof typeof Disclaimers;

/** Get disclaimer text by key */
export function getDisclaimer(key: DisclaimerKey): string {
  return Disclaimers[key];
}
