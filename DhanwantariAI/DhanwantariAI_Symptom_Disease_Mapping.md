# DhanwantariAI — Symptom → Disease Mapping

**Generated:** 2026-03-06 | **Diseases:** 145 | **Total Mappings:** 1108

---

## 1. Master Symptom Categories (171 symptoms across 10 categories)

### General (20)
Fatigue, Tiredness, Unexplained Weight Loss, Unexplained Weight Gain, Fever, Night Sweats, Loss of Appetite, Chills, Malaise, Weakness, Lethargy, Poor Growth, Pallor, Jaundice, Swelling, Edema, Dehydration, Anemia, Wasting, Stunting

### Head & Neurological (20)
Headache, Dizziness, Confusion, Memory Loss, Seizures, Tremors, Paralysis, Numbness, Tingling, Fainting, Blurred Vision, Double Vision, Eye Pain, Hearing Loss, Tinnitus, Loss of Consciousness, Neck Stiffness, Photophobia, Anosmia, Facial Pain

### Respiratory (18)
Cough, Persistent Cough, Dry Cough, Productive Cough, Blood in Sputum, Hemoptysis, Shortness of Breath, Wheezing, Chest Pain, Chest Tightness, Rapid Breathing, Difficulty Breathing, Sore Throat, Hoarseness, Nasal Congestion, Runny Nose, Sneezing, Sleep Apnea

### Gastrointestinal (20)
Nausea, Vomiting, Diarrhea, Bloody Diarrhea, Constipation, Abdominal Pain, Stomach Cramps, Bloating, Flatulence, Heartburn, Acid Reflux, Blood in Stool, Black Stool, Difficulty Swallowing, Loss of Appetite, Rectal Pain, Rectal Bleeding, Mouth Ulcers, Liver Enlargement, Spleen Enlargement

### Cardiovascular (12)
Chest Pain, Palpitations, Irregular Heartbeat, High Blood Pressure, Low Blood Pressure, Rapid Heart Rate, Slow Heart Rate, Swollen Legs, Cold Hands and Feet, Claudication, Syncope, Heart Murmur

### Musculoskeletal (16)
Joint Pain, Muscle Pain, Back Pain, Bone Pain, Muscle Weakness, Joint Swelling, Morning Stiffness, Muscle Cramps, Joint Redness, Limited Range of Motion, Neck Pain, Shoulder Pain, Hip Pain, Knee Pain, Foot Pain, Spinal Pain

### Skin & Hair (19)
Skin Rash, Itching, Hives, Dry Skin, Oily Skin, Acne, Skin Discoloration, Pale Skin, Yellow Skin, Bruising, Hair Loss, Brittle Nails, Nail Changes, Skin Lesions, Wounds Not Healing, Petechiae, Purpura, Vesicles, Scaling

### Urinary & Reproductive (17)
Frequent Urination, Painful Urination, Blood in Urine, Dark Urine, Reduced Urine Output, Urinary Incontinence, Kidney Pain, Genital Discharge, Genital Pain, Genital Sores, Menstrual Irregularity, Heavy Periods, Pelvic Pain, Erectile Dysfunction, Infertility, Testicular Pain, Vaginal Dryness

### Mental Health (19)
Depression, Anxiety, Panic Attacks, Mood Swings, Irritability, Hallucinations, Delusions, Paranoia, Insomnia, Hypersomnia, Poor Concentration, Social Withdrawal, Suicidal Thoughts, Compulsive Behavior, Flashbacks, Emotional Numbness, Hypervigilance, Low Self-Esteem, Mania

### Endocrine & Metabolic (12)
Excessive Thirst, Excessive Hunger, Increased Appetite, Heat Intolerance, Cold Intolerance, Excessive Sweating, Goiter, Bulging Eyes, Dry Eyes, Dry Mouth, Blood Sugar Fluctuations, Weight Fluctuations

---

## 2. Gender Filter Rules

When a user profile has **gender = Male**, exclude `female` tagged diseases from results.
When **gender = Female**, exclude `male` tagged diseases.

| Tag | Count | Examples |
|-----|-------|---------|
| `male` | 8 | Erectile Dysfunction, Premature Ejaculation, Delayed Ejaculation, Male Hypogonadism, Peyronies Disease, Priapism, Retrograde Ejaculation, Post-Orgasmic Illness Syndrome |
| `female` | 7 | Vulvovaginal Candidiasis, Female Sexual Interest Arousal, Hypoactive Sexual Desire Disord, Female Orgasmic Disorder, Vaginismus, Vulvodynia, Genito-Pelvic Pain Penetration |
| `both` (default) | 130 | All other diseases |

---

## 3. Disease → Symptom Mapping

### Dataset V1: Core Rural Health (Malnutrition, TB, Dengue, Diabetes, Typhoid, UTI, Pneumonia, Hypertension, Asthma, Malaria, Anaemia, Chikungunya)

#### Anaemia  _12 symptoms_
**Symptoms:** Brittle Nails, Dizziness, Edema, Fatigue, Irritability, Loss of Appetite, Pallor, Poor Concentration, Shortness of Breath, Swelling, Tiredness, Weakness

- **Skin & Hair:** Brittle Nails
- **Head & Neurological:** Dizziness
- **General:** Edema, Fatigue, Loss of Appetite, Pallor, Swelling, Tiredness, Weakness
- **Mental Health:** Irritability, Poor Concentration
- **Gastrointestinal:** Loss of Appetite
- **Respiratory:** Shortness of Breath

#### Asthma  _9 symptoms_
**Symptoms:** Anxiety, Chest Tightness, Confusion, Cough, Fatigue, Productive Cough, Rapid Breathing, Tiredness, Wheezing

- **Mental Health:** Anxiety
- **Respiratory:** Chest Tightness, Cough, Productive Cough, Rapid Breathing, Wheezing
- **Head & Neurological:** Confusion
- **General:** Fatigue, Tiredness

#### Chikungunya  _11 symptoms_
**Symptoms:** Eye Pain, Fatigue, Fever, Irritability, Joint Pain, Joint Swelling, Loss of Appetite, Muscle Pain, Skin Rash, Swelling, Weakness

- **Head & Neurological:** Eye Pain
- **General:** Fatigue, Fever, Loss of Appetite, Swelling, Weakness
- **Mental Health:** Irritability
- **Musculoskeletal:** Joint Pain, Joint Swelling, Muscle Pain
- **Gastrointestinal:** Loss of Appetite
- **Skin & Hair:** Skin Rash

#### Common Cold & Flu  _13 symptoms_
**Symptoms:** Cough, Edema, Fatigue, Fever, Headache, Irritability, Malaise, Muscle Pain, Nasal Congestion, Persistent Cough, Runny Nose, Sneezing, Sore Throat

- **Respiratory:** Cough, Nasal Congestion, Persistent Cough, Runny Nose, Sneezing, Sore Throat
- **General:** Edema, Fatigue, Fever, Malaise
- **Head & Neurological:** Headache
- **Mental Health:** Irritability
- **Musculoskeletal:** Muscle Pain

#### Dengue Fever  _21 symptoms_
**Symptoms:** Abdominal Pain, Bruising, Dehydration, Edema, Fatigue, Fever, Headache, Insomnia, Irritability, Itching, Joint Pain, Lethargy, Loss of Appetite, Malaise, Muscle Pain, Nausea, Petechiae, Skin Rash, Sore Throat, Vomiting, Weakness

- **Gastrointestinal:** Abdominal Pain, Loss of Appetite, Nausea, Vomiting
- **Skin & Hair:** Bruising, Itching, Petechiae, Skin Rash
- **General:** Dehydration, Edema, Fatigue, Fever, Lethargy, Loss of Appetite, Malaise, Weakness
- **Head & Neurological:** Headache
- **Mental Health:** Insomnia, Irritability
- **Musculoskeletal:** Joint Pain, Muscle Pain
- **Respiratory:** Sore Throat

#### Diabetes (Type 1 & 2)  _26 symptoms_
**Symptoms:** Abdominal Pain, Anxiety, Blood Sugar Fluctuations, Blurred Vision, Confusion, Dehydration, Depression, Erectile Dysfunction, Excessive Thirst, Fatigue, Frequent Urination, Irritability, Loss of Appetite, Nausea, Numbness, Palpitations, Poor Concentration, Rapid Breathing, Swelling, Tingling, Tiredness, Tremors, Unexplained Weight Loss, Vaginal Dryness, Vomiting, Weakness

- **Gastrointestinal:** Abdominal Pain, Loss of Appetite, Nausea, Vomiting
- **Mental Health:** Anxiety, Depression, Irritability, Poor Concentration
- **Endocrine & Metabolic:** Blood Sugar Fluctuations, Excessive Thirst
- **Head & Neurological:** Blurred Vision, Confusion, Numbness, Tingling, Tremors
- **General:** Dehydration, Fatigue, Loss of Appetite, Swelling, Tiredness, Unexplained Weight Loss, Weakness
- **Urinary & Reproductive:** Erectile Dysfunction, Frequent Urination, Vaginal Dryness
- **Cardiovascular:** Palpitations
- **Respiratory:** Rapid Breathing

#### Hypertension  _16 symptoms_
**Symptoms:** Anxiety, Blurred Vision, Chest Pain, Confusion, Edema, Erectile Dysfunction, Fatigue, Headache, Nausea, Palpitations, Poor Concentration, Seizures, Sleep Apnea, Swelling, Tiredness, Vomiting

- **Mental Health:** Anxiety, Poor Concentration
- **Head & Neurological:** Blurred Vision, Confusion, Headache, Seizures
- **Respiratory:** Chest Pain, Sleep Apnea
- **Cardiovascular:** Chest Pain, Palpitations
- **General:** Edema, Fatigue, Swelling, Tiredness
- **Urinary & Reproductive:** Erectile Dysfunction
- **Gastrointestinal:** Nausea, Vomiting

#### Malaria  _15 symptoms_
**Symptoms:** Anemia, Chills, Confusion, Fatigue, Fever, Headache, Irritability, Joint Pain, Loss of Appetite, Nausea, Pale Skin, Rapid Breathing, Tiredness, Vomiting, Weakness

- **General:** Anemia, Chills, Fatigue, Fever, Loss of Appetite, Tiredness, Weakness
- **Head & Neurological:** Confusion, Headache
- **Mental Health:** Irritability
- **Musculoskeletal:** Joint Pain
- **Gastrointestinal:** Loss of Appetite, Nausea, Vomiting
- **Skin & Hair:** Pale Skin
- **Respiratory:** Rapid Breathing

#### Malnutrition  _9 symptoms_
**Symptoms:** Diarrhea, Edema, Fatigue, Irritability, Lethargy, Stunting, Swelling, Wasting, Weakness

- **Gastrointestinal:** Diarrhea
- **General:** Edema, Fatigue, Lethargy, Stunting, Swelling, Wasting, Weakness
- **Mental Health:** Irritability

#### Neonatal Fever  _8 symptoms_
**Symptoms:** Fever, Irritability, Jaundice, Lethargy, Pallor, Petechiae, Seizures, Vomiting

- **General:** Fever, Jaundice, Lethargy, Pallor
- **Mental Health:** Irritability
- **Skin & Hair:** Petechiae
- **Head & Neurological:** Seizures
- **Gastrointestinal:** Vomiting

#### Pneumonia  _12 symptoms_
**Symptoms:** Chest Pain, Chills, Confusion, Cough, Dehydration, Fatigue, Fever, Headache, Persistent Cough, Productive Cough, Rapid Breathing, Weakness

- **Respiratory:** Chest Pain, Cough, Persistent Cough, Productive Cough, Rapid Breathing
- **Cardiovascular:** Chest Pain
- **General:** Chills, Dehydration, Fatigue, Fever, Weakness
- **Head & Neurological:** Confusion, Headache

