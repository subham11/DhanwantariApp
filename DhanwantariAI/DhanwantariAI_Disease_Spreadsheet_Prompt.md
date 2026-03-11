# DhanwantariAI — Disease Data Spreadsheet Generation Prompt

> **Version:** 1.0  
> **Purpose:** Given any disease name, generate a structured clinical dataset in spreadsheet format (.xlsx) suitable for training the DhanwantariAI offline clinical decision support system.  
> **Trusted Sources:** Indian state health department websites, Ministry of Health & Family Welfare (MoHFW), WHO, ICMR, NHM, WebMD, Apollo Pharmacy, 1mg, PharmEasy, CDSCO, Bureau of Pharma PSUs of India (BPPI/Jan Aushadhi), CCRAS (Central Council for Research in Ayurvedic Sciences), peer-reviewed research papers (PubMed, Lancet, BMJ, IJMR).

---

## THE PROMPT

```
You are a senior clinical data specialist building a training dataset for DhanwantariAI — an offline AI clinical decision support system designed for rural healthcare professionals across India. Your task is to generate a comprehensive, medically accurate spreadsheet for the disease specified below.

═══════════════════════════════════════════════════════════
DISEASE NAME: {{DISEASE_NAME}}
═══════════════════════════════════════════════════════════

Generate a single-sheet .xlsx file with the sheet name set to the disease name (lowercase). The spreadsheet must have EXACTLY 9 columns (A through I) with the following headers in Row 1 and data starting from Row 2 onward.

Each column is INDEPENDENT — rows do NOT represent a single record across columns. Each column is a vertical list of items relevant to that column's topic. Columns will have different numbers of entries. Do NOT pad shorter columns with empty values to match longer ones.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COLUMN A — "Disease Name"
• Row 2: The disease name (lowercase).
• Only 1 data row in this column.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COLUMN B — "Core Physical Symptoms of {{DISEASE_NAME}}"
• List 5–10 primary, observable physical symptoms.
• Each cell = one symptom with a short clinical descriptor.
• Format: "Symptom Name: 1–2 sentence clinical description."
• Focus on symptoms a rural health worker could visually identify or assess with basic tools.
• Example pattern:
  - "Wasting (Acute Malnutrition): Rapid weight loss, visible muscle wasting, loss of subcutaneous fat, and skin/hair changes."
  - "Edema (Kwashiorkor): Swelling in the feet, legs, or face due to severe protein deficiency."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COLUMN C — "General Symptoms and Behavioral Changes"
• List 3–6 non-physical, systemic, or behavioral symptoms.
• Include fatigue patterns, behavioral shifts, cognitive changes, immune dysfunction, mood changes, sleep disturbances, etc.
• Format: "Symptom Category: 1–2 sentence description."
• Example pattern:
  - "Constant Fatigue: Extreme weakness, lethargy, and lack of energy."
  - "Behavioral Changes: Irritability, apathy, or difficulty concentrating."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COLUMN D — "India-Specific Complications & Risk Factors"
• List 2–5 complications, comorbidities, or deficiency patterns that are particularly prevalent or relevant in the Indian population context.
• Consider: nutritional deficiencies common in India, environmental factors, socioeconomic triggers, regional prevalence patterns, monsoon/seasonal effects, sanitation-related compounding factors.
• Format: "Condition/Factor: Clinical description relevant to India."
• Example pattern:
  - "Anemia (Iron Deficiency): Pale skin, dizziness, and fatigue."
  - "Vitamin A Deficiency: Night blindness or increased sensitivity to light."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COLUMN E — "Confirmation Tests"
• This is the MOST DETAILED column. List 15–30 entries covering the full diagnostic pathway.
• Organize entries into logical sub-groups using SECTION HEADERS as standalone rows. Section headers should be formatted as numbered headings, e.g.:
  - "1. Primary Physical/Clinical Assessments"
  - "2. Routine Blood/Lab Tests"
  - "3. Specific Diagnostic Tests"
  - "4. Advanced/Specialized Diagnostics (If Needed)"
  - "5. Key Diagnostic Criteria (Indian & WHO Guidelines)"
• Under each section header, list individual tests with clinical context:
  - "Test Name: What it measures/detects and what thresholds or results indicate disease. Include India/WHO guideline thresholds where applicable."
• End with a summary row citing official Indian (ICMR/NHM) and WHO classification criteria for the disease.
• Example pattern:
  - "1. Primary Anthropometric Measurements (Physical Measurements)"
  - "Mid-Upper Arm Circumference (MUAC): A critical screening tool in India for children (6–59 months) and adults to measure muscle wasting. A MUAC < 115 mm in children indicates severe acute malnutrition (SAM)."
  - "Complete Blood Count (CBC): To check for anemia (low hemoglobin), which is common in malnutrition."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COLUMN F — "Generic Medicines"
• List 10–20 entries covering the standard allopathic/modern medicine treatment protocol.
• Organize into logical sub-groups with SECTION HEADERS as standalone rows:
  - "1. [Primary Treatment Category]" (e.g., Therapeutic Foods, First-line Drugs, etc.)
  - "2. Routine Medications for {{DISEASE_NAME}} (Generic)"
  - "3. [Supportive/Adjunct Treatment Category]" (e.g., Appetite Stimulants, Pain Management, Supportive Care)
  - "4. [Hospital-Based/Severe Case Treatments]"
• For each medicine entry include:
  - Generic drug name, route of administration, typical dosage/usage context, and the clinical purpose.
• Include any India-specific government program medicines (e.g., NHM-supplied drugs, ASHA kit medicines).
• Include Indian brand names where they are widely recognized in rural healthcare settings.
• Example pattern:
  - "Amoxicillin: Oral, used as a broad-spectrum antibiotic for children with uncomplicated SAM, typically 40 mg/kg twice daily."
  - "F-75: Therapeutic milk diet (75 kcal/100 ml) for the stabilization phase."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COLUMN G — "Jan Aushadhi Medicines"
• List 5–15 entries of medicines/supplements available through the Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP) / Jan Aushadhi Kendras that are relevant to this disease.
• For each entry include:
  - Product name, brief description of its clinical relevance to the disease, available pack sizes/variants.
• After listing products, include a PRICE SUB-SECTION with rows formatted as:
  - "Product Name (Pack Size): ₹Price"
• These are affordable, government-subsidized generic medicines — highlight this angle.
• If specific Jan Aushadhi products are not directly available for the disease, list the closest relevant generics available in Jan Aushadhi stores (e.g., Paracetamol, Iron + Folic Acid, Multivitamins, ORS sachets, etc.) and note their relevance.
• Example pattern:
  - "Jan Aushadhi Protein Powder: Available in various flavors (Chocolate, Vanilla, Kesar Pista) in 250g tins, designed to provide high protein, vitamins, and minerals."
  - "Protein Powder (All variants, 250g): ₹200"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COLUMN H — "Ayurvedic Medicines"
• List 10–18 entries covering Ayurvedic / traditional Indian medicine treatments for this disease.
• Include a MIX of:
  - Classical Ayurvedic formulations (e.g., Churna, Avaleha, Ghrita, Kashaya, Mandura, etc.) with their therapeutic action.
  - Branded Ayurvedic products from well-known Indian manufacturers (e.g., Himalaya, Kerala Ayurveda, Dabur, Baidyanath, Sitaram Ayurveda, Kottakkal Arya Vaidya Sala, Sandu, Proyurveda, etc.) with their specific use case.
  - Traditional Ayurvedic practices relevant to the disease (e.g., Abhyanga/massage with specific oils, Ksheerapaka/medicated milk preparations, Panchakarma therapies if applicable).
• Format: "Medicine/Practice Name: 1-sentence description of therapeutic use for this disease."
• Example pattern:
  - "Ashwagandhadi Avaleha/Churna: Widely used to increase weight, BMI, and muscle mass."
  - "Abhyanga (Massage): The use of oils like Chandana bala lakshadi taila or Bala ashwagandhadi taila is recommended to improve circulation and strength."
  - "Himalaya Bonnisan Syrup: Aids in healthy growth and appetite in children."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COLUMN I — "Important Considerations"
• List 2–5 critical safety/usage notes that a rural healthcare worker MUST know.
• Cover:
  - Consultation requirements (when to refer to a qualified practitioner).
  - Holistic approach notes (diet + lifestyle + medicine synergy).
  - Warnings about self-medication risks.
  - When Ayurvedic/traditional treatment is NOT sufficient and modern medical intervention is mandatory.
  - Any drug interaction warnings between allopathic and Ayurvedic medicines listed.
• Format: "Consideration Title: 1–2 sentence guidance."
• Example pattern:
  - "Consultation Required: These medicines should be taken under the guidance of a qualified Ayurvedic practitioner to ensure correct dosage based on the child or adult's specific condition."
  - "Nutritional Rehab: These therapies work best alongside standard nutritional rehabilitation, particularly for severe, acute malnutrition."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL RULES:
1. ACCURACY FIRST: Every medicine name, dosage, test name, and diagnostic threshold must be verifiable against trusted Indian/WHO medical sources. Do NOT hallucinate drug names or dosages.
2. INDIA CONTEXT: All data must be relevant to Indian rural healthcare settings. Prioritize medicines available in India, tests feasible at PHC/CHC level, and government scheme products.
3. COLUMN INDEPENDENCE: Each column is a standalone vertical list. Rows across columns do NOT correspond to each other.
4. SECTION HEADERS: In Columns E, F, and G, use numbered section headers as standalone rows to organize sub-groups logically (e.g., "1. Primary Tests", "2. Blood Tests"). These section headers occupy their own row in that column.
5. CLINICAL LANGUAGE: Use clear, professional medical language but keep descriptions accessible to trained ASHA/ANM/rural health workers, not just specialist doctors.
6. JAN AUSHADHI PRICES: Include actual PMBJP MRP prices where available. These change periodically — use the most recent known prices.
7. NO EMPTY PADDING: Do not add blank rows to align columns. Each column ends when its content ends.
8. COMPLETENESS: Aim for comprehensive coverage. The dataset is used to train an AI model — more detail is better than less, as long as accuracy is maintained.
```

