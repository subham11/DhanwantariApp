import rawData from '@assets/data/symptom_disease_mapping.json';
import {SymptomDiseaseDB, SymptomCategory, Disease} from '@store/types';

// Cast the raw JSON import to our typed structure
const db = rawData as unknown as SymptomDiseaseDB;

// ─── Accessors ────────────────────────────────────────────────────────────────

export function getDiseases(): Disease[] {
  return db.diseases;
}

export function getSymptomCategories(): SymptomCategory[] {
  return Object.entries(db.symptom_categories).map(([name, symptoms]) => ({
    name,
    symptoms: symptoms.map(s => ({
      name: s,
      description: getSymptomDescription(s),
    })),
  }));
}

export function getReverseIndex(): Record<string, string[]> {
  return db.reverse_index;
}

export function getMetadata() {
  return db.metadata;
}

export function getScoringAlgorithm() {
  return db.scoring_algorithm;
}

/**
 * Get diseases that include all of the given symptoms.
 */
export function getDiseasesForSymptoms(symptoms: string[]): Disease[] {
  if (symptoms.length === 0) return [];
  const reverseIndex = db.reverse_index;
  // Collect disease IDs that appear for at least one symptom
  const diseaseCandidateIds = new Set<string>();
  symptoms.forEach(sym => {
    const ids = reverseIndex[sym] ?? [];
    ids.forEach(id => diseaseCandidateIds.add(id));
  });
  return db.diseases.filter(d => diseaseCandidateIds.has(d.id));
}

// Simple human-readable descriptions for common symptoms
const SYMPTOM_DESCRIPTIONS: Record<string, string> = {
  'Fatigue': 'Feeling unusually tired or weak',
  'Tiredness': 'Feeling unusually tired or weak',
  'Fatigue / Tiredness': 'Feeling unusually tired or weak',
  'Fever': 'Elevated body temperature',
  'Cough': 'Persistent or dry cough',
  'Headache': 'Pain in head or neck region',
  'Nausea': 'Feeling of wanting to vomit',
  'Vomiting': 'Forceful expulsion of stomach contents',
  'Diarrhea': 'Loose or watery stools',
  'Chest Pain': 'Discomfort or pain in chest area',
  'Shortness of Breath': 'Difficulty breathing or breathlessness',
  'Weight Loss': 'Unexplained reduction in body weight',
  'Unexplained Weight Loss': 'Losing weight without trying',
  'Unexplained Weight Gain': 'Gaining weight without changes in diet',
  'Loss of Appetite': 'Reduced desire to eat',
  'Night Sweats': 'Excessive sweating during sleep',
  'Joint Pain': 'Pain in one or more joints',
  'Muscle Pain': 'Aching or sore muscles',
  'Skin Rash': 'Redness or irritation on skin',
  'Itching': 'Uncomfortable urge to scratch',
  'Swelling': 'Abnormal enlargement of a body part',
  'Dizziness': 'Feeling of spinning or unsteadiness',
  'Blurred Vision': 'Difficulty seeing clearly',
  'Frequent Urination': 'Need to urinate more often than usual',
  'Blood in Urine': 'Presence of blood in urine',
  'Seizures': 'Sudden, uncontrolled electrical disturbance in brain',
  'Confusion': 'Difficulty thinking clearly or focusing',
  'Memory Loss': 'Difficulty recalling information',
  'Depression': 'Persistent sadness or loss of interest',
  'Anxiety': 'Excessive worry or nervousness',
};

function getSymptomDescription(symptom: string): string {
  return SYMPTOM_DESCRIPTIONS[symptom] ?? '';
}