#### Severe Dehydration  _9 symptoms_
**Symptoms:** Confusion, Dehydration, Dizziness, Dry Mouth, Irritability, Lethargy, Low Blood Pressure, Muscle Cramps, Rapid Heart Rate

- **Head & Neurological:** Confusion, Dizziness
- **General:** Dehydration, Lethargy
- **Endocrine & Metabolic:** Dry Mouth
- **Mental Health:** Irritability
- **Cardiovascular:** Low Blood Pressure, Rapid Heart Rate
- **Musculoskeletal:** Muscle Cramps

#### Tuberculosis  _19 symptoms_
**Symptoms:** Anemia, Chest Pain, Cough, Depression, Fatigue, Fever, Hemoptysis, Irritability, Loss of Appetite, Night Sweats, Pale Skin, Pallor, Persistent Cough, Shortness of Breath, Swelling, Tiredness, Unexplained Weight Loss, Wasting, Weakness

- **General:** Anemia, Fatigue, Fever, Loss of Appetite, Night Sweats, Pallor, Swelling, Tiredness, Unexplained Weight Loss, Wasting, Weakness
- **Respiratory:** Chest Pain, Cough, Hemoptysis, Persistent Cough, Shortness of Breath
- **Cardiovascular:** Chest Pain
- **Mental Health:** Depression, Irritability
- **Gastrointestinal:** Loss of Appetite
- **Skin & Hair:** Pale Skin

#### Typhoid Fever  _10 symptoms_
**Symptoms:** Abdominal Pain, Confusion, Constipation, Diarrhea, Fever, Headache, Loss of Appetite, Malaise, Nausea, Weakness

- **Gastrointestinal:** Abdominal Pain, Constipation, Diarrhea, Loss of Appetite, Nausea
- **Head & Neurological:** Confusion, Headache
- **General:** Fever, Loss of Appetite, Malaise, Weakness

#### Urinary Tract Infection  _13 symptoms_
**Symptoms:** Abdominal Pain, Anxiety, Blood in Urine, Chills, Confusion, Dehydration, Fatigue, Fever, Malaise, Nausea, Painful Urination, Tiredness, Vomiting

- **Gastrointestinal:** Abdominal Pain, Nausea, Vomiting
- **Mental Health:** Anxiety
- **Urinary & Reproductive:** Blood in Urine, Painful Urination
- **General:** Chills, Dehydration, Fatigue, Fever, Malaise, Tiredness
- **Head & Neurological:** Confusion

### Dataset V2: Infectious & Chronic (Cholera, Hepatitis, Epilepsy, Heart Failure, Kidney Disease, Filariasis, etc.)

#### Allergic Rhinitis  _9 symptoms_
**Symptoms:** Anosmia, Cough, Edema, Fatigue, Hoarseness, Irritability, Itching, Nasal Congestion, Sneezing

- **Head & Neurological:** Anosmia
- **Respiratory:** Cough, Hoarseness, Nasal Congestion, Sneezing
- **General:** Edema, Fatigue
- **Mental Health:** Irritability
- **Skin & Hair:** Itching

#### Chickenpox  _9 symptoms_
**Symptoms:** Confusion, Cough, Fever, Irritability, Itching, Malaise, Seizures, Tiredness, Vesicles

- **Head & Neurological:** Confusion, Seizures
- **Respiratory:** Cough
- **General:** Fever, Malaise, Tiredness
- **Mental Health:** Irritability
- **Skin & Hair:** Itching, Vesicles

#### Cholera  _10 symptoms_
**Symptoms:** Abdominal Pain, Anxiety, Confusion, Dehydration, Diarrhea, Dry Mouth, Fever, Lethargy, Muscle Cramps, Vomiting

- **Gastrointestinal:** Abdominal Pain, Diarrhea, Vomiting
- **Mental Health:** Anxiety
- **Head & Neurological:** Confusion
- **General:** Dehydration, Fever, Lethargy
- **Endocrine & Metabolic:** Dry Mouth
- **Musculoskeletal:** Muscle Cramps

#### Copd  _9 symptoms_
**Symptoms:** Anxiety, Cough, Depression, Edema, Poor Concentration, Productive Cough, Swelling, Wasting, Wheezing

- **Mental Health:** Anxiety, Depression, Poor Concentration
- **Respiratory:** Cough, Productive Cough, Wheezing
- **General:** Edema, Swelling, Wasting

#### Diarrhea  _14 symptoms_
**Symptoms:** Abdominal Pain, Anxiety, Bloody Diarrhea, Dehydration, Diarrhea, Dizziness, Dry Mouth, Fever, Irritability, Lethargy, Nausea, Reduced Urine Output, Vomiting, Weakness

- **Gastrointestinal:** Abdominal Pain, Bloody Diarrhea, Diarrhea, Nausea, Vomiting
- **Mental Health:** Anxiety, Irritability
- **General:** Dehydration, Fever, Lethargy, Weakness
- **Head & Neurological:** Dizziness
- **Endocrine & Metabolic:** Dry Mouth
- **Urinary & Reproductive:** Reduced Urine Output

#### Epilepsy  _10 symptoms_
**Symptoms:** Anxiety, Confusion, Depression, Headache, Itching, Loss of Consciousness, Paralysis, Seizures, Tingling, Weakness

- **Mental Health:** Anxiety, Depression
- **Head & Neurological:** Confusion, Headache, Loss of Consciousness, Paralysis, Seizures, Tingling
- **Skin & Hair:** Itching
- **General:** Weakness

#### Filariasis  _6 symptoms_
**Symptoms:** Cough, Depression, Edema, Fever, Swelling, Wheezing

- **Respiratory:** Cough, Wheezing
- **Mental Health:** Depression
- **General:** Edema, Fever, Swelling

#### Giardiasis  _10 symptoms_
**Symptoms:** Abdominal Pain, Bloating, Diarrhea, Fatigue, Flatulence, Irritability, Malaise, Nausea, Tiredness, Weakness

- **Gastrointestinal:** Abdominal Pain, Bloating, Diarrhea, Flatulence, Nausea
- **General:** Fatigue, Malaise, Tiredness, Weakness
- **Mental Health:** Irritability

#### Heart Failure  _12 symptoms_
**Symptoms:** Anxiety, Confusion, Cough, Depression, Dry Cough, Edema, Fatigue, Jaundice, Persistent Cough, Poor Concentration, Swelling, Wasting

- **Mental Health:** Anxiety, Depression, Poor Concentration
- **Head & Neurological:** Confusion
- **Respiratory:** Cough, Dry Cough, Persistent Cough
- **General:** Edema, Fatigue, Jaundice, Swelling, Wasting

#### Hepatitis  _15 symptoms_
**Symptoms:** Confusion, Depression, Edema, Fatigue, Fever, Irritability, Jaundice, Joint Pain, Loss of Appetite, Malaise, Nausea, Swelling, Tiredness, Vomiting, Weakness

- **Head & Neurological:** Confusion
- **Mental Health:** Depression, Irritability
- **General:** Edema, Fatigue, Fever, Jaundice, Loss of Appetite, Malaise, Swelling, Tiredness, Weakness
- **Musculoskeletal:** Joint Pain
- **Gastrointestinal:** Loss of Appetite, Nausea, Vomiting

#### Hookworm Infection  _10 symptoms_
**Symptoms:** Abdominal Pain, Anemia, Blood in Stool, Constipation, Diarrhea, Edema, Fatigue, Nausea, Pallor, Tiredness

- **Gastrointestinal:** Abdominal Pain, Blood in Stool, Constipation, Diarrhea, Nausea
- **General:** Anemia, Edema, Fatigue, Pallor, Tiredness

#### Japanese Encephalitis  _9 symptoms_
**Symptoms:** Confusion, Fever, Headache, Irritability, Malaise, Paralysis, Seizures, Tremors, Weakness

- **Head & Neurological:** Confusion, Headache, Paralysis, Seizures, Tremors
- **General:** Fever, Malaise, Weakness
- **Mental Health:** Irritability

#### Jaundice  _9 symptoms_
**Symptoms:** Abdominal Pain, Anxiety, Dark Urine, Fatigue, Itching, Jaundice, Nausea, Weakness, Yellow Skin

- **Gastrointestinal:** Abdominal Pain, Nausea
- **Mental Health:** Anxiety
- **Urinary & Reproductive:** Dark Urine
- **General:** Fatigue, Jaundice, Weakness
- **Skin & Hair:** Itching, Yellow Skin

#### Kala-Azar  _7 symptoms_
**Symptoms:** Anemia, Bruising, Fatigue, Fever, Liver Enlargement, Wasting, Weakness

- **General:** Anemia, Fatigue, Fever, Wasting, Weakness
- **Skin & Hair:** Bruising
- **Gastrointestinal:** Liver Enlargement

#### Kidney Disease  _15 symptoms_
**Symptoms:** Anemia, Anxiety, Blood in Urine, Bone Pain, Confusion, Depression, Edema, Fatigue, Muscle Weakness, Nausea, Poor Concentration, Sleep Apnea, Tiredness, Vomiting, Weakness

- **General:** Anemia, Edema, Fatigue, Tiredness, Weakness
- **Mental Health:** Anxiety, Depression, Poor Concentration
- **Urinary & Reproductive:** Blood in Urine
- **Musculoskeletal:** Bone Pain, Muscle Weakness
- **Head & Neurological:** Confusion
- **Gastrointestinal:** Nausea, Vomiting
- **Respiratory:** Sleep Apnea

### Dataset V3: Tropical & Environmental (Leprosy, Snakebite, Rabies, Tetanus, Goiter, Rickets, Heat Stroke, etc.)

#### Ascariasis  _9 symptoms_
**Symptoms:** Abdominal Pain, Bloating, Cough, Fever, Irritability, Jaundice, Stunting, Vomiting, Wheezing

- **Gastrointestinal:** Abdominal Pain, Bloating, Vomiting
- **Respiratory:** Cough, Wheezing
- **General:** Fever, Jaundice, Stunting
- **Mental Health:** Irritability

#### Conjunctivitis  _6 symptoms_
**Symptoms:** Anxiety, Edema, Irritability, Itching, Photophobia, Swelling

- **Mental Health:** Anxiety, Irritability
- **General:** Edema, Swelling
- **Skin & Hair:** Itching
- **Head & Neurological:** Photophobia

#### Dental Caries & Oral Health  _3 symptoms_
**Symptoms:** Fever, Low Self-Esteem, Swelling

- **General:** Fever, Swelling
- **Mental Health:** Low Self-Esteem

#### Goiter & Iodine Deficiency  _13 symptoms_
**Symptoms:** Cold Intolerance, Constipation, Depression, Difficulty Breathing, Difficulty Swallowing, Dry Skin, Edema, Fatigue, Goiter, Hoarseness, Infertility, Lethargy, Swelling

- **Endocrine & Metabolic:** Cold Intolerance, Goiter
- **Gastrointestinal:** Constipation, Difficulty Swallowing
- **Mental Health:** Depression
- **Respiratory:** Difficulty Breathing, Hoarseness
- **Skin & Hair:** Dry Skin
- **General:** Edema, Fatigue, Lethargy, Swelling
- **Urinary & Reproductive:** Infertility

#### Heat Stroke  _12 symptoms_
**Symptoms:** Confusion, Dark Urine, Dehydration, Dizziness, Dry Skin, Headache, Muscle Cramps, Nausea, Rapid Heart Rate, Seizures, Vomiting, Weakness

- **Head & Neurological:** Confusion, Dizziness, Headache, Seizures
- **Urinary & Reproductive:** Dark Urine
- **General:** Dehydration, Weakness
- **Skin & Hair:** Dry Skin
- **Musculoskeletal:** Muscle Cramps
- **Gastrointestinal:** Nausea, Vomiting
- **Cardiovascular:** Rapid Heart Rate

#### Leprosy  _7 symptoms_
**Symptoms:** Depression, Fever, Joint Pain, Muscle Weakness, Numbness, Skin Lesions, Weakness

