"""
generate_finetune_dataset.py
-----------------------------
Converts DhanwantariAI JSON knowledge base into instruction-tuning JSONL
in ShareGPT format (compatible with Unsloth / TRL / Axolotl).

Generates multiple training pair types per disease:
  Type A — Symptom → Disease prediction + explanation           (1 per disease)
  Type B — Partial symptoms → differential diagnosis            (2 per disease)
  Type C — "What confirms X?" → Confirmation tests              (1 per disease)
  Type D — "How is X treated?" → Medicines (generic + Aushadhi) (1 per disease)
  Type E — "What are the Ayurvedic options for X?" → Ayurveda   (1 per disease)
  Type F — "India-specific risks of X?" → india_specific        (1 per disease)
  Type G — Profile-aware: BMI/age/gender context → analysis     (2 per disease)
  Type H — Conversational follow-up Q&A                         (1 per disease)

Total: ~10 pairs × 145 diseases = ~1,450 base pairs
With augmentation (symptom subset variations): ~4,000-6,000 pairs

Run (English base):
  python3 scripts/generate_finetune_dataset.py
  Output: training_data/dhanwantari_train.jsonl  (80%)
          training_data/dhanwantari_val.jsonl    (20%)

Run (language pack scaffold):
  python3 scripts/generate_finetune_dataset.py --language hi
  Output: training_data/lang/hi/train.jsonl
          training_data/lang/hi/val.jsonl
  IMPORTANT: Assistant responses are generated in English. You must translate
             all 'gpt' entries to Hindi (or target language) before running
             training/train.py --variant 1b --language hi
             System prompt is loaded from training/lang/hi/system_prompt.txt.
"""

import argparse
import json
import random
import math
from pathlib import Path

random.seed(42)

BASE = Path(__file__).parent.parent   # repo root (works on any machine)

# ── CLI ────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description='Generate DhanwantariAI training JSONL')
parser.add_argument(
    '--language', '-L',
    default = 'en',
    metavar = 'LANG',
    help    = 'Language code for dataset scaffold (default: en). '
              'Non-English outputs use the system prompt from training/lang/<LANG>/system_prompt.txt. '
              'NOTE: assistant response CONTENT is still English — translate before training.',
)
args = parser.parse_args()
LANGUAGE = args.language

# Use FIXED version if it exists, else enriched JSON
json_path = BASE / 'DhanwantariAI_Symptom_Disease_Mapping_FIXED.json'
if not json_path.exists():
    json_path = BASE / 'DhanwantariAI_Symptom_Disease_Mapping (1).json'
    print(f'WARNING: Using non-fixed JSON. Run fix_truncation.py first for best quality.')

with open(json_path) as f:
    data = json.load(f)

diseases = data['diseases']
scoring = data['scoring_algorithm']