---

## USAGE INSTRUCTIONS

1. **Replace `{{DISEASE_NAME}}`** with the target disease (e.g., `Tuberculosis`, `Dengue Fever`, `Type 2 Diabetes`, `Pneumonia`, `Diarrhea`, `Malaria`, `Hypertension`, etc.).
2. **Feed the prompt** to Claude, GPT-4, or any capable LLM with web search access for real-time price/drug verification.
3. **Request output format** as either:
   - Direct `.xlsx` file generation (if the LLM supports file creation), OR
   - Structured JSON/CSV that can be programmatically converted to `.xlsx`.
4. **Validate** the output against CDSCO drug database, BPPI Jan Aushadhi product catalog, and WHO/ICMR clinical guidelines before adding to the DhanwantariAI training dataset.

---

## EXAMPLE DISEASE LIST (Priority for DhanwantariAI)

Use this prompt iteratively for each of these high-priority diseases in rural India:

| # | Disease | Category |
|---|---------|----------|
| 1 | Malnutrition | Nutritional |
| 2 | Tuberculosis (TB) | Infectious |
| 3 | Malaria | Vector-borne |
| 4 | Dengue Fever | Vector-borne |
| 5 | Typhoid | Infectious |
| 6 | Pneumonia | Respiratory |
| 7 | Diarrheal Diseases | GI / Waterborne |
| 8 | Anemia | Nutritional / Hematological |
| 9 | Type 2 Diabetes | Metabolic |
| 10 | Hypertension | Cardiovascular |
| 11 | Cholera | Waterborne |
| 12 | Hepatitis A/B/E | Infectious / Liver |
| 13 | Leptospirosis | Zoonotic |
| 14 | Japanese Encephalitis | Vector-borne |
| 15 | Chikungunya | Vector-borne |
| 16 | Measles | Vaccine-preventable |
| 17 | Acute Respiratory Infections (ARI) | Respiratory |
| 18 | Scabies / Skin Infections | Dermatological |
| 19 | Snakebite Envenomation | Emergency |
| 20 | Maternal Hemorrhage | Obstetric Emergency |

---

## NOTES

- This prompt is designed for the **DhanwantariAI** project by **AppScale LLP**.
- The generated spreadsheets feed into a Llama 3.2 1B model fine-tuning pipeline for offline clinical decision support.
- Each spreadsheet becomes one "disease module" in the training dataset.
- The Jan Aushadhi column is critical for cost-effective treatment recommendations in rural settings.
- The Ayurvedic column supports the hybrid traditional + modern medicine approach that is standard practice in Indian rural healthcare.