- **Mental Health:** Depression
- **General:** Fever, Weakness
- **Musculoskeletal:** Joint Pain, Muscle Weakness
- **Head & Neurological:** Numbness
- **Skin & Hair:** Skin Lesions

#### Leptospirosis  _17 symptoms_
**Symptoms:** Abdominal Pain, Chills, Confusion, Fatigue, Fever, Headache, Hemoptysis, Itching, Jaundice, Muscle Pain, Nausea, Neck Stiffness, Petechiae, Photophobia, Vomiting, Weakness, Yellow Skin

- **Gastrointestinal:** Abdominal Pain, Nausea, Vomiting
- **General:** Chills, Fatigue, Fever, Jaundice, Weakness
- **Head & Neurological:** Confusion, Headache, Neck Stiffness, Photophobia
- **Respiratory:** Hemoptysis
- **Skin & Hair:** Itching, Petechiae, Yellow Skin
- **Musculoskeletal:** Muscle Pain

#### Measles  _10 symptoms_
**Symptoms:** Cough, Dehydration, Diarrhea, Edema, Fever, Irritability, Persistent Cough, Photophobia, Runny Nose, Seizures

- **Respiratory:** Cough, Persistent Cough, Runny Nose
- **General:** Dehydration, Edema, Fever
- **Gastrointestinal:** Diarrhea
- **Mental Health:** Irritability
- **Head & Neurological:** Photophobia, Seizures

#### Rabies  _9 symptoms_
**Symptoms:** Anxiety, Confusion, Fever, Hallucinations, Headache, Insomnia, Itching, Paralysis, Tingling

- **Mental Health:** Anxiety, Hallucinations, Insomnia
- **Head & Neurological:** Confusion, Headache, Paralysis, Tingling
- **General:** Fever
- **Skin & Hair:** Itching

#### Rheumatic Fever  _6 symptoms_
**Symptoms:** Anxiety, Fatigue, Fever, Joint Pain, Muscle Weakness, Weakness

- **Mental Health:** Anxiety
- **General:** Fatigue, Fever, Weakness
- **Musculoskeletal:** Joint Pain, Muscle Weakness

#### Rickets & Vitamin D Deficiency  _7 symptoms_
**Symptoms:** Back Pain, Bone Pain, Irritability, Muscle Weakness, Poor Growth, Swelling, Weakness

- **Musculoskeletal:** Back Pain, Bone Pain, Muscle Weakness
- **Mental Health:** Irritability
- **General:** Poor Growth, Swelling, Weakness

#### Ringworm  _4 symptoms_
**Symptoms:** Fatigue, Hair Loss, Itching, Scaling

- **General:** Fatigue
- **Skin & Hair:** Hair Loss, Itching, Scaling

#### Scabies  _5 symptoms_
**Symptoms:** Anxiety, Fatigue, Irritability, Itching, Vesicles

- **Mental Health:** Anxiety, Irritability
- **General:** Fatigue
- **Skin & Hair:** Itching, Vesicles

#### Snakebite Envenomation  _5 symptoms_
**Symptoms:** Difficulty Breathing, Difficulty Swallowing, Paralysis, Swelling, Weakness

- **Respiratory:** Difficulty Breathing
- **Gastrointestinal:** Difficulty Swallowing
- **Head & Neurological:** Paralysis
- **General:** Swelling, Weakness

#### Tetanus  _6 symptoms_
**Symptoms:** Anxiety, Back Pain, Difficulty Swallowing, Fever, Muscle Cramps, Neck Stiffness

- **Mental Health:** Anxiety
- **General:** Fever
- **Musculoskeletal:** Muscle Cramps, Back Pain
- **Gastrointestinal:** Difficulty Swallowing
- **Head & Neurological:** Neck Stiffness

### Dataset V4: Acute & Emergency (Scrub Typhus, Pertussis, Burns, Poisoning, Preeclampsia, Sickle Cell, Migraine, etc.)

#### Acute Otitis Media  _3 symptoms_
**Symptoms:** Fever, Hearing Loss, Irritability

- **General:** Fever
- **Head & Neurological:** Hearing Loss
- **Mental Health:** Irritability

#### Burns  _6 symptoms_
**Symptoms:** Anxiety, Confusion, Depression, Dry Skin, Edema, Itching

- **Mental Health:** Anxiety, Depression
- **Head & Neurological:** Confusion
- **Skin & Hair:** Dry Skin, Itching
- **General:** Edema

#### Diphtheria  _9 symptoms_
**Symptoms:** Cough, Dehydration, Difficulty Swallowing, Edema, Fever, Malaise, Paralysis, Sore Throat, Weakness

- **Respiratory:** Cough, Sore Throat
- **General:** Dehydration, Edema, Fever, Malaise, Weakness
- **Gastrointestinal:** Difficulty Swallowing
- **Head & Neurological:** Paralysis

#### Lower Back Pain  _7 symptoms_
**Symptoms:** Anxiety, Back Pain, Depression, Morning Stiffness, Numbness, Tingling, Weakness

- **Mental Health:** Anxiety, Depression
- **Musculoskeletal:** Back Pain, Morning Stiffness
- **Head & Neurological:** Numbness, Tingling
- **General:** Weakness

#### Migraine & Headache  _10 symptoms_
**Symptoms:** Anxiety, Depression, Headache, Nasal Congestion, Nausea, Numbness, Photophobia, Swelling, Tingling, Vomiting

- **Mental Health:** Anxiety, Depression
- **Head & Neurological:** Headache, Numbness, Photophobia, Tingling
- **Respiratory:** Nasal Congestion
- **Gastrointestinal:** Nausea, Vomiting
- **General:** Swelling

#### Mucormycosis  _4 symptoms_
**Symptoms:** Anxiety, Headache, Nasal Congestion, Swelling

- **Mental Health:** Anxiety
- **Head & Neurological:** Headache
- **Respiratory:** Nasal Congestion
- **General:** Swelling

#### Mumps  _11 symptoms_
**Symptoms:** Anxiety, Fever, Headache, Loss of Appetite, Malaise, Nausea, Neck Stiffness, Photophobia, Swelling, Testicular Pain, Vomiting

- **Mental Health:** Anxiety
- **General:** Fever, Loss of Appetite, Malaise, Swelling
- **Head & Neurological:** Headache, Neck Stiffness, Photophobia
- **Gastrointestinal:** Loss of Appetite, Nausea, Vomiting
- **Urinary & Reproductive:** Testicular Pain

#### Organophosphate Poisoning  _10 symptoms_
**Symptoms:** Anxiety, Confusion, Depression, Diarrhea, Difficulty Breathing, Itching, Muscle Weakness, Paralysis, Seizures, Weakness

- **Mental Health:** Anxiety, Depression
- **Head & Neurological:** Confusion, Paralysis, Seizures
- **Gastrointestinal:** Diarrhea
- **Respiratory:** Difficulty Breathing
- **Skin & Hair:** Itching
- **Musculoskeletal:** Muscle Weakness
- **General:** Weakness

#### Pellagra & B-Vitamin Deficiency  _13 symptoms_
**Symptoms:** Abdominal Pain, Anxiety, Confusion, Depression, Diarrhea, Fatigue, Insomnia, Irritability, Memory Loss, Photophobia, Skin Rash, Wasting, Weakness

- **Gastrointestinal:** Abdominal Pain, Diarrhea
- **Mental Health:** Anxiety, Depression, Insomnia, Irritability
- **Head & Neurological:** Confusion, Memory Loss, Photophobia
- **General:** Fatigue, Wasting, Weakness
- **Skin & Hair:** Skin Rash

#### Peptic Ulcer & Gastritis  _8 symptoms_
**Symptoms:** Abdominal Pain, Acid Reflux, Anxiety, Bloating, Depression, Heartburn, Nausea, Vomiting

- **Gastrointestinal:** Abdominal Pain, Acid Reflux, Bloating, Heartburn, Nausea, Vomiting
- **Mental Health:** Anxiety, Depression

#### Pertussis  _8 symptoms_
**Symptoms:** Anxiety, Cough, Dehydration, Fever, Petechiae, Runny Nose, Sneezing, Vomiting

- **Mental Health:** Anxiety
- **Respiratory:** Cough, Runny Nose, Sneezing
- **General:** Dehydration, Fever
- **Skin & Hair:** Petechiae
- **Gastrointestinal:** Vomiting

#### Preeclampsia & Eclampsia  _7 symptoms_
**Symptoms:** Anxiety, Blurred Vision, Edema, Headache, Heartburn, Seizures, Swelling

- **Mental Health:** Anxiety
- **Head & Neurological:** Blurred Vision, Headache, Seizures
- **General:** Edema, Swelling
- **Gastrointestinal:** Heartburn

#### Scrub Typhus  _9 symptoms_
**Symptoms:** Confusion, Cough, Fatigue, Fever, Headache, Neck Stiffness, Productive Cough, Seizures, Weakness

- **Head & Neurological:** Confusion, Headache, Neck Stiffness, Seizures
- **Respiratory:** Cough, Productive Cough
- **General:** Fatigue, Fever, Weakness

#### Sickle Cell Disease  _14 symptoms_
**Symptoms:** Anemia, Anxiety, Chest Pain, Cough, Dark Urine, Dehydration, Depression, Erectile Dysfunction, Fatigue, Fever, Jaundice, Pallor, Seizures, Swelling

- **General:** Anemia, Dehydration, Fatigue, Fever, Jaundice, Pallor, Swelling
- **Mental Health:** Anxiety, Depression
- **Respiratory:** Chest Pain, Cough
- **Cardiovascular:** Chest Pain
- **Urinary & Reproductive:** Dark Urine, Erectile Dysfunction
- **Head & Neurological:** Seizures

#### Thalassemia  _5 symptoms_
**Symptoms:** Anemia, Anxiety, Depression, Fatigue, Pallor

- **General:** Anemia, Fatigue, Pallor
- **Mental Health:** Anxiety, Depression

### Dataset V5: Dermatology (Psoriasis, Eczema, Vitiligo, Urticaria, Acne, Cellulitis, Alopecia, etc.)

#### Alopecia Areata  _6 symptoms_
**Symptoms:** Anxiety, Depression, Hair Loss, Nail Changes, Scaling, Social Withdrawal

- **Mental Health:** Anxiety, Depression, Social Withdrawal
- **Skin & Hair:** Hair Loss, Nail Changes, Scaling

#### Atopic Dermatitis  _6 symptoms_
**Symptoms:** Anxiety, Depression, Dry Skin, Fatigue, Irritability, Itching

- **Mental Health:** Anxiety, Depression, Irritability
- **Skin & Hair:** Dry Skin, Itching
- **General:** Fatigue

#### Cellulitis  _8 symptoms_
**Symptoms:** Anxiety, Chills, Edema, Fever, Headache, Malaise, Swelling, Vesicles

- **Mental Health:** Anxiety
- **General:** Chills, Edema, Fever, Malaise, Swelling
- **Head & Neurological:** Headache
- **Skin & Hair:** Vesicles

#### Contact Dermatitis  _6 symptoms_
**Symptoms:** Anxiety, Depression, Edema, Itching, Scaling, Vesicles

- **Mental Health:** Anxiety, Depression
- **General:** Edema
- **Skin & Hair:** Itching, Scaling, Vesicles

#### Impetigo  _4 symptoms_
**Symptoms:** Fever, Malaise, Social Withdrawal, Vesicles

- **General:** Fever, Malaise
- **Mental Health:** Social Withdrawal
- **Skin & Hair:** Vesicles

#### Lichen Planus  _3 symptoms_
**Symptoms:** Anxiety, Depression, Hair Loss

- **Mental Health:** Anxiety, Depression
- **Skin & Hair:** Hair Loss

#### Pemphigus Vulgaris  _3 symptoms_
**Symptoms:** Anxiety, Depression, Fever

- **Mental Health:** Anxiety, Depression
- **General:** Fever

