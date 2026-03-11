import {UserProfile, ChatMessage, MessageRole} from '@store/types';

const QUICK_RESPONSES: Record<string, string> = {
  dengue: `**Dengue Danger Signs** 🚨\n\nSeek immediate medical attention if you notice:\n• Severe abdominal pain\n• Persistent vomiting\n• Bleeding from gums or nose\n• Blood in vomit or stools\n• Rapid breathing\n• Fatigue/restlessness\n\nEarly DOTS therapy and adequate hydration are critical. Consult a doctor immediately.`,
  fever_pregnancy: `**Fever in Pregnancy** ⚠️\n\nFever ≥38°C (100.4°F) during pregnancy requires prompt attention:\n\n• Stay hydrated — drink water/ORS\n• Paracetamol is safe (avoid ibuprofen/aspirin)\n• Monitor for symptoms >24 hours\n• Seek care for: high fever, chills, rash, difficulty breathing\n\nAlways consult your OB/GYN or nearest PHC immediately.`,
  tb_dots: `**TB DOTS Medicines (JanAushadhi Prices)** 💊\n\n*Category I (New patients):*\n• Rifampicin 150mg + INH 75mg + PZA 400mg + Ethambutol 275mg\n• Price: ₹4–8 per tablet at JanAushadhi stores\n\n*Category II (Retreatment):*\n• Above + Streptomycin injection\n\nDOTS therapy is **free** at all government health centres.\nNearest DOTS centre: Contact your local ASHA worker or PHC.`,
  diabetes_janaushadhi: `**Diabetes Medicines — JanAushadhi** 🏥\n\n*Oral medications (affordable):*\n• Metformin 500/850/1000mg — ₹2–6/tablet\n• Glipizide 5mg — ₹1–2/tablet\n• Sitagliptin 50/100mg — ₹15–25/tablet\n\n*Insulin:*\n• Human Insulin 40IU/ml — ₹70–85/vial\n\nAll available at Jan Aushadhi Kendras. Check pmbjp.gov.in for nearest store.`,
};

function getQuickResponse(query: string): string | null {
  const q = query.toLowerCase();
  if (q.includes('dengue')) return QUICK_RESPONSES.dengue;
  if (q.includes('fever') && (q.includes('pregnan') || q.includes('pregnancy')))
    return QUICK_RESPONSES.fever_pregnancy;
  if (q.includes('tb') || q.includes('tuberculosis') || q.includes('dots'))
    return QUICK_RESPONSES.tb_dots;
  if (q.includes('diabetes') && (q.includes('jan') || q.includes('medicine')))
    return QUICK_RESPONSES.diabetes_janaushadhi;
  return null;
}

function buildSystemPrompt(profile: UserProfile): string {
  return `You are DhanwantariAI, an offline clinical decision support assistant focused on Indian healthcare. You are helping ${profile.firstName} ${profile.lastName}, age ${profile.age}, BMI ${profile.bmi} (${profile.bmiCategory}), maintenance calories ${profile.maintenanceCalories} kcal/day.

You have knowledge of 146 diseases, JanAushadhi medicines with prices, Ayurvedic remedies, yoga and pranayama guides, and India-specific health information.

Guidelines:
- Be empathetic, clear, and concise
- Always recommend consulting a doctor for serious symptoms
- Mention JanAushadhi alternatives when discussing medicines
- Include prices in INR when relevant
- Use Namaste when greeting
- Never diagnose definitively — guide and suggest
- Respond in the same language the user writes in`;
}

// ─── Main offline fallback ────────────────────────────────────────────────────

