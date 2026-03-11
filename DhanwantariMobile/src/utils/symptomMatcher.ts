import {
  Disease,
  MatchedDisease,
  MatchTier,
  SeverityLevel,
  UserProfile,
  AnalysisResult,
} from '@store/types';
import {
  getDiseases,
  getDiseasesForSymptoms,
  getScoringAlgorithm,
} from './dataLoader';

const CRITICAL_SYMPTOMS = new Set([
  'Hemoptysis',
  'Seizures',
  'Chest Pain',
  'Loss of Consciousness',
  'Fainting',
  'Severe Shortness of Breath',
  'Paralysis',
  'Stroke',
]);

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeSymptomScore(
  selectedSymptoms: string[],
  disease: Disease,
): {score: number; matchedSymptoms: string[]} {
  const matchedSymptoms = selectedSymptoms.filter(s =>
    disease.symptoms.includes(s),
  );
  const score =
    disease.symptom_count > 0
      ? (matchedSymptoms.length / disease.symptom_count) * 60
      : 0;
  return {score: Math.min(60, score), matchedSymptoms};
}

function computeProfileBoost(
  profile: UserProfile,
  disease: Disease,
): {boost: number; reasons: string[]} {
  const scoring = getScoringAlgorithm();
  const weights = scoring.weights.profile_boost.sub;
  let boost = 0;
  const reasons: string[] = [];

  // Gender boost
  if (
    disease.gender !== 'both' &&
    disease.gender === profile.gender
  ) {
    boost += weights.gender;
    reasons.push(`${profile.gender} gender match`);
  }

  // BMI boost
  const bmi = profile.bmi;
  if (bmi > 0) {
    const diseaseNameLower = disease.name.toLowerCase();
    const isObesityRelated =
      diseaseNameLower.includes('diabetes') ||
      diseaseNameLower.includes('hypertension') ||
      diseaseNameLower.includes('sleep apnea') ||
      diseaseNameLower.includes('fatty liver') ||
      diseaseNameLower.includes('arthritis') ||
      diseaseNameLower.includes('gout') ||
      diseaseNameLower.includes('cardiovascular');

    if (bmi >= 30 && isObesityRelated) {
      boost += weights.bmi;
      reasons.push(`BMI ${bmi.toFixed(1)} (${profile.bmiCategory})`);
    } else if (bmi >= 25 && isObesityRelated) {
      boost += weights.bmi * 0.5;
      reasons.push(`BMI ${bmi.toFixed(1)} (Overweight)`);
    }
  }

  // Age boost
  const age = profile.age;
  const isAgeRelated = ((): boolean => {
    const n = disease.name.toLowerCase();
    if (age >= 50) {
      return (
        n.includes('diabetes') ||
        n.includes('hypertension') ||
        n.includes('heart') ||
        n.includes('cancer') ||
        n.includes('osteo') ||
        n.includes('alzheimer')
      );
    }
    if (age <= 15) {
      return (
        n.includes('malnutrition') ||
        n.includes('measles') ||
        n.includes('mumps') ||
        n.includes('chickenpox')
      );
    }
    return false;
  })();

  if (isAgeRelated) {
    boost += weights.age;
    reasons.push(`Age ${age} risk factor`);
  }

  return {boost: Math.min(25, boost), reasons};
}

function determineTier(score: number): MatchTier {
  const scoring = getScoringAlgorithm();
  const tiers = scoring.match_tiers;
  if (score >= tiers['High Match'].min) return 'High Match';
  if (score >= tiers['Medium Match'].min) return 'Medium Match';
  return 'Low Match';
}

function determineSeverity(
  selectedSymptoms: string[],
  profile: UserProfile | null,
  topDiseases: MatchedDisease[],
): SeverityLevel {
  const count = selectedSymptoms.length;
  const hasCritical = selectedSymptoms.some(s => CRITICAL_SYMPTOMS.has(s));
  const hasHereditaryMatch = profile
    ? topDiseases.some(d => profile.hereditaryDiseases.includes(d.disease.id))
    : false;

  if (count >= 6 || hasCritical) return 'Severe';
  if (count >= 3 || (profile && profile.bmi > 30) || hasHereditaryMatch) return 'Moderate';
  return 'Mild';
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function analyzeSymptoms(
  selectedSymptoms: string[],
  profile: UserProfile | null,
): Pick<AnalysisResult, 'matchedDiseases' | 'severity'> {
  if (selectedSymptoms.length === 0) {
    return {matchedDiseases: [], severity: 'Mild'};
  }

  const candidates = getDiseasesForSymptoms(selectedSymptoms);

  const scored: MatchedDisease[] = candidates
    .filter(disease => {
      // Filter out gender-specific diseases that don't match
      if (disease.gender === 'both') return true;
      if (!profile) return true;
      return disease.gender === profile.gender;
    })
    .map(disease => {
      const {score: symptomScore, matchedSymptoms} = computeSymptomScore(
        selectedSymptoms,
        disease,
      );
      const {boost: profileBoost, reasons} = profile
        ? computeProfileBoost(profile, disease)
        : {boost: 0, reasons: []};
      const totalScore = Math.min(100, Math.round(symptomScore + profileBoost));
      const tier = determineTier(totalScore);
      const explanation = buildExplanation(
        disease,
        matchedSymptoms,
        reasons,
        profile,
      );

      return {
        disease,
        score: totalScore,
        tier,
        matchedSymptoms,
        symptomScore: Math.round(symptomScore),
        profileBoost: Math.round(profileBoost),
        explanation,
      };
    })
    // Require at least 2 matched symptoms AND a meaningful score to avoid
    // spurious hits on diseases with very few symptoms in the DB
    .filter(m => m.score >= 15 && m.matchedSymptoms.length >= 2)
    .sort((a, b) => b.score - a.score);

  const severity = determineSeverity(selectedSymptoms, profile, scored);

  return {matchedDiseases: scored, severity};
}

function buildExplanation(
  disease: Disease,
  matchedSymptoms: string[],
  boostReasons: string[],
  profile: UserProfile | null,
): string {
  const sympStr = matchedSymptoms.join(' / ');
  if (matchedSymptoms.length === 0) {
    return `Profile-based risk for ${disease.name}. Professional evaluation is recommended.`;
  }

  const boostStr =
    boostReasons.length > 0 ? ` Additionally, ${boostReasons.join(' and ')}.` : '';

  // Use india_specific content when available for richer context
  const indiaNote =
    disease.india_specific && disease.india_specific.length > 0
      ? ''
      : '';

  return `${sympStr} ${matchedSymptoms.length === 1 ? 'is a common symptom' : 'are classic warning signs'} of ${disease.name}.${boostStr}${indiaNote} Professional evaluation is recommended.`;
}

/**
 * Get all diseases array (for browsing)
 */
export function getAllDiseases(): Disease[] {
  return getDiseases();
}