#### Pityriasis Versicolor  _3 symptoms_
**Symptoms:** Anxiety, Low Self-Esteem, Scaling

- **Mental Health:** Anxiety, Low Self-Esteem
- **Skin & Hair:** Scaling

#### Pressure Ulcers  _5 symptoms_
**Symptoms:** Fever, Skin Discoloration, Skin Lesions, Swelling, Wounds Not Healing

- **General:** Fever, Swelling
- **Skin & Hair:** Wounds Not Healing, Skin Lesions, Skin Discoloration

#### Psoriasis  _8 symptoms_
**Symptoms:** Anxiety, Depression, Fatigue, Insomnia, Itching, Nail Changes, Scaling, Social Withdrawal

- **Mental Health:** Anxiety, Depression, Insomnia, Social Withdrawal
- **General:** Fatigue
- **Skin & Hair:** Itching, Nail Changes, Scaling

#### Seborrheic Dermatitis  _3 symptoms_
**Symptoms:** Fatigue, Itching, Scaling

- **General:** Fatigue
- **Skin & Hair:** Itching, Scaling

#### Stevens-Johnson Syndrome  _6 symptoms_
**Symptoms:** Fever, Headache, Malaise, Runny Nose, Skin Lesions, Swelling

- **General:** Fever, Malaise, Swelling
- **Head & Neurological:** Headache
- **Respiratory:** Runny Nose
- **Skin & Hair:** Skin Lesions

#### Urticaria  _9 symptoms_
**Symptoms:** Anxiety, Depression, Edema, Fatigue, Hives, Irritability, Itching, Swelling, Vomiting

- **Mental Health:** Anxiety, Depression, Irritability
- **General:** Edema, Fatigue, Swelling
- **Skin & Hair:** Hives, Itching
- **Gastrointestinal:** Vomiting

### Dataset V6: Fungal & Parasitic (Candidiasis, Aspergillosis, Amoebiasis, Toxoplasmosis, Neurocysticercosis, etc.)

#### Amoebiasis  _3 symptoms_
**Symptoms:** Abdominal Pain, Fever, Night Sweats

- **Gastrointestinal:** Abdominal Pain
- **General:** Fever, Night Sweats

#### Cryptococcal Meningitis  _8 symptoms_
**Symptoms:** Confusion, Edema, Fever, Headache, Neck Stiffness, Paralysis, Photophobia, Seizures

- **Head & Neurological:** Confusion, Headache, Neck Stiffness, Paralysis, Photophobia, Seizures
- **General:** Edema, Fever

#### Cryptosporidiosis  _7 symptoms_
**Symptoms:** Abdominal Pain, Cough, Dehydration, Fever, Jaundice, Nausea, Wasting

- **Gastrointestinal:** Abdominal Pain, Nausea
- **Respiratory:** Cough
- **General:** Dehydration, Fever, Jaundice, Wasting

#### Enterobiasis  _4 symptoms_
**Symptoms:** Abdominal Pain, Irritability, Itching, Poor Concentration

- **Gastrointestinal:** Abdominal Pain
- **Mental Health:** Irritability, Poor Concentration
- **Skin & Hair:** Itching

#### Histoplasmosis  _8 symptoms_
**Symptoms:** Chest Pain, Cough, Dry Cough, Fever, Headache, Night Sweats, Productive Cough, Skin Lesions

- **Respiratory:** Chest Pain, Cough, Dry Cough, Productive Cough
- **Cardiovascular:** Chest Pain
- **General:** Fever, Night Sweats
- **Head & Neurological:** Headache
- **Skin & Hair:** Skin Lesions

#### Hydatid Disease  _6 symptoms_
**Symptoms:** Chest Pain, Cough, Dry Cough, Fever, Jaundice, Seizures

- **Respiratory:** Chest Pain, Cough, Dry Cough
- **Cardiovascular:** Chest Pain
- **General:** Fever, Jaundice
- **Head & Neurological:** Seizures

#### Invasive Aspergillosis  _6 symptoms_
**Symptoms:** Anxiety, Chest Pain, Cough, Edema, Facial Pain, Fever

- **Mental Health:** Anxiety
- **Respiratory:** Chest Pain, Cough
- **Cardiovascular:** Chest Pain
- **General:** Edema, Fever
- **Head & Neurological:** Facial Pain

#### Neurocysticercosis  _7 symptoms_
**Symptoms:** Depression, Edema, Headache, Seizures, Social Withdrawal, Vomiting, Weakness

- **Mental Health:** Depression, Social Withdrawal
- **General:** Edema, Weakness
- **Head & Neurological:** Headache, Seizures
- **Gastrointestinal:** Vomiting

#### Onychomycosis  _5 symptoms_
**Symptoms:** Anxiety, Brittle Nails, Foot Pain, Itching, Nail Changes

- **Mental Health:** Anxiety
- **Musculoskeletal:** Foot Pain
- **Skin & Hair:** Nail Changes, Brittle Nails, Itching

#### Oral Candidiasis  _4 symptoms_
**Symptoms:** Difficulty Swallowing, Dry Mouth, Mouth Ulcers, Sore Throat

- **Gastrointestinal:** Difficulty Swallowing, Mouth Ulcers
- **Endocrine & Metabolic:** Dry Mouth
- **Respiratory:** Sore Throat

#### Strongyloidiasis  _5 symptoms_
**Symptoms:** Cough, Itching, Nausea, Vomiting, Wheezing

- **Respiratory:** Cough, Wheezing
- **Skin & Hair:** Itching
- **Gastrointestinal:** Nausea, Vomiting

#### Tinea Capitis  _4 symptoms_
**Symptoms:** Anxiety, Hair Loss, Scaling, Weakness

- **Mental Health:** Anxiety
- **Skin & Hair:** Hair Loss, Scaling
- **General:** Weakness

#### Toxocariasis  _7 symptoms_
**Symptoms:** Abdominal Pain, Cough, Fatigue, Fever, Headache, Skin Rash, Wheezing

- **Gastrointestinal:** Abdominal Pain
- **Respiratory:** Cough, Wheezing
- **General:** Fatigue, Fever
- **Head & Neurological:** Headache
- **Skin & Hair:** Skin Rash

#### Toxoplasmosis  _9 symptoms_
**Symptoms:** Blurred Vision, Confusion, Cough, Fatigue, Fever, Headache, Photophobia, Productive Cough, Seizures

- **Head & Neurological:** Blurred Vision, Confusion, Headache, Photophobia, Seizures
- **Respiratory:** Cough, Productive Cough
- **General:** Fatigue, Fever

#### Vulvovaginal Candidiasis 🔴`female`  _5 symptoms_
**Symptoms:** Anxiety, Depression, Edema, Itching, Swelling

- **Mental Health:** Anxiety, Depression
- **General:** Edema, Swelling
- **Skin & Hair:** Itching

### Dataset V7: Neurological & Psychiatric (Schizophrenia, Bipolar, Depression, GAD, Parkinson's, Alzheimer's, MS, etc.)

#### Alzheimers Disease  _8 symptoms_
**Symptoms:** Anxiety, Confusion, Delusions, Depression, Hallucinations, Irritability, Memory Loss, Seizures

- **Mental Health:** Anxiety, Delusions, Depression, Hallucinations, Irritability
- **Head & Neurological:** Confusion, Memory Loss, Seizures

#### Autism Spectrum Disorder  _6 symptoms_
**Symptoms:** Anxiety, Depression, Insomnia, Irritability, Poor Concentration, Social Withdrawal

- **Mental Health:** Anxiety, Depression, Poor Concentration, Irritability, Insomnia, Social Withdrawal

#### Bipolar Disorder  _7 symptoms_
**Symptoms:** Delusions, Depression, Fatigue, Hallucinations, Hypersomnia, Insomnia, Mania

- **Mental Health:** Delusions, Depression, Hallucinations, Hypersomnia, Insomnia, Mania
- **General:** Fatigue

#### Generalised Anxiety Disorder  _14 symptoms_
**Symptoms:** Anxiety, Dizziness, Dry Mouth, Fatigue, Frequent Urination, Headache, Hypervigilance, Irritability, Nausea, Neck Stiffness, Palpitations, Shortness of Breath, Shoulder Pain, Social Withdrawal

- **Mental Health:** Anxiety, Hypervigilance, Irritability, Social Withdrawal
- **Head & Neurological:** Dizziness, Headache, Neck Stiffness
- **Endocrine & Metabolic:** Dry Mouth
- **General:** Fatigue
- **Urinary & Reproductive:** Frequent Urination
- **Gastrointestinal:** Nausea
- **Cardiovascular:** Palpitations
- **Respiratory:** Shortness of Breath
- **Musculoskeletal:** Shoulder Pain

#### Guillain-Barre Syndrome  _9 symptoms_
**Symptoms:** Anxiety, Back Pain, Depression, Fatigue, Muscle Weakness, Numbness, Paralysis, Tingling, Weakness

- **Mental Health:** Anxiety, Depression
- **Musculoskeletal:** Back Pain, Muscle Weakness
- **General:** Fatigue, Weakness
- **Head & Neurological:** Numbness, Paralysis, Tingling

#### Huntingtons Disease  _6 symptoms_
**Symptoms:** Anxiety, Delusions, Depression, Hallucinations, Irritability, Seizures

- **Mental Health:** Anxiety, Delusions, Depression, Hallucinations, Irritability
- **Head & Neurological:** Seizures

#### Major Depressive Disorder  _10 symptoms_
**Symptoms:** Constipation, Delusions, Dry Mouth, Fatigue, Hallucinations, Headache, Hypersomnia, Insomnia, Irritability, Weakness

- **Gastrointestinal:** Constipation
- **Mental Health:** Delusions, Hallucinations, Hypersomnia, Insomnia, Irritability
- **Endocrine & Metabolic:** Dry Mouth
- **General:** Fatigue, Weakness
- **Head & Neurological:** Headache

#### Migraine  _12 symptoms_
**Symptoms:** Anxiety, Depression, Dizziness, Fatigue, Headache, Nausea, Neck Stiffness, Numbness, Photophobia, Tingling, Tinnitus, Vomiting

- **Mental Health:** Anxiety, Depression
- **Head & Neurological:** Dizziness, Headache, Neck Stiffness, Numbness, Photophobia, Tingling, Tinnitus
- **General:** Fatigue
- **Gastrointestinal:** Nausea, Vomiting

#### Multiple Sclerosis  _9 symptoms_
**Symptoms:** Anxiety, Constipation, Depression, Erectile Dysfunction, Fatigue, Fever, Headache, Numbness, Weakness

- **Mental Health:** Anxiety, Depression
- **Gastrointestinal:** Constipation
- **Urinary & Reproductive:** Erectile Dysfunction
- **General:** Fatigue, Fever, Weakness
- **Head & Neurological:** Headache, Numbness

#### Myasthenia Gravis  _7 symptoms_
**Symptoms:** Anxiety, Depression, Difficulty Swallowing, Double Vision, Fatigue, Muscle Weakness, Weakness

- **Mental Health:** Anxiety, Depression
- **Gastrointestinal:** Difficulty Swallowing
- **Head & Neurological:** Double Vision
- **General:** Fatigue, Weakness
- **Musculoskeletal:** Muscle Weakness

#### Obsessive-Compulsive Disorder  _6 symptoms_
**Symptoms:** Anxiety, Compulsive Behavior, Depression, Insomnia, Irritability, Poor Concentration

- **Mental Health:** Anxiety, Depression, Compulsive Behavior, Insomnia, Poor Concentration, Irritability

#### Parkinsons Disease  _6 symptoms_
**Symptoms:** Anosmia, Anxiety, Constipation, Depression, Fatigue, Hallucinations

- **Head & Neurological:** Anosmia
- **Mental Health:** Anxiety, Depression, Hallucinations
- **Gastrointestinal:** Constipation
- **General:** Fatigue