# ── System prompt ──────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are DhanwantariAI, an India-focused clinical decision support assistant.
You help users understand possible diseases based on their symptoms and health profile.
You provide information on confirmation tests, generic medicines, Jan Aushadhi (PMBJP) affordable medicines, Ayurvedic options, and India-specific risk factors.
You always remind users to consult a licensed doctor before starting any treatment.
You never diagnose — you provide structured health information to support informed decisions."""

# ── Helpers ────────────────────────────────────────────────────────────────
def fmt_list(items):
    if isinstance(items, list):
        return ', '.join(items)
    return str(items)

def gender_str(g):
    return {'male': 'male', 'female': 'female', 'both': 'male or female'}.get(g, 'anyone')

def get_text(d, field):
    val = d.get(field, '')
    if isinstance(val, list):
        return '\n'.join(val)
    return val

SAMPLE_PROFILES = [
    {'age': 28, 'gender': 'male',   'bmi': 22.1, 'bmi_cat': 'Normal',       'hereditary': []},
    {'age': 45, 'gender': 'female', 'bmi': 31.2, 'bmi_cat': 'Obese Class I', 'hereditary': ['Hypertension (Family History)']},
    {'age': 62, 'gender': 'male',   'bmi': 27.4, 'bmi_cat': 'Overweight',    'hereditary': ['Type 2 Diabetes (Family History)', 'Coronary Heart Disease (Family)']},
    {'age': 10, 'gender': 'female', 'bmi': 15.8, 'bmi_cat': 'Underweight',   'hereditary': []},
    {'age': 35, 'gender': 'female', 'bmi': 24.0, 'bmi_cat': 'Normal',        'hereditary': ['Lupus / SLE (Family History)']},
    {'age': 55, 'gender': 'male',   'bmi': 38.5, 'bmi_cat': 'Obese Class II','hereditary': []},
]

def make_pair(system, user, assistant):
    return {
        "conversations": [
            {"from": "system",    "value": system},
            {"from": "human",     "value": user},
            {"from": "gpt",       "value": assistant},
        ]
    }

pairs = []

for d in diseases:
    name        = d['name']
    symptoms    = d['symptoms']
    sym_by_cat  = d['symptoms_by_category']
    tests_raw   = get_text(d, 'tests')
    generic     = get_text(d, 'generic_medicines')
    aushadhi    = get_text(d, 'janaushadhi_medicines')
    ayurveda    = get_text(d, 'ayurvedic_medicines')
    india       = get_text(d, 'india_specific')
    notes       = get_text(d, 'important_notes')
    gender      = d.get('gender', 'both')
    curated     = d.get('confirmation_tests_curated', [])

    # ── A: Full symptom set → disease explanation ─────────────────────────
    sym_str = fmt_list(symptoms)
    user_a = f"I am experiencing the following symptoms: {sym_str}. What could be wrong with me?"
    asst_a = (
        f"Based on the symptoms you have described — {sym_str} — one possibility to consider is **{name}**.\n\n"
        f"**About {name}:** This condition affects {gender_str(gender)} patients.\n\n"
        f"**Confirmation tests your doctor may order:**\n{chr(10).join(f'• {t}' for t in curated)}\n\n"
        f"**Important:** {notes[:400] if notes else 'Please consult a licensed doctor for a proper diagnosis.'}\n\n"
        "This is not a diagnosis. Please consult a licensed doctor before starting any treatment."
    )
    pairs.append(make_pair(SYSTEM_PROMPT, user_a, asst_a))

    # ── B: Partial symptom sets (2 subsets) → differential ────────────────
    for _ in range(2):
        n_sub = max(2, random.randint(2, min(5, len(symptoms))))
        subset = random.sample(symptoms, n_sub)
        subset_str = fmt_list(subset)
        user_b = f"I have these symptoms: {subset_str}. What diseases should I consider?"
        asst_b = (
            f"With symptoms like {subset_str}, **{name}** is one condition worth discussing with your doctor.\n\n"
            f"**Why {name}?** It typically presents with: {sym_str}.\n"
            f"You are showing {n_sub} of the known {len(symptoms)} symptoms.\n\n"
            f"**Next steps — confirmation tests:**\n{chr(10).join(f'• {t}' for t in curated)}\n\n"
            "These symptoms can overlap with other conditions. A clinical examination is essential. "
            "Please consult a licensed doctor."
        )
        pairs.append(make_pair(SYSTEM_PROMPT, user_b, asst_b))

    # ── C: "What confirms X?" ──────────────────────────────────────────────
    user_c = f"What tests confirm {name}?"
    asst_c = (
        f"**Confirmation tests for {name}:**\n\n"
        f"**Quick reference (curated):**\n{chr(10).join(f'• {t}' for t in curated)}\n\n"
        f"**Detailed protocols:**\n{tests_raw[:1500]}\n\n"
        "Always have these tests ordered and interpreted by a qualified physician."
    )
    pairs.append(make_pair(SYSTEM_PROMPT, user_c, asst_c))

    # ── D: Treatment — generic + Jan Aushadhi ────────────────────────────
    user_d = f"What medicines are used to treat {name}? Include affordable Jan Aushadhi options."
    asst_d = (
        f"**Treatment for {name}:**\n\n"
        f"**Generic medicines:**\n{generic[:1200]}\n\n"
        f"**Affordable Jan Aushadhi (PMBJP) options:**\n{aushadhi[:800]}\n\n"
        f"{notes[:300] if notes else ''}\n\n"
        "Do not self-medicate. These medicines require a doctor's prescription and supervision."
    )
    pairs.append(make_pair(SYSTEM_PROMPT, user_d, asst_d))

    # ── E: Ayurvedic options ──────────────────────────────────────────────
    user_e = f"Are there Ayurvedic remedies for {name}?"
    asst_e = (
        f"**Ayurvedic options for {name}:**\n\n{ayurveda[:1400]}\n\n"
        "**Important:** Ayurvedic medicines are supportive/adjunct therapy. "
        "They do not replace evidence-based allopathic treatment for serious conditions. "
        "Always consult both an AYUSH practitioner and a licensed allopathic doctor."
    )
    pairs.append(make_pair(SYSTEM_PROMPT, user_e, asst_e))

    # ── F: India-specific risks ──────────────────────────────────────────
    user_f = f"What are the India-specific risk factors and complications for {name}?"
    asst_f = (
        f"**India-specific context for {name}:**\n\n{india[:800]}\n\n"
        "Understanding local epidemiology helps identify risk early. "
        "Consult a licensed doctor for personalised risk assessment."
    )
    pairs.append(make_pair(SYSTEM_PROMPT, user_f, asst_f))

    # ── G: Profile-aware analysis (2 random profiles) ────────────────────
    for profile in random.sample(SAMPLE_PROFILES, 2):
        age, pg, bmi, bmi_cat, hered = (
            profile['age'], profile['gender'],
            profile['bmi'], profile['bmi_cat'], profile['hereditary']
        )
        # Only generate if gender matches
        if gender == 'male' and pg == 'female':
            continue
        if gender == 'female' and pg == 'male':
            continue

        hered_str = fmt_list(hered) if hered else 'none'
        sym_sample = random.sample(symptoms, min(5, len(symptoms)))
        user_g = (
            f"Patient profile: Age {age}, {pg}, BMI {bmi} ({bmi_cat}), "
            f"hereditary conditions: {hered_str}.\n"
            f"Symptoms: {fmt_list(sym_sample)}.\n"
            f"Could this be {name}? What is the risk level?"
        )
        # Determine profile boost signals
        boosts = []
        if bmi >= 30:
            boosts.append(f"BMI {bmi} ({bmi_cat}) increases metabolic and cardiovascular disease risk")
        if age >= 60:
            boosts.append(f"Age {age} — senior age bracket increases risk for chronic conditions")
        if age < 12:
            boosts.append(f"Age {age} — paediatric profile: infectious and nutritional diseases more likely")
        if hered:
            boosts.append(f"Hereditary flags ({hered_str}) add +15 risk boost if linked to {name}")

        boost_text = ('\n'.join(f'• {b}' for b in boosts)) if boosts else '• No significant profile risk boosters identified'

        asst_g = (
            f"**Profile-based analysis for {name}:**\n\n"
            f"Patient: {age}yr {pg}, BMI {bmi} ({bmi_cat})\n"
            f"Symptoms presented: {fmt_list(sym_sample)}\n\n"
            f"**Risk boosters from profile:**\n{boost_text}\n\n"
            f"**Confirmation tests:**\n{chr(10).join(f'• {t}' for t in curated)}\n\n"
            f"**Key consideration:** {notes[:250] if notes else 'Seek clinical evaluation.'}\n\n"
            "This analysis is informational only. A licensed doctor must evaluate this patient."
        )
        pairs.append(make_pair(SYSTEM_PROMPT, user_g, asst_g))

    # ── H: Conversational follow-up ────────────────────────────────────────
    user_h = f"My doctor suspects {name}. What should I ask them at my next appointment?"
    asst_h = (
        f"Great questions to ask your doctor about **{name}**:\n\n"
        f"1. **Diagnosis:** Which of these tests will you order to confirm? ({', '.join(curated[:3])})\n"
        f"2. **Treatment:** Are generic medicines available? Can I get them from Jan Aushadhi stores?\n"
        f"3. **Severity:** Based on my symptoms, how advanced is this?\n"
        f"4. **Lifestyle:** What dietary and activity changes do you recommend?\n"
        f"5. **Monitoring:** How often should I follow up? What warning signs require urgent care?\n"
        f"6. **Hereditary risk:** Should my family members be screened?\n\n"
        f"**India-specific context to share with your doctor:**\n{india[:400]}\n\n"
        "Always bring a written list of your current symptoms, medications, and family history to your appointment."
    )
    pairs.append(make_pair(SYSTEM_PROMPT, user_h, asst_h))

# ── Split train / val ──────────────────────────────────────────────────────
random.shuffle(pairs)
n_val = max(50, math.floor(len(pairs) * 0.2))
val_pairs   = pairs[:n_val]
train_pairs = pairs[n_val:]

# Output paths depend on language
if LANGUAGE == 'en':
    out_dir = BASE / 'training_data'
    train_name = 'dhanwantari_train.jsonl'
    val_name   = 'dhanwantari_val.jsonl'
else:
    out_dir    = BASE / 'training_data' / 'lang' / LANGUAGE
    train_name = 'train.jsonl'
    val_name   = 'val.jsonl'

out_dir.mkdir(parents=True, exist_ok=True)

def write_jsonl(path, records):
    with open(path, 'w', encoding='utf-8') as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

write_jsonl(out_dir / train_name, train_pairs)
write_jsonl(out_dir / val_name,   val_pairs)

print(f'Total pairs generated : {len(pairs):,}')
print(f'Training pairs        : {len(train_pairs):,}')
print(f'Validation pairs      : {len(val_pairs):,}')
print(f'Output directory      : {out_dir}')
if LANGUAGE != 'en':
    print()
    print(f'Next step: translate all "gpt" (assistant) entries in the JSONL files to [{LANGUAGE}].')
    print(f'Then run:  python3 training/train.py --variant 1b --language {LANGUAGE}')
    print()
    print(f'Translation sidecar (separate from adapter):')
    print(f'  Create assets/translations/{LANGUAGE}/disease_translations.json')
    print(f'  Map every disease name, symptom name, medicine name, test name to {LANGUAGE}.')
print()
print('Sample training pair types:')
for pair_type in ('symptom', 'confirms', 'treat', 'ayurved', 'india', 'profile', 'follow'):
    count = sum(1 for p in pairs if pair_type.lower() in
                p['conversations'][1]['value'].lower()[:80])
    print(f'  [{pair_type}]: ~{count} pairs')
