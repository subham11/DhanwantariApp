import {UserProfile, MatchedDisease, SeverityLevel, AnalysisResult} from '@store/types';

export type BmiCategory =
  | 'Underweight'
  | 'Normal weight'
  | 'Overweight'
  | 'Obese (Class I)'
  | 'Obese (Class II)'
  | 'Obese (Class III)';

// ─── BMI & Calorie Calculations ───────────────────────────────────────────────

export function calculateBMI(heightCm: number, weightKg: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const heightM = heightCm / 100;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
}

export function getBMICategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25.0) return 'Normal weight';
  if (bmi < 30.0) return 'Overweight';
  if (bmi < 35.0) return 'Obese (Class I)';
  if (bmi < 40.0) return 'Obese (Class II)';
  return 'Obese (Class III)';
}

const ACTIVITY_MULTIPLIERS: Record<UserProfile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateMaintenanceCalories(
  profile: Pick<UserProfile, 'age' | 'gender' | 'heightCm' | 'weightKg' | 'activityLevel'>,
): number {
  // Mifflin-St Jeor equation
  let bmr: number;
  if (profile.gender === 'male') {
    bmr =
      10 * profile.weightKg +
      6.25 * profile.heightCm -
      5 * profile.age +
      5;
  } else {
    bmr =
      10 * profile.weightKg +
      6.25 * profile.heightCm -
      5 * profile.age -
      161;
  }
  const tdee = bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];
  return Math.round(tdee);
}

// ─── Personalized Analysis Text ───────────────────────────────────────────────

export function generatePersonalizedAnalysis(
  profile: UserProfile,
  symptoms: string[],
  topDiseases: MatchedDisease[],
  severity: SeverityLevel,
): string {
  const {firstName, age, bmi, bmiCategory, gender} = profile;
  const symptomStr = symptoms.join(' / ');
  const topDisease = topDiseases[0];

  const bmiNote =
    bmi >= 30
      ? `your BMI of ${bmi} (${bmiCategory})`
      : bmi >= 25
      ? `your BMI of ${bmi} (Overweight)`
      : `your BMI of ${bmi} (${bmiCategory})`;

  const ageNote =
    age >= 50
      ? `At age ${age}, regular check-ups become increasingly important for early detection.`
      : age >= 40
      ? `At age ${age}, regular check-ups become increasingly important for early detection.`
      : `At age ${age}, maintaining a healthy lifestyle is key.`;

  const genderNote =
    gender === 'male'
      ? `your age of ${age} and male gender increase certain risks.`
      : gender === 'female'
      ? `your age of ${age} and female-specific factors are relevant.`
      : '';

  const diseaseNote =
    topDisease
      ? `it's possible that your ${symptomStr.toLowerCase()} may be related to ${topDisease.disease.name.toLowerCase()} or other underlying conditions.`
      : `your symptoms warrant a professional medical evaluation.`;

  const severityNote =
    severity === 'Severe'
      ? 'Your symptoms suggest a potentially serious condition. Please seek medical attention promptly. 🚨'
      : severity === 'Moderate'
      ? "If your symptoms persist or worsen, please consult a doctor to rule out any underlying conditions. 💊"
      : "If your symptoms persist or worsen, please consult a doctor to rule out any underlying conditions. 💊";

  return (
    `${firstName}, it's great that you're seeking help for your ${symptomStr.toLowerCase()}. ` +
    `Given your age, ${bmiNote}, and reported symptoms, ${diseaseNote} ` +
    `${genderNote} ` +
    `${ageNote} ` +
    severityNote
  ).trim();
}

// ─── Full Analysis Runner ─────────────────────────────────────────────────────

export function buildAnalysisResult(
  profile: UserProfile,
  symptoms: string[],
  matchedDiseases: MatchedDisease[],
  severity: SeverityLevel,
): AnalysisResult {
  const personalizedAnalysis = generatePersonalizedAnalysis(
    profile,
    symptoms,
    matchedDiseases,
    severity,
  );
  return {
    symptoms,
    severity,
    personalizedAnalysis,
    matchedDiseases,
    analysedAt: new Date().toISOString(),
  };
}

// ─── Profile Helpers ──────────────────────────────────────────────────────────

export function getActivityLevelLabel(level: UserProfile['activityLevel']): string {
  const labels: Record<UserProfile['activityLevel'], string> = {
    sedentary: 'Sedentary (No exercise)',
    light: 'Light (Exercise 1-3 days/week)',
    moderate: 'Moderate (Exercise 3-5 days/week)',
    active: 'Active (Exercise 6-7 days/week)',
    very_active: 'Very Active (Intense daily exercise)',
  };
  return labels[level];
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