#### Post-Traumatic Stress Disorder  _3 symptoms_
**Symptoms:** Headache, Hypervigilance, Insomnia

- **Head & Neurological:** Headache
- **Mental Health:** Hypervigilance, Insomnia

#### Schizophrenia  _4 symptoms_
**Symptoms:** Delusions, Hallucinations, Insomnia, Social Withdrawal

- **Mental Health:** Delusions, Hallucinations, Insomnia, Social Withdrawal

### Dataset V8: Autoimmune (SLE, RA, Ankylosing Spondylitis, Sjögren's, Crohn's, Ulcerative Colitis, Type 1 Diabetes, etc.)

#### Ankylosing Spondylitis  _4 symptoms_
**Symptoms:** Back Pain, Depression, Morning Stiffness, Photophobia

- **Musculoskeletal:** Back Pain, Morning Stiffness
- **Mental Health:** Depression
- **Head & Neurological:** Photophobia

#### Antiphospholipid Syndrome  _5 symptoms_
**Symptoms:** Chest Pain, Edema, Headache, Seizures, Swelling

- **Respiratory:** Chest Pain
- **Cardiovascular:** Chest Pain
- **General:** Edema, Swelling
- **Head & Neurological:** Headache, Seizures

#### Autoimmune Hepatitis  _5 symptoms_
**Symptoms:** Dark Urine, Fatigue, Jaundice, Malaise, Nausea

- **Urinary & Reproductive:** Dark Urine
- **General:** Fatigue, Jaundice, Malaise
- **Gastrointestinal:** Nausea

#### Crohns Disease  _8 symptoms_
**Symptoms:** Abdominal Pain, Anxiety, Depression, Fatigue, Fever, Nausea, Rectal Bleeding, Vomiting

- **Gastrointestinal:** Abdominal Pain, Nausea, Rectal Bleeding, Vomiting
- **Mental Health:** Anxiety, Depression
- **General:** Fatigue, Fever

#### Graves Disease  _14 symptoms_
**Symptoms:** Anxiety, Depression, Edema, Excessive Sweating, Heat Intolerance, Increased Appetite, Insomnia, Irritability, Menstrual Irregularity, Muscle Weakness, Palpitations, Panic Attacks, Vomiting, Weakness

- **Mental Health:** Anxiety, Depression, Insomnia, Irritability, Panic Attacks
- **General:** Edema, Weakness
- **Endocrine & Metabolic:** Excessive Sweating, Heat Intolerance, Increased Appetite
- **Urinary & Reproductive:** Menstrual Irregularity
- **Musculoskeletal:** Muscle Weakness
- **Cardiovascular:** Palpitations
- **Gastrointestinal:** Vomiting

#### Hashimotos Thyroiditis  _12 symptoms_
**Symptoms:** Anxiety, Cold Intolerance, Constipation, Depression, Dry Skin, Edema, Fatigue, Hair Loss, Heavy Periods, Menstrual Irregularity, Slow Heart Rate, Tiredness

- **Mental Health:** Anxiety, Depression
- **Endocrine & Metabolic:** Cold Intolerance
- **Gastrointestinal:** Constipation
- **Skin & Hair:** Dry Skin, Hair Loss
- **General:** Edema, Fatigue, Tiredness
- **Urinary & Reproductive:** Heavy Periods, Menstrual Irregularity
- **Cardiovascular:** Slow Heart Rate

#### Polymyositis Dermatomyositis  _6 symptoms_
**Symptoms:** Edema, Fatigue, Fever, Hoarseness, Muscle Weakness, Weakness

- **General:** Edema, Fatigue, Fever, Weakness
- **Respiratory:** Hoarseness
- **Musculoskeletal:** Muscle Weakness

#### Primary Biliary Cholangitis  _4 symptoms_
**Symptoms:** Dry Eyes, Edema, Fatigue, Jaundice

- **Endocrine & Metabolic:** Dry Eyes
- **General:** Edema, Fatigue, Jaundice

#### Rheumatoid Arthritis  _5 symptoms_
**Symptoms:** Depression, Fatigue, Fever, Morning Stiffness, Swelling

- **Mental Health:** Depression
- **General:** Fatigue, Fever, Swelling
- **Musculoskeletal:** Morning Stiffness

#### Sjogrens Syndrome  _10 symptoms_
**Symptoms:** Cough, Difficulty Swallowing, Dry Cough, Dry Eyes, Dry Mouth, Dry Skin, Fatigue, Night Sweats, Photophobia, Purpura

- **Respiratory:** Cough, Dry Cough
- **Gastrointestinal:** Difficulty Swallowing
- **Endocrine & Metabolic:** Dry Eyes, Dry Mouth
- **Skin & Hair:** Dry Skin, Purpura
- **General:** Fatigue, Night Sweats
- **Head & Neurological:** Photophobia

#### Systemic Lupus Erythematosus  _11 symptoms_
**Symptoms:** Anxiety, Chest Pain, Depression, Fatigue, Fever, Headache, Malaise, Purpura, Seizures, Skin Lesions, Skin Rash

- **Mental Health:** Anxiety, Depression
- **Respiratory:** Chest Pain
- **Cardiovascular:** Chest Pain
- **General:** Fatigue, Fever, Malaise
- **Head & Neurological:** Headache, Seizures
- **Skin & Hair:** Purpura, Skin Lesions, Skin Rash

#### Systemic Sclerosis  _6 symptoms_
**Symptoms:** Bloating, Constipation, Cough, Depression, Dry Cough, Pallor

- **Gastrointestinal:** Bloating, Constipation
- **Respiratory:** Cough, Dry Cough
- **Mental Health:** Depression
- **General:** Pallor

#### Type 1 Diabetes Mellitus  _17 symptoms_
**Symptoms:** Abdominal Pain, Confusion, Dehydration, Depression, Excessive Thirst, Fatigue, Frequent Urination, Headache, Nausea, Night Sweats, Numbness, Palpitations, Rapid Breathing, Tingling, Tiredness, Vomiting, Weakness

- **Gastrointestinal:** Abdominal Pain, Nausea, Vomiting
- **Head & Neurological:** Confusion, Headache, Numbness, Tingling
- **General:** Dehydration, Fatigue, Night Sweats, Tiredness, Weakness
- **Mental Health:** Depression
- **Endocrine & Metabolic:** Excessive Thirst
- **Urinary & Reproductive:** Frequent Urination
- **Cardiovascular:** Palpitations
- **Respiratory:** Rapid Breathing

#### Ulcerative Colitis  _4 symptoms_
**Symptoms:** Anxiety, Depression, Fatigue, Fever

- **Mental Health:** Anxiety, Depression
- **General:** Fatigue, Fever

#### Vasculitis Anca  _6 symptoms_
**Symptoms:** Abdominal Pain, Cough, Fatigue, Fever, Night Sweats, Purpura

- **Gastrointestinal:** Abdominal Pain
- **Respiratory:** Cough
- **General:** Fatigue, Fever, Night Sweats
- **Skin & Hair:** Purpura

### Dataset V9: Dermatology Advanced (Melasma, Rosacea, Hirsutism, Hyperhidrosis, Striae, PIH, Perioral Dermatitis, etc.)

#### Acne Vulgaris  _6 symptoms_
**Symptoms:** Acne, Anxiety, Depression, Fever, Low Self-Esteem, Social Withdrawal

- **Skin & Hair:** Acne
- **Mental Health:** Anxiety, Depression, Low Self-Esteem, Social Withdrawal
- **General:** Fever

#### Androgenetic Alopecia  _6 symptoms_
**Symptoms:** Acne, Anxiety, Depression, Fever, Hair Loss, Social Withdrawal

- **Skin & Hair:** Acne, Hair Loss
- **Mental Health:** Anxiety, Depression, Social Withdrawal
- **General:** Fever

#### Chronic Urticaria  _6 symptoms_
**Symptoms:** Anxiety, Bruising, Depression, Edema, Fatigue, Swelling

- **Mental Health:** Anxiety, Depression
- **Skin & Hair:** Bruising
- **General:** Edema, Fatigue, Swelling

#### Hirsutism  _3 symptoms_
**Symptoms:** Acne, Anxiety, Depression

- **Skin & Hair:** Acne
- **Mental Health:** Anxiety, Depression

#### Hyperhidrosis  _6 symptoms_
**Symptoms:** Anxiety, Excessive Sweating, Fever, Headache, Night Sweats, Palpitations

- **Mental Health:** Anxiety
- **Endocrine & Metabolic:** Excessive Sweating
- **General:** Fever, Night Sweats
- **Head & Neurological:** Headache
- **Cardiovascular:** Palpitations

#### Keloid And Hypertrophic Scars  _4 symptoms_
**Symptoms:** Acne, Itching, Skin Discoloration, Skin Lesions

- **Skin & Hair:** Acne, Skin Lesions, Itching, Skin Discoloration

#### Melasma  _3 symptoms_
**Symptoms:** Depression, Skin Discoloration, Skin Lesions

- **Mental Health:** Depression
- **Skin & Hair:** Skin Discoloration, Skin Lesions

#### Perioral Dermatitis  _4 symptoms_
**Symptoms:** Dry Skin, Scaling, Skin Rash, Vesicles

- **Skin & Hair:** Scaling, Vesicles, Skin Rash, Dry Skin

#### Post-Inflam Hyperpigmentation  _4 symptoms_
**Symptoms:** Acne, Skin Discoloration, Skin Lesions, Skin Rash

- **Skin & Hair:** Acne, Skin Discoloration, Skin Lesions, Skin Rash

#### Rosacea  _3 symptoms_
**Symptoms:** Acne, Anxiety, Itching

- **Skin & Hair:** Acne, Itching
- **Mental Health:** Anxiety

#### Seborrhoeic Dermatitis  _7 symptoms_
**Symptoms:** Anxiety, Fatigue, Hair Loss, Itching, Oily Skin, Scaling, Skin Rash

- **Mental Health:** Anxiety
- **General:** Fatigue
- **Skin & Hair:** Scaling, Itching, Oily Skin, Skin Rash, Hair Loss

#### Striae Distensae  _4 symptoms_
**Symptoms:** Itching, Skin Discoloration, Skin Lesions, Social Withdrawal

- **Mental Health:** Social Withdrawal
- **Skin & Hair:** Skin Discoloration, Skin Lesions, Itching

#### Vitiligo  _4 symptoms_
**Symptoms:** Anxiety, Depression, Hair Loss, Itching

- **Mental Health:** Anxiety, Depression
- **Skin & Hair:** Hair Loss, Itching

### Dataset V10: Sexual Health — Gender-Filtered (ED, PE, Male Hypogonadism, Vaginismus, Dyspareunia, Vulvodynia, etc.)

#### Delayed Ejaculation 🔵`male`  _3 symptoms_
**Symptoms:** Anxiety, Depression, Fatigue

- **Mental Health:** Anxiety, Depression
- **General:** Fatigue

#### Dyspareunia  _4 symptoms_
**Symptoms:** Genital Pain, Muscle Cramps, Pelvic Pain, Vaginal Dryness

- **Urinary & Reproductive:** Genital Pain, Pelvic Pain, Vaginal Dryness
- **Musculoskeletal:** Muscle Cramps

#### Erectile Dysfunction 🔵`male`  _3 symptoms_
**Symptoms:** Anxiety, Depression, Erectile Dysfunction

- **Mental Health:** Anxiety, Depression
- **Urinary & Reproductive:** Erectile Dysfunction

#### Female Orgasmic Disorder 🔴`female`  _4 symptoms_
**Symptoms:** Anxiety, Depression, Pelvic Pain, Vaginal Dryness

- **Mental Health:** Anxiety, Depression
- **Urinary & Reproductive:** Pelvic Pain, Vaginal Dryness

#### Female Sexual Interest Arousal 🔴`female`  _3 symptoms_
**Symptoms:** Anxiety, Depression, Swelling