export function generateOfflineResponse(
  userMessage: string,
  profile: UserProfile | null,
  conversationHistory: ChatMessage[],
): string {
  const quickResp = getQuickResponse(userMessage);
  if (quickResp) return quickResp;

  const q = userMessage.toLowerCase();

  // ── Symptom Check auto-message from SymptomAnalysisScreen ─────────────────
  // Detect the structured summary sent when navigating from symptoms → chat
  if (q.includes('symptom check results') || q.includes('probable conditions:')) {
    // Extract condition names from "Probable Conditions: X, Y, Z"
    const condMatch = userMessage.match(/Probable Conditions:\s*([^\n]+)/);
    const symMatch  = userMessage.match(/Symptoms:\s*([^\n]+)/);
    const sevMatch  = userMessage.match(/Severity:\s*([^\n]+)/);

    const conditions = condMatch?.[1]?.trim() ?? '';
    const symptoms   = symMatch?.[1]?.trim() ?? '';
    const severity   = sevMatch?.[1]?.trim() ?? '';
    const name       = profile?.firstName ?? 'there';

    const noMatch =
      !conditions ||
      conditions.toLowerCase().includes('no strong match') ||
      conditions.toLowerCase().includes('no match');

    if (noMatch) {
      return (
        `Namaste ${name}, I reviewed your symptoms (${symptoms}) but could not find a strong match ` +
        `in my local database right now.

` +
        `Given your ${severity.toLowerCase()} severity assessment, I recommend:
` +
        `• Rest and stay well-hydrated
` +
        `• Monitor your symptoms over the next 24–48 hours
` +
        `• If symptoms worsen or new ones appear, please visit your nearest PHC or doctor

` +
        `You can also try the Symptom Checker again with more specific symptoms.`
      );
    }

    const conditionList = conditions.split(',').map(s => s.trim()).filter(Boolean);
    const bullet = conditionList.map(c => `• ${c}`).join('\n');

    return (
      `Namaste ${name}, based on your reported symptoms (${symptoms}) and ${severity.toLowerCase()} severity, ` +
      `here are the most probable conditions identified:\n\n${bullet}\n\n` +
      `**General advice:**\n` +
      `• Rest and maintain adequate hydration\n` +
      `• Monitor for worsening symptoms — especially high fever, difficulty breathing, or severe pain\n` +
      `• These are preliminary suggestions only — please consult a qualified doctor for proper diagnosis\n` +
      `• JanAushadhi Kendras offer affordable medicines if prescribed\n\n` +
      `Would you like more details on any of these conditions, their symptoms, or available medicines?`
    );
  }

  // Greeting
  if (q.match(/\b(hello|hi|namaste|hey)\b/)) {
    const name = profile?.firstName ?? 'there';
    return `Namaste ${name}! I am DhanwantariAI, your offline health assistant. I can help you with symptoms, medicines, and health guidance. What would you like to know?`;
  }

  // BMI query — only trigger for explicit BMI/obesity queries, not incidental keyword matches
  if ((q.includes('bmi') || q.includes('obese')) ||
      (q.includes('weight') && (q.includes('gain') || q.includes('loss') || q.includes('my weight') || q.includes('lose')))) {
    if (!profile) {
      return 'Please create a profile first so I can give you personalized BMI and calorie information.';
    }
    return `Your BMI is **${profile.bmi}** (${profile.bmiCategory}).\n\nYour estimated maintenance is **${profile.maintenanceCalories} kcal/day**.\n\n${
      profile.bmi >= 30
        ? 'A BMI ≥30 increases risk for diabetes, hypertension, and joint problems. Regular exercise and a balanced diet are recommended.'
        : profile.bmi >= 25
        ? 'Your BMI is slightly above normal. Mild lifestyle adjustments can help.'
        : 'Your BMI is in a healthy range. Keep maintaining your lifestyle!'
    }`;
  }

  // Symptom checker prompt
  if (
    q.includes('symptom') ||
    q.includes('check') ||
    q.includes('feel') ||
    q.includes('pain') ||
    q.includes('sick')
  ) {
    return `I can help you analyze your symptoms. Please use the **Symptom Checker** button (🩺) in the toolbar to select your current symptoms, and I'll provide a personalized analysis based on your health profile.`;
  }

  // Medicine query
  if (q.includes('medicine') || q.includes('drug') || q.includes('tablet')) {
    return `I have information on 2,373 JanAushadhi medicines and 338 Ayurvedic products.\n\nPlease tell me the specific condition or disease name you'd like medicine information for, and I'll provide affordable options available at Jan Aushadhi Kendras (pmbjp.gov.in).`;
  }

  // Default with system context
  return `I'm currently in offline mode (local data only). I have access to 145 diseases, JanAushadhi medicines, and Ayurvedic guides.\n\nCould you be more specific about what you'd like to know? For example:\n• A specific disease or condition\n• Medicine prices/alternatives\n• Symptom analysis\n• Yoga or diet guidance`;
}

export {buildSystemPrompt, QUICK_RESPONSES};