- **Mental Health:** Anxiety, Depression
- **General:** Swelling

#### Genito-Pelvic Pain Penetration 🔴`female`  _4 symptoms_
**Symptoms:** Anxiety, Depression, Hypervigilance, Pelvic Pain

- **Mental Health:** Anxiety, Depression, Hypervigilance
- **Urinary & Reproductive:** Pelvic Pain

#### Hypoactive Sexual Desire Disord 🔴`female`  _3 symptoms_
**Symptoms:** Anxiety, Depression, Vaginal Dryness

- **Mental Health:** Anxiety, Depression
- **Urinary & Reproductive:** Vaginal Dryness

#### Male Hypogonadism 🔵`male`  _5 symptoms_
**Symptoms:** Erectile Dysfunction, Fatigue, Infertility, Irritability, Poor Concentration

- **Urinary & Reproductive:** Erectile Dysfunction, Infertility
- **General:** Fatigue
- **Mental Health:** Irritability, Poor Concentration

#### Peyronies Disease 🔵`male`  _4 symptoms_
**Symptoms:** Anxiety, Depression, Erectile Dysfunction, Social Withdrawal

- **Mental Health:** Anxiety, Depression, Social Withdrawal
- **Urinary & Reproductive:** Erectile Dysfunction

#### Post-Orgasmic Illness Syndrome 🔵`male`  _15 symptoms_
**Symptoms:** Chills, Cough, Depression, Fatigue, Fever, Headache, Irritability, Itching, Joint Pain, Malaise, Nasal Congestion, Photophobia, Sneezing, Sore Throat, Weakness

- **General:** Chills, Fatigue, Fever, Malaise, Weakness
- **Respiratory:** Cough, Nasal Congestion, Sneezing, Sore Throat
- **Mental Health:** Depression, Irritability
- **Head & Neurological:** Headache, Photophobia
- **Skin & Hair:** Itching
- **Musculoskeletal:** Joint Pain

#### Premature Ejaculation 🔵`male`  _4 symptoms_
**Symptoms:** Anxiety, Depression, Erectile Dysfunction, Pelvic Pain

- **Mental Health:** Anxiety, Depression
- **Urinary & Reproductive:** Erectile Dysfunction, Pelvic Pain

#### Priapism 🔵`male`  _4 symptoms_
**Symptoms:** Anxiety, Erectile Dysfunction, Genital Pain, Muscle Pain

- **Mental Health:** Anxiety
- **Urinary & Reproductive:** Erectile Dysfunction, Genital Pain
- **Musculoskeletal:** Muscle Pain

#### Retrograde Ejaculation 🔵`male`  _3 symptoms_
**Symptoms:** Anxiety, Confusion, Infertility

- **Mental Health:** Anxiety
- **Head & Neurological:** Confusion
- **Urinary & Reproductive:** Infertility

#### Vaginismus 🔴`female`  _4 symptoms_
**Symptoms:** Anxiety, Genital Pain, Muscle Cramps, Pelvic Pain

- **Mental Health:** Anxiety
- **Urinary & Reproductive:** Pelvic Pain, Genital Pain
- **Musculoskeletal:** Muscle Cramps

#### Vulvodynia 🔴`female`  _3 symptoms_
**Symptoms:** Anxiety, Depression, Genital Pain

- **Mental Health:** Anxiety, Depression
- **Urinary & Reproductive:** Genital Pain

---

## 4. Reverse Index: Symptom → Diseases

**Anxiety** → 76 diseases: Acne Vulgaris, Alopecia Areata, Alzheimers Disease, Androgenetic Alopecia, Asthma, Atopic Dermatitis, Autism Spectrum Disorder, Burns, Cellulitis, Cholera, Chronic Urticaria, Conjunctivitis, Contact Dermatitis, Copd, Crohns Disease, Delayed Ejaculation, Diabetes (Type 1 & 2), Diarrhea, Epilepsy, Erectile Dysfunction, Female Orgasmic Disorder, Female Sexual Interest Arousal, Generalised Anxiety Disorder, Genito-Pelvic Pain Penetration, Graves Disease, Guillain-Barre Syndrome, Hashimotos Thyroiditis, Heart Failure, Hirsutism, Huntingtons Disease, Hyperhidrosis, Hypertension, Hypoactive Sexual Desire Disord, Invasive Aspergillosis, Jaundice, Kidney Disease, Lichen Planus, Lower Back Pain, Migraine, Migraine & Headache, Mucormycosis, Multiple Sclerosis, Mumps, Myasthenia Gravis, Obsessive-Compulsive Disorder, Onychomycosis, Organophosphate Poisoning, Parkinsons Disease, Pellagra & B-Vitamin Deficiency, Pemphigus Vulgaris, Peptic Ulcer & Gastritis, Pertussis, Peyronies Disease, Pityriasis Versicolor, Preeclampsia & Eclampsia, Premature Ejaculation, Priapism, Psoriasis, Rabies, Retrograde Ejaculation, Rheumatic Fever, Rosacea, Scabies, Seborrhoeic Dermatitis, Sickle Cell Disease, Systemic Lupus Erythematosus, Tetanus, Thalassemia, Tinea Capitis, Ulcerative Colitis, Urinary Tract Infection, Urticaria, Vaginismus, Vitiligo, Vulvodynia, Vulvovaginal Candidiasis

**Depression** → 62 diseases: Acne Vulgaris, Alopecia Areata, Alzheimers Disease, Androgenetic Alopecia, Ankylosing Spondylitis, Atopic Dermatitis, Autism Spectrum Disorder, Bipolar Disorder, Burns, Chronic Urticaria, Contact Dermatitis, Copd, Crohns Disease, Delayed Ejaculation, Diabetes (Type 1 & 2), Epilepsy, Erectile Dysfunction, Female Orgasmic Disorder, Female Sexual Interest Arousal, Filariasis, Genito-Pelvic Pain Penetration, Goiter & Iodine Deficiency, Graves Disease, Guillain-Barre Syndrome, Hashimotos Thyroiditis, Heart Failure, Hepatitis, Hirsutism, Huntingtons Disease, Hypoactive Sexual Desire Disord, Kidney Disease, Leprosy, Lichen Planus, Lower Back Pain, Melasma, Migraine, Migraine & Headache, Multiple Sclerosis, Myasthenia Gravis, Neurocysticercosis, Obsessive-Compulsive Disorder, Organophosphate Poisoning, Parkinsons Disease, Pellagra & B-Vitamin Deficiency, Pemphigus Vulgaris, Peptic Ulcer & Gastritis, Peyronies Disease, Post-Orgasmic Illness Syndrome, Premature Ejaculation, Psoriasis, Rheumatoid Arthritis, Sickle Cell Disease, Systemic Lupus Erythematosus, Systemic Sclerosis, Thalassemia, Tuberculosis, Type 1 Diabetes Mellitus, Ulcerative Colitis, Urticaria, Vitiligo, Vulvodynia, Vulvovaginal Candidiasis

**Fatigue** → 59 diseases: Allergic Rhinitis, Anaemia, Asthma, Atopic Dermatitis, Autoimmune Hepatitis, Bipolar Disorder, Chikungunya, Chronic Urticaria, Common Cold & Flu, Crohns Disease, Delayed Ejaculation, Dengue Fever, Diabetes (Type 1 & 2), Generalised Anxiety Disorder, Giardiasis, Goiter & Iodine Deficiency, Guillain-Barre Syndrome, Hashimotos Thyroiditis, Heart Failure, Hepatitis, Hookworm Infection, Hypertension, Jaundice, Kala-Azar, Kidney Disease, Leptospirosis, Major Depressive Disorder, Malaria, Male Hypogonadism, Malnutrition, Migraine, Multiple Sclerosis, Myasthenia Gravis, Parkinsons Disease, Pellagra & B-Vitamin Deficiency, Pneumonia, Polymyositis Dermatomyositis, Post-Orgasmic Illness Syndrome, Primary Biliary Cholangitis, Psoriasis, Rheumatic Fever, Rheumatoid Arthritis, Ringworm, Scabies, Scrub Typhus, Seborrheic Dermatitis, Seborrhoeic Dermatitis, Sickle Cell Disease, Sjogrens Syndrome, Systemic Lupus Erythematosus, Thalassemia, Toxocariasis, Toxoplasmosis, Tuberculosis, Type 1 Diabetes Mellitus, Ulcerative Colitis, Urinary Tract Infection, Urticaria, Vasculitis Anca

**Fever** → 54 diseases: Acne Vulgaris, Acute Otitis Media, Amoebiasis, Androgenetic Alopecia, Ascariasis, Cellulitis, Chickenpox, Chikungunya, Cholera, Common Cold & Flu, Crohns Disease, Cryptococcal Meningitis, Cryptosporidiosis, Dengue Fever, Dental Caries & Oral Health, Diarrhea, Diphtheria, Filariasis, Hepatitis, Histoplasmosis, Hydatid Disease, Hyperhidrosis, Impetigo, Invasive Aspergillosis, Japanese Encephalitis, Kala-Azar, Leprosy, Leptospirosis, Malaria, Measles, Multiple Sclerosis, Mumps, Neonatal Fever, Pemphigus Vulgaris, Pertussis, Pneumonia, Polymyositis Dermatomyositis, Post-Orgasmic Illness Syndrome, Pressure Ulcers, Rabies, Rheumatic Fever, Rheumatoid Arthritis, Scrub Typhus, Sickle Cell Disease, Stevens-Johnson Syndrome, Systemic Lupus Erythematosus, Tetanus, Toxocariasis, Toxoplasmosis, Tuberculosis, Typhoid Fever, Ulcerative Colitis, Urinary Tract Infection, Vasculitis Anca

**Weakness** → 38 diseases: Anaemia, Chikungunya, Dengue Fever, Diabetes (Type 1 & 2), Diarrhea, Diphtheria, Epilepsy, Giardiasis, Graves Disease, Guillain-Barre Syndrome, Heat Stroke, Hepatitis, Japanese Encephalitis, Jaundice, Kala-Azar, Kidney Disease, Leprosy, Leptospirosis, Lower Back Pain, Major Depressive Disorder, Malaria, Malnutrition, Multiple Sclerosis, Myasthenia Gravis, Neurocysticercosis, Organophosphate Poisoning, Pellagra & B-Vitamin Deficiency, Pneumonia, Polymyositis Dermatomyositis, Post-Orgasmic Illness Syndrome, Rheumatic Fever, Rickets & Vitamin D Deficiency, Scrub Typhus, Snakebite Envenomation, Tinea Capitis, Tuberculosis, Type 1 Diabetes Mellitus, Typhoid Fever

**Irritability** → 35 diseases: Acute Otitis Media, Allergic Rhinitis, Alzheimers Disease, Anaemia, Ascariasis, Atopic Dermatitis, Autism Spectrum Disorder, Chickenpox, Chikungunya, Common Cold & Flu, Conjunctivitis, Dengue Fever, Diabetes (Type 1 & 2), Diarrhea, Enterobiasis, Generalised Anxiety Disorder, Giardiasis, Graves Disease, Hepatitis, Huntingtons Disease, Japanese Encephalitis, Major Depressive Disorder, Malaria, Male Hypogonadism, Malnutrition, Measles, Neonatal Fever, Obsessive-Compulsive Disorder, Pellagra & B-Vitamin Deficiency, Post-Orgasmic Illness Syndrome, Rickets & Vitamin D Deficiency, Scabies, Severe Dehydration, Tuberculosis, Urticaria

**Headache** → 33 diseases: Antiphospholipid Syndrome, Cellulitis, Common Cold & Flu, Cryptococcal Meningitis, Dengue Fever, Epilepsy, Generalised Anxiety Disorder, Heat Stroke, Histoplasmosis, Hyperhidrosis, Hypertension, Japanese Encephalitis, Leptospirosis, Major Depressive Disorder, Malaria, Migraine, Migraine & Headache, Mucormycosis, Multiple Sclerosis, Mumps, Neurocysticercosis, Pneumonia, Post-Orgasmic Illness Syndrome, Post-Traumatic Stress Disorder, Preeclampsia & Eclampsia, Rabies, Scrub Typhus, Stevens-Johnson Syndrome, Systemic Lupus Erythematosus, Toxocariasis, Toxoplasmosis, Type 1 Diabetes Mellitus, Typhoid Fever

**Edema** → 31 diseases: Allergic Rhinitis, Anaemia, Antiphospholipid Syndrome, Burns, Cellulitis, Chronic Urticaria, Common Cold & Flu, Conjunctivitis, Contact Dermatitis, Copd, Cryptococcal Meningitis, Dengue Fever, Diphtheria, Filariasis, Goiter & Iodine Deficiency, Graves Disease, Hashimotos Thyroiditis, Heart Failure, Hepatitis, Hookworm Infection, Hypertension, Invasive Aspergillosis, Kidney Disease, Malnutrition, Measles, Neurocysticercosis, Polymyositis Dermatomyositis, Preeclampsia & Eclampsia, Primary Biliary Cholangitis, Urticaria, Vulvovaginal Candidiasis

**Swelling** → 29 diseases: Anaemia, Antiphospholipid Syndrome, Cellulitis, Chikungunya, Chronic Urticaria, Conjunctivitis, Copd, Dental Caries & Oral Health, Diabetes (Type 1 & 2), Female Sexual Interest Arousal, Filariasis, Goiter & Iodine Deficiency, Heart Failure, Hepatitis, Hypertension, Malnutrition, Migraine & Headache, Mucormycosis, Mumps, Preeclampsia & Eclampsia, Pressure Ulcers, Rheumatoid Arthritis, Rickets & Vitamin D Deficiency, Sickle Cell Disease, Snakebite Envenomation, Stevens-Johnson Syndrome, Tuberculosis, Urticaria, Vulvovaginal Candidiasis

**Itching** → 27 diseases: Allergic Rhinitis, Atopic Dermatitis, Burns, Chickenpox, Conjunctivitis, Contact Dermatitis, Dengue Fever, Enterobiasis, Epilepsy, Jaundice, Keloid And Hypertrophic Scars, Leptospirosis, Onychomycosis, Organophosphate Poisoning, Post-Orgasmic Illness Syndrome, Psoriasis, Rabies, Ringworm, Rosacea, Scabies, Seborrheic Dermatitis, Seborrhoeic Dermatitis, Striae Distensae, Strongyloidiasis, Urticaria, Vitiligo, Vulvovaginal Candidiasis

**Confusion** → 27 diseases: Alzheimers Disease, Asthma, Burns, Chickenpox, Cholera, Cryptococcal Meningitis, Diabetes (Type 1 & 2), Epilepsy, Heart Failure, Heat Stroke, Hepatitis, Hypertension, Japanese Encephalitis, Kidney Disease, Leptospirosis, Malaria, Organophosphate Poisoning, Pellagra & B-Vitamin Deficiency, Pneumonia, Rabies, Retrograde Ejaculation, Scrub Typhus, Severe Dehydration, Toxoplasmosis, Type 1 Diabetes Mellitus, Typhoid Fever, Urinary Tract Infection

**Cough** → 26 diseases: Allergic Rhinitis, Ascariasis, Asthma, Chickenpox, Common Cold & Flu, Copd, Cryptosporidiosis, Diphtheria, Filariasis, Heart Failure, Histoplasmosis, Hydatid Disease, Invasive Aspergillosis, Measles, Pertussis, Pneumonia, Post-Orgasmic Illness Syndrome, Scrub Typhus, Sickle Cell Disease, Sjogrens Syndrome, Strongyloidiasis, Systemic Sclerosis, Toxocariasis, Toxoplasmosis, Tuberculosis, Vasculitis Anca

**Nausea** → 24 diseases: Autoimmune Hepatitis, Crohns Disease, Cryptosporidiosis, Dengue Fever, Diabetes (Type 1 & 2), Diarrhea, Generalised Anxiety Disorder, Giardiasis, Heat Stroke, Hepatitis, Hookworm Infection, Hypertension, Jaundice, Kidney Disease, Leptospirosis, Malaria, Migraine, Migraine & Headache, Mumps, Peptic Ulcer & Gastritis, Strongyloidiasis, Type 1 Diabetes Mellitus, Typhoid Fever, Urinary Tract Infection

**Vomiting** → 24 diseases: Ascariasis, Cholera, Crohns Disease, Dengue Fever, Diabetes (Type 1 & 2), Diarrhea, Graves Disease, Heat Stroke, Hepatitis, Hypertension, Kidney Disease, Leptospirosis, Malaria, Migraine, Migraine & Headache, Mumps, Neonatal Fever, Neurocysticercosis, Peptic Ulcer & Gastritis, Pertussis, Strongyloidiasis, Type 1 Diabetes Mellitus, Urinary Tract Infection, Urticaria

**Abdominal Pain** → 20 diseases: Amoebiasis, Ascariasis, Cholera, Crohns Disease, Cryptosporidiosis, Dengue Fever, Diabetes (Type 1 & 2), Diarrhea, Enterobiasis, Giardiasis, Hookworm Infection, Jaundice, Leptospirosis, Pellagra & B-Vitamin Deficiency, Peptic Ulcer & Gastritis, Toxocariasis, Type 1 Diabetes Mellitus, Typhoid Fever, Urinary Tract Infection, Vasculitis Anca

**Seizures** → 19 diseases: Alzheimers Disease, Antiphospholipid Syndrome, Chickenpox, Cryptococcal Meningitis, Epilepsy, Heat Stroke, Huntingtons Disease, Hydatid Disease, Hypertension, Japanese Encephalitis, Measles, Neonatal Fever, Neurocysticercosis, Organophosphate Poisoning, Preeclampsia & Eclampsia, Scrub Typhus, Sickle Cell Disease, Systemic Lupus Erythematosus, Toxoplasmosis

**Malaise** → 16 diseases: Autoimmune Hepatitis, Cellulitis, Chickenpox, Common Cold & Flu, Dengue Fever, Diphtheria, Giardiasis, Hepatitis, Impetigo, Japanese Encephalitis, Mumps, Post-Orgasmic Illness Syndrome, Stevens-Johnson Syndrome, Systemic Lupus Erythematosus, Typhoid Fever, Urinary Tract Infection

**Tiredness** → 14 diseases: Anaemia, Asthma, Chickenpox, Diabetes (Type 1 & 2), Giardiasis, Hashimotos Thyroiditis, Hepatitis, Hookworm Infection, Hypertension, Kidney Disease, Malaria, Tuberculosis, Type 1 Diabetes Mellitus, Urinary Tract Infection

**Dehydration** → 14 diseases: Cholera, Cryptosporidiosis, Dengue Fever, Diabetes (Type 1 & 2), Diarrhea, Diphtheria, Heat Stroke, Measles, Pertussis, Pneumonia, Severe Dehydration, Sickle Cell Disease, Type 1 Diabetes Mellitus, Urinary Tract Infection

**Photophobia** → 12 diseases: Ankylosing Spondylitis, Conjunctivitis, Cryptococcal Meningitis, Leptospirosis, Measles, Migraine, Migraine & Headache, Mumps, Pellagra & B-Vitamin Deficiency, Post-Orgasmic Illness Syndrome, Sjogrens Syndrome, Toxoplasmosis

**Insomnia** → 11 diseases: Autism Spectrum Disorder, Bipolar Disorder, Dengue Fever, Graves Disease, Major Depressive Disorder, Obsessive-Compulsive Disorder, Pellagra & B-Vitamin Deficiency, Post-Traumatic Stress Disorder, Psoriasis, Rabies, Schizophrenia

**Jaundice** → 11 diseases: Ascariasis, Autoimmune Hepatitis, Cryptosporidiosis, Heart Failure, Hepatitis, Hydatid Disease, Jaundice, Leptospirosis, Neonatal Fever, Primary Biliary Cholangitis, Sickle Cell Disease

**Social Withdrawal** → 11 diseases: Acne Vulgaris, Alopecia Areata, Androgenetic Alopecia, Autism Spectrum Disorder, Generalised Anxiety Disorder, Impetigo, Neurocysticercosis, Peyronies Disease, Psoriasis, Schizophrenia, Striae Distensae

**Poor Concentration** → 10 diseases: Anaemia, Autism Spectrum Disorder, Copd, Diabetes (Type 1 & 2), Enterobiasis, Heart Failure, Hypertension, Kidney Disease, Male Hypogonadism, Obsessive-Compulsive Disorder

**Diarrhea** → 9 diseases: Cholera, Diarrhea, Giardiasis, Hookworm Infection, Malnutrition, Measles, Organophosphate Poisoning, Pellagra & B-Vitamin Deficiency, Typhoid Fever

**Chest Pain** → 9 diseases: Antiphospholipid Syndrome, Histoplasmosis, Hydatid Disease, Hypertension, Invasive Aspergillosis, Pneumonia, Sickle Cell Disease, Systemic Lupus Erythematosus, Tuberculosis

**Loss of Appetite** → 9 diseases: Anaemia, Chikungunya, Dengue Fever, Diabetes (Type 1 & 2), Hepatitis, Malaria, Mumps, Tuberculosis, Typhoid Fever

**Erectile Dysfunction** → 9 diseases: Diabetes (Type 1 & 2), Erectile Dysfunction, Hypertension, Male Hypogonadism, Multiple Sclerosis, Peyronies Disease, Premature Ejaculation, Priapism, Sickle Cell Disease

**Muscle Weakness** → 9 diseases: Graves Disease, Guillain-Barre Syndrome, Kidney Disease, Leprosy, Myasthenia Gravis, Organophosphate Poisoning, Polymyositis Dermatomyositis, Rheumatic Fever, Rickets & Vitamin D Deficiency

**Skin Lesions** → 9 diseases: Histoplasmosis, Keloid And Hypertrophic Scars, Leprosy, Melasma, Post-Inflam Hyperpigmentation, Pressure Ulcers, Stevens-Johnson Syndrome, Striae Distensae, Systemic Lupus Erythematosus

**Scaling** → 9 diseases: Alopecia Areata, Contact Dermatitis, Perioral Dermatitis, Pityriasis Versicolor, Psoriasis, Ringworm, Seborrheic Dermatitis, Seborrhoeic Dermatitis, Tinea Capitis

**Skin Rash** → 8 diseases: Chikungunya, Dengue Fever, Pellagra & B-Vitamin Deficiency, Perioral Dermatitis, Post-Inflam Hyperpigmentation, Seborrhoeic Dermatitis, Systemic Lupus Erythematosus, Toxocariasis

**Numbness** → 8 diseases: Diabetes (Type 1 & 2), Guillain-Barre Syndrome, Leprosy, Lower Back Pain, Migraine, Migraine & Headache, Multiple Sclerosis, Type 1 Diabetes Mellitus

**Tingling** → 8 diseases: Diabetes (Type 1 & 2), Epilepsy, Guillain-Barre Syndrome, Lower Back Pain, Migraine, Migraine & Headache, Rabies, Type 1 Diabetes Mellitus

**Constipation** → 8 diseases: Goiter & Iodine Deficiency, Hashimotos Thyroiditis, Hookworm Infection, Major Depressive Disorder, Multiple Sclerosis, Parkinsons Disease, Systemic Sclerosis, Typhoid Fever

**Paralysis** → 8 diseases: Cryptococcal Meningitis, Diphtheria, Epilepsy, Guillain-Barre Syndrome, Japanese Encephalitis, Organophosphate Poisoning, Rabies, Snakebite Envenomation

**Hair Loss** → 8 diseases: Alopecia Areata, Androgenetic Alopecia, Hashimotos Thyroiditis, Lichen Planus, Ringworm, Seborrhoeic Dermatitis, Tinea Capitis, Vitiligo

**Lethargy** → 7 diseases: Cholera, Dengue Fever, Diarrhea, Goiter & Iodine Deficiency, Malnutrition, Neonatal Fever, Severe Dehydration

**Wasting** → 7 diseases: Copd, Cryptosporidiosis, Heart Failure, Kala-Azar, Malnutrition, Pellagra & B-Vitamin Deficiency, Tuberculosis

**Anemia** → 7 diseases: Hookworm Infection, Kala-Azar, Kidney Disease, Malaria, Sickle Cell Disease, Thalassemia, Tuberculosis

**Night Sweats** → 7 diseases: Amoebiasis, Histoplasmosis, Hyperhidrosis, Sjogrens Syndrome, Tuberculosis, Type 1 Diabetes Mellitus, Vasculitis Anca

**Pallor** → 7 diseases: Anaemia, Hookworm Infection, Neonatal Fever, Sickle Cell Disease, Systemic Sclerosis, Thalassemia, Tuberculosis

**Joint Pain** → 7 diseases: Chikungunya, Dengue Fever, Hepatitis, Leprosy, Malaria, Post-Orgasmic Illness Syndrome, Rheumatic Fever

**Dry Mouth** → 7 diseases: Cholera, Diarrhea, Generalised Anxiety Disorder, Major Depressive Disorder, Oral Candidiasis, Severe Dehydration, Sjogrens Syndrome

**Neck Stiffness** → 7 diseases: Cryptococcal Meningitis, Generalised Anxiety Disorder, Leptospirosis, Migraine, Mumps, Scrub Typhus, Tetanus

**Difficulty Swallowing** → 7 diseases: Diphtheria, Goiter & Iodine Deficiency, Myasthenia Gravis, Oral Candidiasis, Sjogrens Syndrome, Snakebite Envenomation, Tetanus

**Hallucinations** → 7 diseases: Alzheimers Disease, Bipolar Disorder, Huntingtons Disease, Major Depressive Disorder, Parkinsons Disease, Rabies, Schizophrenia

**Dry Skin** → 7 diseases: Atopic Dermatitis, Burns, Goiter & Iodine Deficiency, Hashimotos Thyroiditis, Heat Stroke, Perioral Dermatitis, Sjogrens Syndrome

**Palpitations** → 6 diseases: Diabetes (Type 1 & 2), Generalised Anxiety Disorder, Graves Disease, Hyperhidrosis, Hypertension, Type 1 Diabetes Mellitus

**Chills** → 6 diseases: Cellulitis, Leptospirosis, Malaria, Pneumonia, Post-Orgasmic Illness Syndrome, Urinary Tract Infection

**Productive Cough** → 6 diseases: Asthma, Copd, Histoplasmosis, Pneumonia, Scrub Typhus, Toxoplasmosis

**Wheezing** → 6 diseases: Ascariasis, Asthma, Copd, Filariasis, Strongyloidiasis, Toxocariasis

**Dizziness** → 6 diseases: Anaemia, Diarrhea, Generalised Anxiety Disorder, Heat Stroke, Migraine, Severe Dehydration

**Muscle Cramps** → 6 diseases: Cholera, Dyspareunia, Heat Stroke, Severe Dehydration, Tetanus, Vaginismus

**Vesicles** → 6 diseases: Cellulitis, Chickenpox, Contact Dermatitis, Impetigo, Perioral Dermatitis, Scabies

**Acne** → 6 diseases: Acne Vulgaris, Androgenetic Alopecia, Hirsutism, Keloid And Hypertrophic Scars, Post-Inflam Hyperpigmentation, Rosacea

**Persistent Cough** → 5 diseases: Common Cold & Flu, Heart Failure, Measles, Pneumonia, Tuberculosis

**Muscle Pain** → 5 diseases: Chikungunya, Common Cold & Flu, Dengue Fever, Leptospirosis, Priapism

**Sore Throat** → 5 diseases: Common Cold & Flu, Dengue Fever, Diphtheria, Oral Candidiasis, Post-Orgasmic Illness Syndrome

**Rapid Breathing** → 5 diseases: Asthma, Diabetes (Type 1 & 2), Malaria, Pneumonia, Type 1 Diabetes Mellitus

**Nasal Congestion** → 5 diseases: Allergic Rhinitis, Common Cold & Flu, Migraine & Headache, Mucormycosis, Post-Orgasmic Illness Syndrome

**Dry Cough** → 5 diseases: Heart Failure, Histoplasmosis, Hydatid Disease, Sjogrens Syndrome, Systemic Sclerosis

**Back Pain** → 5 diseases: Ankylosing Spondylitis, Guillain-Barre Syndrome, Lower Back Pain, Rickets & Vitamin D Deficiency, Tetanus

**Skin Discoloration** → 5 diseases: Keloid And Hypertrophic Scars, Melasma, Post-Inflam Hyperpigmentation, Pressure Ulcers, Striae Distensae

**Delusions** → 5 diseases: Alzheimers Disease, Bipolar Disorder, Huntingtons Disease, Major Depressive Disorder, Schizophrenia

**Pelvic Pain** → 5 diseases: Dyspareunia, Female Orgasmic Disorder, Genito-Pelvic Pain Penetration, Premature Ejaculation, Vaginismus

**Petechiae** → 4 diseases: Dengue Fever, Leptospirosis, Neonatal Fever, Pertussis

**Blurred Vision** → 4 diseases: Diabetes (Type 1 & 2), Hypertension, Preeclampsia & Eclampsia, Toxoplasmosis

**Vaginal Dryness** → 4 diseases: Diabetes (Type 1 & 2), Dyspareunia, Female Orgasmic Disorder, Hypoactive Sexual Desire Disord

**Runny Nose** → 4 diseases: Common Cold & Flu, Measles, Pertussis, Stevens-Johnson Syndrome

**Sneezing** → 4 diseases: Allergic Rhinitis, Common Cold & Flu, Pertussis, Post-Orgasmic Illness Syndrome

**Bloating** → 4 diseases: Ascariasis, Giardiasis, Peptic Ulcer & Gastritis, Systemic Sclerosis

**Dark Urine** → 4 diseases: Autoimmune Hepatitis, Heat Stroke, Jaundice, Sickle Cell Disease

**Genital Pain** → 4 diseases: Dyspareunia, Priapism, Vaginismus, Vulvodynia

**Shortness of Breath** → 3 diseases: Anaemia, Generalised Anxiety Disorder, Tuberculosis

**Bruising** → 3 diseases: Chronic Urticaria, Dengue Fever, Kala-Azar

**Frequent Urination** → 3 diseases: Diabetes (Type 1 & 2), Generalised Anxiety Disorder, Type 1 Diabetes Mellitus

**Hoarseness** → 3 diseases: Allergic Rhinitis, Goiter & Iodine Deficiency, Polymyositis Dermatomyositis

**Difficulty Breathing** → 3 diseases: Goiter & Iodine Deficiency, Organophosphate Poisoning, Snakebite Envenomation

**Infertility** → 3 diseases: Goiter & Iodine Deficiency, Male Hypogonadism, Retrograde Ejaculation

**Low Self-Esteem** → 3 diseases: Acne Vulgaris, Dental Caries & Oral Health, Pityriasis Versicolor

**Morning Stiffness** → 3 diseases: Ankylosing Spondylitis, Lower Back Pain, Rheumatoid Arthritis

**Nail Changes** → 3 diseases: Alopecia Areata, Onychomycosis, Psoriasis

**Hypervigilance** → 3 diseases: Generalised Anxiety Disorder, Genito-Pelvic Pain Penetration, Post-Traumatic Stress Disorder

**Purpura** → 3 diseases: Sjogrens Syndrome, Systemic Lupus Erythematosus, Vasculitis Anca

**Stunting** → 2 diseases: Ascariasis, Malnutrition

**Hemoptysis** → 2 diseases: Leptospirosis, Tuberculosis

**Pale Skin** → 2 diseases: Malaria, Tuberculosis

**Unexplained Weight Loss** → 2 diseases: Diabetes (Type 1 & 2), Tuberculosis

**Excessive Thirst** → 2 diseases: Diabetes (Type 1 & 2), Type 1 Diabetes Mellitus

**Tremors** → 2 diseases: Diabetes (Type 1 & 2), Japanese Encephalitis

**Blood in Urine** → 2 diseases: Kidney Disease, Urinary Tract Infection

**Sleep Apnea** → 2 diseases: Hypertension, Kidney Disease

**Rapid Heart Rate** → 2 diseases: Heat Stroke, Severe Dehydration

**Brittle Nails** → 2 diseases: Anaemia, Onychomycosis

**Anosmia** → 2 diseases: Allergic Rhinitis, Parkinsons Disease

**Yellow Skin** → 2 diseases: Jaundice, Leptospirosis

**Bone Pain** → 2 diseases: Kidney Disease, Rickets & Vitamin D Deficiency

**Cold Intolerance** → 2 diseases: Goiter & Iodine Deficiency, Hashimotos Thyroiditis

**Heartburn** → 2 diseases: Peptic Ulcer & Gastritis, Preeclampsia & Eclampsia

**Memory Loss** → 2 diseases: Alzheimers Disease, Pellagra & B-Vitamin Deficiency

**Hypersomnia** → 2 diseases: Bipolar Disorder, Major Depressive Disorder

**Dry Eyes** → 2 diseases: Primary Biliary Cholangitis, Sjogrens Syndrome

**Excessive Sweating** → 2 diseases: Graves Disease, Hyperhidrosis

**Menstrual Irregularity** → 2 diseases: Graves Disease, Hashimotos Thyroiditis

**Blood Sugar Fluctuations** → 1 diseases: Diabetes (Type 1 & 2)

**Painful Urination** → 1 diseases: Urinary Tract Infection

**Chest Tightness** → 1 diseases: Asthma

**Low Blood Pressure** → 1 diseases: Severe Dehydration

**Eye Pain** → 1 diseases: Chikungunya

**Joint Swelling** → 1 diseases: Chikungunya

**Bloody Diarrhea** → 1 diseases: Diarrhea

**Reduced Urine Output** → 1 diseases: Diarrhea

**Loss of Consciousness** → 1 diseases: Epilepsy

**Flatulence** → 1 diseases: Giardiasis

**Blood in Stool** → 1 diseases: Hookworm Infection

**Liver Enlargement** → 1 diseases: Kala-Azar

**Goiter** → 1 diseases: Goiter & Iodine Deficiency

**Poor Growth** → 1 diseases: Rickets & Vitamin D Deficiency

**Testicular Pain** → 1 diseases: Mumps

**Acid Reflux** → 1 diseases: Peptic Ulcer & Gastritis

**Hearing Loss** → 1 diseases: Acute Otitis Media

**Hives** → 1 diseases: Urticaria

**Wounds Not Healing** → 1 diseases: Pressure Ulcers

**Mouth Ulcers** → 1 diseases: Oral Candidiasis

**Facial Pain** → 1 diseases: Invasive Aspergillosis

**Foot Pain** → 1 diseases: Onychomycosis

**Mania** → 1 diseases: Bipolar Disorder

**Shoulder Pain** → 1 diseases: Generalised Anxiety Disorder

**Compulsive Behavior** → 1 diseases: Obsessive-Compulsive Disorder

**Tinnitus** → 1 diseases: Migraine

**Double Vision** → 1 diseases: Myasthenia Gravis

**Rectal Bleeding** → 1 diseases: Crohns Disease

**Heat Intolerance** → 1 diseases: Graves Disease

**Increased Appetite** → 1 diseases: Graves Disease

**Panic Attacks** → 1 diseases: Graves Disease

**Heavy Periods** → 1 diseases: Hashimotos Thyroiditis

**Slow Heart Rate** → 1 diseases: Hashimotos Thyroiditis

**Oily Skin** → 1 diseases: Seborrhoeic Dermatitis
