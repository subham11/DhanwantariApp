# DhanwantariAI — Bedrock Agent Services Technical Specification

> **Document:** Agent Services Spec v1.0  
> **Owner:** AppScale LLP · Satyam Kumar Das  
> **LLPIN:** ACP-6024 · appscale.in  
> **Last Updated:** March 2026  
> **Scope:** Two autonomous AWS Bedrock Agents for knowledge base maintenance

---

## Table of Contents

1. [Overview](#1-overview)
2. [Agent 1 — MediSync Agent (Medicine Intelligence)](#2-agent-1--medisync-agent)
3. [Agent 2 — DiseaseIntel Agent (Disease + BMI Intelligence)](#3-agent-2--diseaseintel-agent)
4. [Shared Infrastructure](#4-shared-infrastructure)
5. [Data Storage Architecture](#5-data-storage-architecture)
6. [Orchestration & Scheduling](#6-orchestration--scheduling)
7. [KB Patch Pipeline (Device Delivery)](#7-kb-patch-pipeline-device-delivery)
8. [Security & Compliance](#8-security--compliance)
9. [Observability](#9-observability)
10. [TODO & Implementation Phases](#10-todo--implementation-phases)

---

## 1. Overview

Two independent Bedrock Agents run on a scheduled basis to keep the DhanwantariAI knowledge base current. They operate entirely server-side — the mobile app receives the output as a lightweight KB patch via S3, never interacting with the agents directly.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATION LAYER                        │
│                                                                     │
│   EventBridge Scheduler                                             │
│       ├── Weekly  → MediSync Agent     (medicine lists)             │
│       └── Monthly → DiseaseIntel Agent (disease + BMI profiles)     │
│                                                                     │
│   ┌──────────────────────┐   ┌──────────────────────────────────┐  │
│   │  Agent 1             │   │  Agent 2                         │  │
│   │  MediSync Agent      │   │  DiseaseIntel Agent              │  │
│   │                      │   │                                  │  │
│   │  Sources:            │   │  Sources:                        │  │
│   │  • janaushadhi.gov   │   │  • WHO ICD-10 / ICD-11           │  │
│   │  • mohfw.gov.in      │   │  • ICMR guidelines               │  │
│   │  • ayush.gov.in      │   │  • NVBDCP / NHM                  │  │
│   │  • PMBJP PDF         │   │  • WHO BMI standards             │  │
│   │  • NLEM 2022         │   │  • ICMR BMI India cut-offs       │  │
│   │  • Himalaya/Patanjali│   │  • PubMed abstracts              │  │
│   └──────────┬───────────┘   └──────────────┬───────────────────┘  │
│              │                               │                      │
│              ▼                               ▼                      │
│        DynamoDB Tables                DynamoDB Tables               │
│        S3 JSON exports                S3 JSON exports               │
│              │                               │                      │
│              └──────────────┬────────────────┘                      │
│                             ▼                                       │
│                   KB Diff Engine (Lambda)                           │
│                   └── Compare new vs. current                       │
│                   └── Generate minimal patch                        │
│                   └── Write to S3 kb_patches/ + update manifest     │
│                             │                                       │
│                             ▼                                       │
│                   Mobile App (OTA patch pull on Wi-Fi)              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agent 1 — MediSync Agent

### 2.1 Purpose

Autonomously fetch, validate, normalise, and store the latest:
- **JanAushadhi (PMBJP)** generic medicine product basket
- **Ayurvedic medicine lists** (NLEAM, API formulary, Himalaya, Patanjali, Dabur)
- **NLEM 2022** allopathic essential medicines

Detect changes from the previous version, flag additions/removals/price changes, and publish a structured update to DynamoDB + S3.

---

### 2.2 Architecture

```
EventBridge (Weekly Sunday 02:00 IST)
        │
        ▼
Lambda Trigger → Bedrock Agent (MediSync)
        │
        ├── Action Group 1: WebFetcher
        │       ├── fetch_janaushadhi_product_pdf()
        │       ├── fetch_nlem_page()
        │       ├── fetch_ayush_nleam()
        │       ├── fetch_himalaya_products()
        │       └── fetch_patanjali_products()
        │
        ├── Action Group 2: PDFParser
        │       ├── extract_pmbjp_table()      → structured rows
        │       └── extract_nlem_table()       → structured rows
        │
        ├── Action Group 3: DataNormaliser
        │       ├── normalise_medicine_record()
        │       ├── map_to_icd10_disease()
        │       ├── validate_drug_code()
        │       └── detect_duplicates()
        │
        ├── Action Group 4: DiffEngine
        │       ├── compare_with_current_version()
        │       └── generate_change_report()
        │
        └── Action Group 5: StorageWriter
                ├── write_to_dynamodb()
                ├── write_json_to_s3()
                └── update_kb_manifest()
```

---

### 2.3 Data Sources

| # | Source | URL | Format | Frequency Change |
|---|---|---|---|---|
| 1 | **PMBJP Product Basket (Janaushadhi)** | https://janaushadhi.gov.in/Data/PMBJP%20Product.pdf | PDF table | Quarterly |
| 2 | **NLEM 2022** | https://mohfw.gov.in | PDF | Annual |
| 3 | **NLEAM (AYUSH)** | https://ayush.gov.in | PDF / HTML | Annual |
| 4 | **Ayurvedic Pharmacopoeia of India** | https://ayurveda.hu/api/API-Vol-1.pdf | PDF | Rare |
| 5 | **Himalaya Products** | https://himalayawellness.com/en/products | HTML | Monthly |
| 6 | **Patanjali Products** | https://patanjaliayurved.net | HTML | Monthly |
| 7 | **Dabur Products** | https://daburindia.com | HTML | Monthly |
| 8 | **CDSCO Licensed Drugs** | https://cdsco.gov.in | HTML search | On demand |

---

### 2.4 Bedrock Agent Definition

```json
{
  "agentName": "DhanwantariAI-MediSync-Agent",
  "description": "Fetches, validates and normalises JanAushadhi, Ayurvedic, and NLEM medicine lists. Detects changes and publishes structured updates to DynamoDB and S3.",
  "foundationModel": "anthropic.claude-3-haiku-20240307-v1:0",
  "instruction": "You are MediSync, a medical data extraction and normalisation agent for DhanwantariAI. Your job is to fetch the latest medicine lists from trusted Indian government and brand sources, extract structured records, validate them against known drug code formats, detect changes from the previous version, and store the results. Always cite the source URL and retrieval timestamp for every record. Never invent drug codes or prices — if a field is missing, mark it as null. Prioritise government sources (PMBJP, NLEM, AYUSH) over brand sources. Flag any record where the price has changed by more than 20% for manual review.",
  "idleSessionTTL": 600,
  "agentResourceRoleArn": "arn:aws:iam::ACCOUNT:role/DhanwantariMediSyncAgentRole"
}
```

---

### 2.5 Action Groups

#### Action Group 1: WebFetcher

```python
# Lambda: medisync-web-fetcher
import boto3, requests, hashlib
from datetime import datetime

def fetch_janaushadhi_product_pdf(event, context):
    """
    Fetch PMBJP product basket PDF from janaushadhi.gov.in.
    Returns: { s3_path, sha256, size_bytes, fetched_at }
    """
    url = "https://janaushadhi.gov.in/Data/PMBJP%20Product.pdf"
    response = requests.get(url, timeout=30)
    response.raise_for_status()

    sha256    = hashlib.sha256(response.content).hexdigest()
    s3_path   = f"raw/janaushadhi/pmbjp_product_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    s3_client = boto3.client('s3')
    s3_client.put_object(
        Bucket = 'dhanwantari-kb-ap-south-1',
        Key    = s3_path,
        Body   = response.content,
        Metadata = { 'source_url': url, 'sha256': sha256 },
    )
    return { 's3_path': s3_path, 'sha256': sha256,
             'size_bytes': len(response.content),
             'fetched_at': datetime.utcnow().isoformat() }


def fetch_ayush_nleam(event, context):
    """Fetch NLEAM from ayush.gov.in"""
    # ... similar pattern


def fetch_brand_products(event, context):
    """
    Fetch Himalaya / Patanjali / Dabur product pages.
    Scrapes structured product data — name, composition,
    therapeutic use, MRP, AYUSH reg number.
    """
    brands = {
        'himalaya':  'https://himalayawellness.com/en/products',
        'patanjali': 'https://patanjaliayurved.net',
        'dabur':     'https://daburindia.com',
    }
    results = {}
    for brand, url in brands.items():
        # Fetch + lightweight HTML parse
        results[brand] = scrape_product_page(url)
    return results
```

#### Action Group 2: PDFParser

```python
# Lambda: medisync-pdf-parser
import pdfplumber, boto3, json

def extract_pmbjp_table(event, context):
    """
    Extract structured rows from PMBJP PDF.
    PMBJP PDF has a table: Drug Code | Generic Name | Pack Size | MRP | Category
    Returns list of normalised medicine records.
    """
    s3_path = event['s3_path']
    pdf_bytes = s3_client.get_object(
        Bucket='dhanwantari-kb-ap-south-1', Key=s3_path
    )['Body'].read()

    records = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table[1:]:  # Skip header
                    if len(row) >= 5:
                        records.append({
                            'drug_code':    row[0],
                            'generic_name': row[1],
                            'pack_size':    row[2],
                            'mrp':          row[3],
                            'category':     row[4],
                            'source':       'PMBJP',
                            'source_url':   'https://janaushadhi.gov.in',
                        })
    return { 'records': records, 'count': len(records) }
```

#### Action Group 3: DataNormaliser

```python
# Lambda: medisync-normaliser
import re, json

MEDICINE_SCHEMA = {
    # Allopathic
    'allopathic': {
        'required': ['generic_name', 'drug_code', 'mrp', 'category', 'source'],
        'optional': ['brand_name', 'pack_size', 'dosage_form', 'strength',
                     'therapeutic_class', 'icd10_diseases', 'nlem_listed',
                     'asha_kit', 'prescription_required'],
    },
    # Ayurvedic
    'ayurvedic': {
        'required': ['product_name', 'brand', 'primary_herb', 'therapeutic_use',
                     'ayush_reg_number', 'mrp', 'source'],
        'optional': ['formulation_type', 'dosage', 'classical_reference',
                     'api_reference', 'nleam_listed', 'icd10_diseases',
                     'contraindications', 'pack_size'],
    },
}

def normalise_medicine_record(event, context):
    record   = event['record']
    med_type = event['type']  # 'allopathic' | 'ayurvedic'

    normalised = {}

    # Normalise drug name
    normalised['generic_name'] = record.get('generic_name', '').strip().title()

    # Validate PMBJP drug code format: alphanumeric, 4–8 chars
    drug_code = record.get('drug_code', '')
    normalised['drug_code'] = drug_code if re.match(r'^[A-Z0-9]{4,8}$', drug_code) else None

    # Normalise price — strip ₹ symbol, convert to float
    mrp_raw = record.get('mrp', '0')
    normalised['mrp'] = float(re.sub(r'[^\d.]', '', str(mrp_raw)) or 0)

    # Map to ICD-10 disease codes via disease_category lookup
    normalised['icd10_diseases'] = map_category_to_icd10(record.get('category', ''))

    # Source provenance
    normalised['source']       = record.get('source')
    normalised['source_url']   = record.get('source_url')
    normalised['extracted_at'] = record.get('fetched_at')
    normalised['schema_version'] = '2.0'

    return { 'normalised': normalised, 'valid': validate_required_fields(normalised, med_type) }


def detect_duplicates(event, context):
    """
    Detect duplicate records by generic_name + strength + dosage_form.
    Returns deduplication report.
    """
    records = event['records']
    seen    = {}
    dupes   = []
    unique  = []

    for r in records:
        key = f"{r.get('generic_name','').lower()}_{r.get('strength','')}_{r.get('dosage_form','')}"
        if key in seen:
            dupes.append({ 'duplicate': r, 'original_index': seen[key] })
        else:
            seen[key] = len(unique)
            unique.append(r)

    return { 'unique': unique, 'duplicates': dupes,
             'total_in': len(records), 'total_out': len(unique) }
```

#### Action Group 4: DiffEngine

```python
# Lambda: medisync-diff-engine

def compare_with_current_version(event, context):
    """
    Compare new medicine records against current DynamoDB version.
    Detect: new additions, removals, price changes, name changes.
    """
    new_records     = event['new_records']      # From this run
    current_version = fetch_current_from_dynamo()

    new_index     = { r['drug_code']: r for r in new_records if r.get('drug_code') }
    current_index = { r['drug_code']: r for r in current_version }

    additions  = []
    removals   = []
    updates    = []
    price_flags = []

    for code, record in new_index.items():
        if code not in current_index:
            additions.append(record)
        else:
            current = current_index[code]
            changes = {}

            if record['mrp'] != current['mrp']:
                pct_change = abs(record['mrp'] - current['mrp']) / max(current['mrp'], 0.01) * 100
                changes['mrp'] = { 'old': current['mrp'], 'new': record['mrp'] }
                if pct_change > 20:
                    price_flags.append({
                        'drug_code':    code,
                        'name':         record['generic_name'],
                        'pct_change':   round(pct_change, 1),
                        'old_mrp':      current['mrp'],
                        'new_mrp':      record['mrp'],
                        'flag_reason':  '>20% price change — manual review required',
                    })

            if record['generic_name'] != current['generic_name']:
                changes['generic_name'] = { 'old': current['generic_name'],
                                            'new': record['generic_name'] }
            if changes:
                updates.append({ 'drug_code': code, 'changes': changes })

    for code in current_index:
        if code not in new_index:
            removals.append(current_index[code])

    return {
        'additions':   additions,
        'removals':    removals,
        'updates':     updates,
        'price_flags': price_flags,
        'summary': {
            'total_new':       len(new_records),
            'total_current':   len(current_version),
            'added':           len(additions),
            'removed':         len(removals),
            'changed':         len(updates),
            'flags':           len(price_flags),
        }
    }
```

#### Action Group 5: StorageWriter

```python
# Lambda: medisync-storage-writer
import boto3, json
from datetime import datetime

def write_to_dynamodb(event, context):
    """
    Batch write normalised medicine records to DynamoDB.
    Table: dhanwantari-medicines
    Partition key: drug_code
    Sort key: source (PMBJP | NLEM | AYUSH | HIMALAYA | PATANJALI | DABUR)
    """
    dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
    table    = dynamodb.Table('dhanwantari-medicines')
    records  = event['records']
    version  = event['version']

    with table.batch_writer() as batch:
        for record in records:
            batch.put_item(Item={
                **record,
                'version':    version,
                'updated_at': datetime.utcnow().isoformat(),
                'ttl':        None,  # No expiry — medicines persist
            })

    return { 'written': len(records), 'table': 'dhanwantari-medicines' }


def write_json_to_s3(event, context):
    """
    Write full medicine dataset as JSON to S3 for mobile KB patches.
    Path: s3://dhanwantari-kb-ap-south-1/kb/medicines/medicines_v{version}.json
    """
    s3      = boto3.client('s3')
    version = event['version']
    payload = {
        'version':      version,
        'generated_at': datetime.utcnow().isoformat(),
        'count':        len(event['records']),
        'sources':      event['sources_used'],
        'medicines':    event['records'],
    }
    key = f"kb/medicines/medicines_v{version}.json"
    s3.put_object(
        Bucket      = 'dhanwantari-kb-ap-south-1',
        Key         = key,
        Body        = json.dumps(payload, ensure_ascii=False),
        ContentType = 'application/json',
    )
    return { 's3_path': key, 'version': version }
```

---

### 2.6 MediSync Output Schema

```typescript
// DynamoDB record: dhanwantari-medicines table

interface AllopathicMedicine {
  drug_code:            string;       // PMBJP drug code e.g. "PM0001"
  source:               string;       // 'PMBJP' | 'NLEM' | 'CDSCO'
  generic_name:         string;       // e.g. "Paracetamol"
  brand_name?:          string;
  strength?:            string;       // e.g. "500 mg"
  dosage_form?:         string;       // e.g. "Tablet"
  pack_size?:           string;       // e.g. "10 tablets"
  mrp:                  number;       // ₹ MRP
  category?:            string;       // Therapeutic category
  therapeutic_class?:   string;       // ATC code
  icd10_diseases:       string[];     // Mapped ICD-10 codes
  nlem_listed:          boolean;
  asha_kit:             boolean;      // In ASHA drug kit?
  prescription_required: boolean;
  source_url:           string;
  extracted_at:         string;       // ISO timestamp
  version:              string;       // Dataset version
  schema_version:       string;       // "2.0"
}

interface AyurvedicMedicine {
  product_id:           string;       // e.g. "AYU01001"
  source:               string;       // 'AYUSH' | 'HIMALAYA' | 'PATANJALI' | 'DABUR'
  product_name:         string;
  brand:                string;
  primary_herb:         string;       // Main active ingredient
  formulation_type?:    string;       // Churna | Vati | Asava | Lehya | Tail
  therapeutic_use:      string[];     // Health conditions
  icd10_diseases:       string[];     // Mapped ICD-10 codes
  dosage?:              string;
  classical_reference?: string;       // API/AFI reference
  api_reference?:       string;       // Ayurvedic Pharmacopoeia reference
  nleam_listed:         boolean;
  ayush_reg_number?:    string;
  mrp:                  number;
  pack_size?:           string;
  contraindications?:   string[];
  source_url:           string;
  extracted_at:         string;
  version:              string;
  schema_version:       string;
}
```

---

### 2.7 Change Report Schema

```typescript
interface MediSyncChangeReport {
  run_id:       string;       // UUID for this agent run
  run_at:       string;       // ISO timestamp
  version_from: string;       // Previous version
  version_to:   string;       // New version
  sources_used: SourceUsed[];

  summary: {
    total_medicines: number;
    allopathic:      number;
    ayurvedic:       number;
    added:           number;
    removed:         number;
    price_changed:   number;
    flagged:         number;  // Requires manual review
  };

  additions:   AllopathicMedicine[] | AyurvedicMedicine[];
  removals:    { drug_code: string; name: string; removed_at: string }[];
  price_flags: PriceFlag[];  // >20% change — manual review
  patch_s3:    string;       // S3 path to KB patch for mobile
}
```

---

## 3. Agent 2 — DiseaseIntel Agent

### 3.1 Purpose

Autonomously research, validate, and maintain a comprehensive disease intelligence database covering:

- **Disease profiles** — symptoms, risk factors, complications, referral criteria
- **BMI-based risk stratification** — India-specific BMI cut-offs (lower than WHO global)
- **Symptom-disease mappings** — trusted source-backed lift ratios
- **Epidemiological context** — India-specific prevalence, endemic regions, seasonal patterns

---

### 3.2 Architecture

```
EventBridge (Monthly 1st Sunday 03:00 IST)
        │
        ▼
Lambda Trigger → Bedrock Agent (DiseaseIntel)
        │
        ├── Action Group 1: SourceResearcher
        │       ├── fetch_who_disease_factsheet(disease)
        │       ├── fetch_icmr_guidelines(disease)
        │       ├── fetch_nvbdcp_protocol(disease)
        │       ├── fetch_nhm_asha_protocol(disease)
        │       └── fetch_pubmed_abstracts(disease, limit=5)
        │
        ├── Action Group 2: BMIRiskExtractor
        │       ├── fetch_icmr_india_bmi_standards()
        │       ├── compute_bmi_risk_thresholds(disease)
        │       └── build_bmi_disease_matrix()
        │
        ├── Action Group 3: SymptomExtractor
        │       ├── extract_symptom_list(disease, sources)
        │       ├── compute_symptom_prevalence(symptom, disease)
        │       ├── identify_red_flag_symptoms(disease)
        │       └── build_symptom_disease_matrix()
        │
        ├── Action Group 4: ProfileBuilder
        │       ├── build_disease_profile(disease)
        │       ├── validate_against_icd10()
        │       └── cross_reference_sources()
        │
        └── Action Group 5: StorageWriter
                ├── write_disease_to_dynamodb()
                ├── write_symptom_mappings_to_dynamodb()
                ├── write_bmi_matrix_to_dynamodb()
                └── write_json_exports_to_s3()
```

---

### 3.3 Data Sources

| # | Source | URL | What's Extracted |
|---|---|---|---|
| 1 | **WHO Disease Fact Sheets** | https://who.int/news-room/fact-sheets | Symptoms, risk factors, prevention, global stats |
| 2 | **ICMR Clinical Guidelines** | https://icmr.gov.in | India-specific protocols, treatment, drug regimens |
| 3 | **NVBDCP Protocols** | https://nvbdcp.gov.in | Vector-borne disease specific data |
| 4 | **NHM ASHA Training Modules** | https://nhm.gov.in | ASHA-level symptom checklists, referral criteria |
| 5 | **ICMR BMI Guidelines (India)** | https://icmr.gov.in/guidelines | India-specific BMI cut-offs (23/25/27.5 vs WHO 25/30) |
| 6 | **WHO BMI Classification** | https://who.int/tools/growth-reference-data-for-5to19-years | Global BMI reference |
| 7 | **ICD-10 / ICD-11 Browser** | https://icd.who.int/browse10 | Disease codes, hierarchy, symptoms |
| 8 | **PubMed (India-context abstracts)** | https://pubmed.ncbi.nlm.nih.gov | Symptom prevalence, comorbidity data |
| 9 | **NFHS-5 Report** | https://rchiips.org/nfhs | India-specific prevalence by state/gender/age |
| 10 | **MedlinePlus** | https://medlineplus.gov | Symptom validation, consumer-grade descriptions |

---

### 3.4 Bedrock Agent Definition

```json
{
  "agentName": "DhanwantariAI-DiseaseIntel-Agent",
  "description": "Researches and maintains a comprehensive disease intelligence database. For each disease, extracts symptoms with prevalence, BMI-based risk stratification using India-specific cut-offs, red flag criteria, epidemiological context, and ASHA referral protocols. All facts are sourced and cited.",
  "foundationModel": "anthropic.claude-3-sonnet-20240229-v1:0",
  "instruction": "You are DiseaseIntel, a medical research agent for DhanwantariAI. For each disease assigned to you, research the following from trusted government and WHO sources: (1) complete symptom list with prevalence percentages, (2) BMI-based risk stratification using ICMR India-specific cut-offs (not WHO global), (3) age and gender risk modifiers, (4) red flag symptoms requiring immediate referral, (5) India-specific epidemiological data (endemic regions, seasonal patterns, vulnerable populations), (6) comorbidity interactions. Always cite the exact source URL, document title, section, and retrieval date for every fact. Never infer or generate clinical data — only extract from verified sources. If a fact cannot be found in a trusted source, mark it as 'NOT_FOUND' rather than estimating.",
  "idleSessionTTL": 1800,
  "agentResourceRoleArn": "arn:aws:iam::ACCOUNT:role/DhanwantariDiseaseIntelAgentRole"
}
```

> **Why Claude Sonnet for DiseaseIntel vs. Haiku for MediSync?**  
> DiseaseIntel requires deep multi-source reasoning, cross-referencing, and clinical fact extraction from complex PDFs. Sonnet's larger context and stronger reasoning justifies the cost. MediSync is primarily structured data extraction — Haiku is sufficient.

---

### 3.5 Action Groups

#### Action Group 1: SourceResearcher

```python
# Lambda: diseaseintel-source-researcher
import boto3, requests, json

TRUSTED_SOURCES = {
    'who':     'https://who.int/news-room/fact-sheets/detail/{slug}',
    'icmr':    'https://icmr.gov.in/guidelines',
    'nvbdcp':  'https://nvbdcp.gov.in',
    'nhm':     'https://nhm.gov.in',
    'pubmed':  'https://pubmed.ncbi.nlm.nih.gov/?term={query}+India&filter=pubt.guideline',
    'medline': 'https://medlineplus.gov/ency/article/{id}.htm',
}

def fetch_who_disease_factsheet(event, context):
    """
    Fetch WHO fact sheet for a given disease.
    Returns: { title, url, content_sections, fetched_at }
    """
    disease_slug = event['disease_slug']  # e.g. 'dengue'
    url = TRUSTED_SOURCES['who'].format(slug=disease_slug)

    response = requests.get(url, timeout=30, headers={
        'User-Agent': 'DhanwantariAI/1.0 (AppScale LLP; health-research-bot)'
    })

    # Extract relevant sections using Claude Haiku for parsing
    bedrock = boto3.client('bedrock-runtime', region_name='ap-south-1')
    extraction = bedrock.invoke_model(
        modelId = 'anthropic.claude-3-haiku-20240307-v1:0',
        body = json.dumps({
            'anthropic_version': 'bedrock-2023-05-31',
            'max_tokens': 2000,
            'messages': [{
                'role': 'user',
                'content': f"""
Extract the following from this WHO fact sheet HTML.
Return ONLY valid JSON, no preamble.

Extract:
- symptoms: list of symptoms mentioned
- risk_factors: list of risk factors
- complications: list of complications
- who_gets_it: description of vulnerable populations
- prevention: list of prevention measures
- key_facts: list of key statistical facts

HTML content:
{response.text[:8000]}

Return format:
{{
  "symptoms": [],
  "risk_factors": [],
  "complications": [],
  "who_gets_it": "",
  "prevention": [],
  "key_facts": [],
  "source_url": "{url}",
  "source_title": ""
}}
"""
            }]
        })
    )
    return json.loads(json.loads(extraction['body'].read())['content'][0]['text'])


def fetch_pubmed_abstracts(event, context):
    """
    Fetch top 5 PubMed abstracts for disease + India context.
    Used for symptom prevalence percentages in Indian population.
    """
    disease = event['disease_name']
    base_url = (
        f"https://pubmed.ncbi.nlm.nih.gov/?term="
        f"{disease.replace(' ', '+')}+India+symptoms&"
        f"filter=pubt.clinicaltrial,pubt.guideline&format=abstract&size=5"
    )
    # Fetch + extract symptom prevalence data
    # Returns: [{ title, abstract, pmid, prevalence_data_found }]
    ...
```

#### Action Group 2: BMIRiskExtractor

```python
# Lambda: diseaseintel-bmi-extractor

# ICMR India-specific BMI cut-offs (lower than WHO global)
# Source: ICMR-INDIAB Study + Consensus Statement 2020
INDIA_BMI_CUTOFFS = {
    'underweight':    { 'range': [0,    18.5], 'label': 'Underweight' },
    'normal':         { 'range': [18.5, 23.0], 'label': 'Normal' },
    'overweight':     { 'range': [23.0, 25.0], 'label': 'Overweight (India)' },
    'obese_class_1':  { 'range': [25.0, 27.5], 'label': 'Obese Class I (India)' },
    'obese_class_2':  { 'range': [27.5, 32.5], 'label': 'Obese Class II (India)' },
    'obese_class_3':  { 'range': [32.5, 999],  'label': 'Obese Class III' },
}

# WHO global cut-offs (for reference/comparison)
WHO_BMI_CUTOFFS = {
    'underweight':    { 'range': [0,    18.5] },
    'normal':         { 'range': [18.5, 25.0] },
    'overweight':     { 'range': [25.0, 30.0] },
    'obese':          { 'range': [30.0, 999]  },
}

# Disease-BMI risk matrix
# Source: ICMR, WHO, NHM guidelines
DISEASE_BMI_RISK = {
    'hypertension': {
        'normal':         { 'risk_multiplier': 1.0, 'risk_level': 'baseline' },
        'overweight':     { 'risk_multiplier': 1.5, 'risk_level': 'elevated',
                            'source': 'ICMR Hypertension Guidelines 2020, Section 4.2' },
        'obese_class_1':  { 'risk_multiplier': 2.0, 'risk_level': 'high',
                            'source': 'ICMR Hypertension Guidelines 2020, Section 4.3' },
        'obese_class_2':  { 'risk_multiplier': 2.8, 'risk_level': 'very_high',
                            'source': 'ICMR Hypertension Guidelines 2020, Section 4.4' },
        'underweight':    { 'risk_multiplier': 0.8, 'risk_level': 'low',
                            'note': 'Underweight still at risk if malnourished' },
    },
    'type2_diabetes': {
        'normal':         { 'risk_multiplier': 1.0, 'risk_level': 'baseline' },
        'overweight':     { 'risk_multiplier': 2.2, 'risk_level': 'high',
                            'source': 'ICMR Diabetes Guidelines 2018, Section 3.1',
                            'india_note': 'Asian Indians develop diabetes at lower BMI' },
        'obese_class_1':  { 'risk_multiplier': 3.5, 'risk_level': 'very_high' },
        'obese_class_2':  { 'risk_multiplier': 5.0, 'risk_level': 'critical' },
    },
    'asthma': {
        'overweight':     { 'risk_multiplier': 1.4, 'risk_level': 'elevated',
                            'source': 'GINA 2023, Section 3.5.2' },
        'obese_class_1':  { 'risk_multiplier': 1.9, 'risk_level': 'high' },
    },
    'dengue': {
        # BMI increases severity risk, not infection risk
        'obese_class_1':  { 'risk_multiplier': 1.3, 'risk_level': 'elevated',
                            'note': 'Obese patients at higher risk of dengue haemorrhagic fever',
                            'source': 'NVBDCP Dengue Clinical Management 2021' },
    },
    'severe_anaemia': {
        'underweight':    { 'risk_multiplier': 2.0, 'risk_level': 'high',
                            'source': 'ICMR Anaemia Guidelines, Section 2.3' },
    },
    # ... all 145 diseases
}


def compute_bmi_risk_thresholds(event, context):
    """
    For a given disease, compute BMI-stratified risk levels.
    Returns structured risk matrix with India-specific cut-offs.
    """
    disease_id = event['disease_id']
    bmi_risks  = DISEASE_BMI_RISK.get(disease_id, {})

    risk_matrix = []
    for bmi_category, cutoffs in INDIA_BMI_CUTOFFS.items():
        risk_entry = bmi_risks.get(bmi_category, {
            'risk_multiplier': 1.0,
            'risk_level': 'no_specific_data',
        })
        risk_matrix.append({
            'bmi_category':    bmi_category,
            'bmi_range_india': cutoffs['range'],
            'bmi_label':       cutoffs['label'],
            'risk_multiplier': risk_entry.get('risk_multiplier', 1.0),
            'risk_level':      risk_entry.get('risk_level', 'baseline'),
            'source':          risk_entry.get('source', None),
            'india_note':      risk_entry.get('india_note', None),
        })

    return {
        'disease_id':  disease_id,
        'cutoff_standard': 'ICMR_INDIA_2020',
        'risk_matrix': risk_matrix,
    }


def build_bmi_disease_matrix(event, context):
    """
    Build the complete BMI × Disease risk matrix for all 145 diseases.
    This becomes a lookup table in the app for scoring.
    """
    diseases = event['disease_ids']
    matrix   = {}
    for disease_id in diseases:
        matrix[disease_id] = compute_bmi_risk_thresholds({ 'disease_id': disease_id }, None)
    return { 'matrix': matrix, 'disease_count': len(matrix),
             'standard': 'ICMR_INDIA_2020' }
```

#### Action Group 3: SymptomExtractor

```python
# Lambda: diseaseintel-symptom-extractor

def extract_symptom_list(event, context):
    """
    Extract structured symptom list for a disease from multiple sources.
    Computes prevalence by counting how many sources mention each symptom.
    """
    disease    = event['disease_name']
    icd10_code = event['icd10_code']
    sources    = event['source_contents']  # From SourceResearcher

    # Use Claude Sonnet for cross-source symptom extraction
    bedrock = boto3.client('bedrock-runtime', region_name='ap-south-1')
    prompt  = f"""
You are extracting symptom data for "{disease}" (ICD-10: {icd10_code}).

Sources provided:
{json.dumps(sources, indent=2)[:6000]}

Extract a comprehensive symptom list. For each symptom:
1. Canonical name (use standard medical terminology)
2. Prevalence in affected patients (%, if available in sources)
3. Specificity (is this symptom unique to this disease or common to many?)
4. Severity tier: mild | moderate | severe | red_flag
5. Source that mentions it (list source names)
6. India-specific prevalence if different from global

Return ONLY valid JSON:
{{
  "disease": "{disease}",
  "icd10": "{icd10_code}",
  "symptoms": [
    {{
      "symptom_id": "canonical snake_case name",
      "display_name": "Human readable name",
      "prevalence_pct": 85,
      "specificity": "high|medium|low",
      "severity_tier": "mild|moderate|severe|red_flag",
      "india_prevalence_pct": null,
      "sources": ["WHO", "ICMR"],
      "notes": ""
    }}
  ],
  "core_symptoms": ["symptom_ids of the 3-5 most defining symptoms"],
  "red_flag_symptoms": ["symptom_ids that require immediate referral"]
}}
"""
    response = bedrock.invoke_model(
        modelId = 'anthropic.claude-3-sonnet-20240229-v1:0',
        body    = json.dumps({
            'anthropic_version': 'bedrock-2023-05-31',
            'max_tokens': 4000,
            'messages': [{ 'role': 'user', 'content': prompt }],
        })
    )
    result_text = json.loads(response['body'].read())['content'][0]['text']
    return json.loads(result_text)


def compute_symptom_prevalence(event, context):
    """
    Compute lift ratio for symptom given disease.
    Lift = P(symptom | disease) / P(symptom | general population)
    Used by the on-device DiagnosisEngine scoring.
    """
    symptom_disease_prevalence = event['prevalence_pct'] / 100.0
    symptom_baseline           = event['baseline_population_prevalence'] / 100.0
    lift_ratio                 = symptom_disease_prevalence / max(symptom_baseline, 0.001)

    return {
        'disease_id':    event['disease_id'],
        'symptom_id':    event['symptom_id'],
        'lift_ratio':    round(lift_ratio, 3),
        'p_symptom_given_disease':    symptom_disease_prevalence,
        'p_symptom_baseline':         symptom_baseline,
        'source':        event.get('source'),
    }


def build_symptom_disease_matrix(event, context):
    """
    Build the full symptom × disease scoring matrix.
    This powers the DiagnosisEngine on the mobile app.
    Output: { disease_id → { symptom_id → lift_ratio } }
    """
    all_mappings = event['all_symptom_extractions']
    matrix       = {}

    for extraction in all_mappings:
        disease_id = extraction['disease_id']
        matrix[disease_id] = {}
        for symptom in extraction['symptoms']:
            lift = compute_symptom_prevalence({
                'disease_id':                   disease_id,
                'symptom_id':                   symptom['symptom_id'],
                'prevalence_pct':               symptom.get('prevalence_pct', 50),
                'baseline_population_prevalence': SYMPTOM_BASELINE.get(symptom['symptom_id'], 5),
                'source':                        symptom['sources'][0] if symptom['sources'] else None,
            }, None)
            matrix[disease_id][symptom['symptom_id']] = lift

    return {
        'matrix':        matrix,
        'disease_count': len(matrix),
        'total_mappings': sum(len(v) for v in matrix.values()),
        'standard':      'LIFT_RATIO_V2',
    }
```

#### Action Group 4: ProfileBuilder

```python
# Lambda: diseaseintel-profile-builder

def build_disease_profile(event, context):
    """
    Assemble a complete disease profile from all extracted data.
    This is the master record stored in DynamoDB.
    """
    disease_id = event['disease_id']

    profile = {
        # Identity
        'disease_id':      disease_id,
        'name_en':         event['name_en'],
        'name_hi':         event.get('name_hi'),    # Hindi
        'name_or':         event.get('name_or'),    # Odia
        'local_names':     event.get('local_names', []),  # e.g. ["peeliya", "dimagi bukhaar"]
        'icd10_codes':     event['icd10_codes'],
        'icd11_code':      event.get('icd11_code'),

        # Clinical
        'disease_category':   event['category'],    # infectious | ncd | maternal | neonatal etc.
        'symptoms':           event['symptoms'],     # From SymptomExtractor
        'core_symptoms':      event['core_symptoms'],
        'red_flag_symptoms':  event['red_flag_symptoms'],
        'complications':      event['complications'],

        # Risk stratification
        'bmi_risk_matrix':    event['bmi_risk_matrix'],     # From BMIRiskExtractor
        'age_risk': {
            '0_28_days':   event.get('risk_neonate'),
            '0_5_years':   event.get('risk_child_u5'),
            '5_12_years':  event.get('risk_child'),
            '12_18_years': event.get('risk_adolescent'),
            '18_60_years': event.get('risk_adult'),
            '60_plus':     event.get('risk_elderly'),
        },
        'gender_risk': {
            'female':           event.get('risk_female'),
            'male':             event.get('risk_male'),
            'pregnant':         event.get('risk_pregnant'),
        },
        'hereditary_risk':     event.get('hereditary_risk', False),
        'comorbidities':       event.get('comorbidities', []),

        # Epidemiology (India-specific)
        'endemic_states':      event.get('endemic_states', []),
        'seasonal_peak':       event.get('seasonal_peak'),    # 'monsoon' | 'winter' | 'year_round'
        'india_prevalence':    event.get('india_prevalence'),
        'rural_urban_split':   event.get('rural_urban_split'),

        # ASHA referral
        'asha_can_manage':     event.get('asha_can_manage', False),
        'referral_level':      event.get('referral_level'), # ASHA | PHC | CHC | HOSPITAL
        'referral_criteria':   event.get('referral_criteria', []),

        # Medicine references
        'nlem_medicines':      event.get('nlem_medicines', []),
        'janaushadhi_medicines': event.get('janaushadhi_medicines', []),
        'ayurvedic_medicines': event.get('ayurvedic_medicines', []),

        # Provenance
        'sources': event['sources_cited'],
        'validated_by':  None,    # Set by Clinical Advisory Board review
        'validated_at':  None,
        'version':       event['version'],
        'updated_at':    datetime.utcnow().isoformat(),
        'next_review':   compute_next_review_date(event['category']),
        'schema_version': '3.0',
    }

    return profile
```

---

### 3.6 DiseaseIntel Output Schema

```typescript
// DynamoDB record: dhanwantari-diseases table

interface DiseaseProfile {
  disease_id:       string;           // e.g. "D001"
  name_en:          string;
  name_hi?:         string;           // Hindi name
  name_or?:         string;           // Odia name
  local_names:      string[];         // ["peeliya", "miyadi bukhaar"]
  icd10_codes:      string[];
  icd11_code?:      string;
  disease_category: DiseaseCategory;

  symptoms: SymptomRecord[];
  core_symptoms:    string[];         // 3–5 most defining symptom IDs
  red_flag_symptoms: string[];

  bmi_risk_matrix: BMIRiskEntry[];    // India-specific (ICMR 2020)
  age_risk:        AgeRiskMatrix;
  gender_risk:     GenderRiskMatrix;
  hereditary_risk: boolean;
  comorbidities:   string[];

  endemic_states:  string[];          // e.g. ["Odisha", "West Bengal", "Jharkhand"]
  seasonal_peak:   SeasonalPattern;
  india_prevalence: PrevalenceData;

  asha_can_manage: boolean;
  referral_level:  ReferralLevel;
  referral_criteria: string[];

  nlem_medicines:        string[];    // Drug codes
  janaushadhi_medicines: string[];
  ayurvedic_medicines:   string[];

  sources:          SourceCitation[];
  version:          string;
  updated_at:       string;
  next_review:      string;
  schema_version:   string;           // "3.0"
}

interface SymptomRecord {
  symptom_id:          string;
  display_name:        string;
  prevalence_pct:      number;        // % of disease cases with this symptom
  india_prevalence_pct?: number;
  specificity:         'high' | 'medium' | 'low';
  severity_tier:       'mild' | 'moderate' | 'severe' | 'red_flag';
  sources:             string[];
  lift_ratio:          number;        // P(symptom|disease) / P(symptom|general)
}

interface BMIRiskEntry {
  bmi_category:     string;           // ICMR category
  bmi_range_india:  [number, number];
  risk_multiplier:  number;           // 1.0 = baseline
  risk_level:       string;
  source:           string;
  india_note?:      string;
}
```

---

## 4. Shared Infrastructure

### 4.1 IAM Roles

```yaml
# MediSync Agent Role
DhanwantariMediSyncAgentRole:
  Policies:
    - s3:GetObject, s3:PutObject       # dhanwantari-kb-ap-south-1 bucket
    - dynamodb:BatchWriteItem           # dhanwantari-medicines table
    - dynamodb:GetItem, dynamodb:Query  # Read current version
    - bedrock:InvokeModel               # Claude Haiku (parsing lambdas)
    - secretsmanager:GetSecretValue     # Qdrant API key
    - logs:CreateLogGroup               # CloudWatch
    - ses:SendEmail                     # Price flag alerts

# DiseaseIntel Agent Role
DhanwantariDiseaseIntelAgentRole:
  Policies:
    - s3:GetObject, s3:PutObject        # dhanwantari-kb-ap-south-1 bucket
    - dynamodb:BatchWriteItem           # dhanwantari-diseases, dhanwantari-symptoms
    - dynamodb:GetItem, dynamodb:Query  # Read current profiles
    - bedrock:InvokeModel               # Claude Sonnet (research lambdas)
    - logs:CreateLogGroup
    - ses:SendEmail                     # Validation alerts
```

### 4.2 Lambda Configuration

| Lambda | Memory | Timeout | Notes |
|---|---|---|---|
| `medisync-web-fetcher` | 256 MB | 60s | External HTTP calls |
| `medisync-pdf-parser` | 512 MB | 120s | pdfplumber in memory |
| `medisync-normaliser` | 256 MB | 30s | CPU-only |
| `medisync-diff-engine` | 512 MB | 60s | DynamoDB reads |
| `medisync-storage-writer` | 256 MB | 60s | DynamoDB batch write |
| `diseaseintel-source-researcher` | 512 MB | 120s | Bedrock + HTTP |
| `diseaseintel-bmi-extractor` | 256 MB | 30s | Computation |
| `diseaseintel-symptom-extractor` | 512 MB | 180s | Bedrock Sonnet call |
| `diseaseintel-profile-builder` | 512 MB | 60s | Assembly |
| `kb-diff-publisher` | 256 MB | 60s | S3 patch generation |

---

## 5. Data Storage Architecture

### 5.1 DynamoDB Tables

```
Table: dhanwantari-medicines
  PK: drug_code (String)
  SK: source    (String)       # 'PMBJP' | 'NLEM' | 'AYUSH' | 'HIMALAYA' etc.
  GSI1: therapeutic_class-index  (for medicine-by-class queries)
  GSI2: icd10_disease-index      (for disease → medicines queries)
  Billing: PAY_PER_REQUEST
  PITR: Enabled (point-in-time recovery — regulatory requirement)
  Encryption: AWS_OWNED_KMS

Table: dhanwantari-diseases
  PK: disease_id (String)
  SK: version    (String)       # Latest version always queryable
  GSI1: icd10_code-index
  GSI2: disease_category-index
  Billing: PAY_PER_REQUEST
  PITR: Enabled
  Encryption: AWS_OWNED_KMS

Table: dhanwantari-symptom-mappings
  PK: disease_id (String)
  SK: symptom_id (String)
  Attributes: lift_ratio, prevalence_pct, severity_tier, sources, version
  GSI1: symptom_id-index         (reverse lookup: symptom → diseases)
  Billing: PAY_PER_REQUEST
  PITR: Enabled

Table: dhanwantari-bmi-matrix
  PK: disease_id  (String)
  SK: bmi_category (String)     # ICMR BMI category
  Attributes: risk_multiplier, risk_level, source, india_note
  Billing: PAY_PER_REQUEST

Table: dhanwantari-agent-runs
  PK: agent_name (String)
  SK: run_id     (String)       # UUID
  Attributes: status, started_at, completed_at, summary, errors
  TTL: 90 days
  Billing: PAY_PER_REQUEST
```

### 5.2 S3 Bucket Structure

```
s3://dhanwantari-kb-ap-south-1/
│
├── raw/                          ← Raw fetched content (PDF, HTML)
│   ├── janaushadhi/
│   │   └── pmbjp_product_20260301.pdf
│   ├── ayush/
│   └── who/
│
├── kb/                           ← Processed knowledge base exports
│   ├── medicines/
│   │   ├── medicines_v3.1.0.json        ← Full allopathic list
│   │   └── ayurvedic_v2.2.0.json        ← Full Ayurvedic list
│   ├── diseases/
│   │   ├── disease_profiles_v3.0.0.json ← All disease profiles
│   │   └── symptom_mappings_v2.0.0.json ← Symptom × disease matrix
│   └── bmi/
│       └── bmi_risk_matrix_v1.0.0.json  ← BMI × disease risk matrix
│
├── kb_patches/                   ← Delta patches for mobile OTA
│   ├── patch_20260301_medicines.json
│   ├── patch_20260201_diseases.json
│   └── patch_20260101_symptoms.json
│
├── kb_manifest.json              ← Version registry (mobile reads this)
│
└── agent_reports/                ← Run reports for audit
    ├── medisync_20260301_run_report.json
    └── diseaseintel_20260201_run_report.json
```

### 5.3 KB Manifest (Mobile reads on Wi-Fi)

```json
{
  "kb_version": "3.2.1",
  "generated_at": "2026-03-01T03:45:00Z",
  "min_app_version": "2.0.0",
  "emergency_update": false,
  "components": {
    "medicines_allopathic": {
      "version":   "3.1.0",
      "s3_path":   "kb/medicines/medicines_v3.1.0.json",
      "sha256":    "abc123...",
      "size_kb":   1240,
      "updated_at": "2026-03-01T03:45:00Z"
    },
    "medicines_ayurvedic": {
      "version":   "2.2.0",
      "s3_path":   "kb/medicines/ayurvedic_v2.2.0.json",
      "sha256":    "def456...",
      "size_kb":   890
    },
    "disease_profiles": {
      "version":   "3.0.0",
      "s3_path":   "kb/diseases/disease_profiles_v3.0.0.json",
      "sha256":    "ghi789...",
      "size_kb":   2100
    },
    "symptom_mappings": {
      "version":   "2.0.0",
      "s3_path":   "kb/diseases/symptom_mappings_v2.0.0.json",
      "sha256":    "jkl012...",
      "size_kb":   580
    },
    "bmi_risk_matrix": {
      "version":   "1.0.0",
      "s3_path":   "kb/bmi/bmi_risk_matrix_v1.0.0.json",
      "sha256":    "mno345...",
      "size_kb":   95
    }
  }
}
```

---

## 6. Orchestration & Scheduling

### 6.1 EventBridge Rules

```yaml
# MediSync — Weekly Sunday 02:00 IST (20:30 UTC Saturday)
MediSyncWeeklyRule:
  ScheduleExpression: "cron(30 20 ? * SUN *)"
  Target:
    LambdaFunction: medisync-agent-trigger
  Description: "Weekly medicine list refresh"

# DiseaseIntel — Monthly 1st Sunday 03:00 IST (21:30 UTC)
DiseaseIntelMonthlyRule:
  ScheduleExpression: "cron(30 21 ? * 1#1 *)"
  Target:
    LambdaFunction: diseaseintel-agent-trigger
  Description: "Monthly disease profile and BMI matrix refresh"

# Emergency override — Manual trigger via SNS
EmergencyKBUpdate:
  EventPattern:
    source: ["appscale.dhanwantari"]
    detail-type: ["EmergencyKBUpdate"]
  Target:
    LambdaFunction: kb-emergency-patch-publisher
```

### 6.2 Agent Run State Machine (Step Functions)

```
MediSync State Machine:
  ┌──────────────┐
  │ FetchSources │ (parallel: 8 sources simultaneously)
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │  ParsePDFs   │
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │  Normalise   │
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │  DiffEngine  │
  └──────┬───────┘
         │
    ┌────┴─────────┐
    │              │
  Changes?       No changes
    │              │
  ┌─▼──────────┐  └── Skip to done
  │  WriteStore │
  └─┬──────────┘
    │
  ┌─▼──────────┐
  │  GenPatch   │
  └─┬──────────┘
    │
  ┌─▼──────────┐
  │  Notify     │ (SES email to AppScale + Clinical Advisory)
  └─┬──────────┘
    │
  DONE
```

---

## 7. KB Patch Pipeline (Device Delivery)

```
Lambda: kb-diff-publisher
        │
        ├── Read new S3 exports (medicines_v3.1.0.json etc.)
        ├── Read current manifest (kb_manifest.json)
        ├── Compute diff — only changed/added/removed records
        ├── Generate minimal patch JSON (< 200 KB target)
        ├── Write patch to s3://kb_patches/patch_{date}_{component}.json
        └── Update kb_manifest.json with new versions + SHA256

Mobile App (KBUpdateManager.ts)
        │
        ├── Checks kb_manifest.json on Wi-Fi (daily)
        ├── Compares component versions against local
        ├── Downloads only changed components (minimal data)
        ├── SHA-256 integrity check
        └── Atomic apply (old version preserved for rollback)
```

---

## 8. Security & Compliance

| Control | Implementation |
|---|---|
| S3 bucket policy | Private — no public access; Lambda role access only |
| DynamoDB encryption | AWS_OWNED_KMS for all tables |
| Agent execution logs | CloudWatch Logs — retained 90 days |
| PITR on all tables | Enabled — 35-day point-in-time recovery |
| Raw PDF storage | Lifecycle policy: move to Glacier after 90 days |
| Agent API keys | AWS Secrets Manager — never in Lambda env vars |
| Bedrock model access | Resource-based policy — only agent roles can invoke |
| Agent run audit | Every run logged to `dhanwantari-agent-runs` DynamoDB table |
| Price flag alerts | SES email to AppScale Clinical team — manual review required |
| Source URL validation | Whitelist of trusted domains — agent cannot fetch arbitrary URLs |

### 8.1 Trusted Source Whitelist

```python
ALLOWED_SOURCE_DOMAINS = [
    'who.int',
    'icmr.gov.in',
    'mohfw.gov.in',
    'ayush.gov.in',
    'nvbdcp.gov.in',
    'nhm.gov.in',
    'janaushadhi.gov.in',
    'pubmed.ncbi.nlm.nih.gov',
    'himalayawellness.com',
    'patanjaliayurved.net',
    'daburindia.com',
    'icd.who.int',
    'rchiips.org',       # NFHS
    'medlineplus.gov',
]
# Agent WebFetcher rejects any URL not in this whitelist
```

---

## 9. Observability

### 9.1 CloudWatch Metrics

| Metric | Namespace | Unit | Alert Threshold |
|---|---|---|---|
| `MediSync/RunDuration` | DhanwantariAgents | Seconds | > 600s |
| `MediSync/MedicinesAdded` | DhanwantariAgents | Count | > 500 (unusual spike) |
| `MediSync/PriceFlagsGenerated` | DhanwantariAgents | Count | > 0 (always notify) |
| `MediSync/SourceFetchErrors` | DhanwantariAgents | Count | > 2 |
| `DiseaseIntel/RunDuration` | DhanwantariAgents | Seconds | > 3600s |
| `DiseaseIntel/ProfilesUpdated` | DhanwantariAgents | Count | Info only |
| `DiseaseIntel/SymptomMappingsGenerated` | DhanwantariAgents | Count | Info only |
| `KBPatch/PatchSizeKB` | DhanwantariAgents | KB | > 500 KB (alert) |
| `KBPatch/MobileAdoptionRate` | DhanwantariAgents | Percent | < 50% after 7 days |

### 9.2 Alert Notifications (SES)

```
On every run completion:
  TO: satyam@appscale.in + clinical-advisory@appscale.in
  Subject: [MediSync] Weekly Run Complete — {N} changes detected
  Body: Run report with additions/removals/flags

On price flag:
  TO: satyam@appscale.in (URGENT)
  Subject: ⚠️ [MediSync] Price Flag — Manual Review Required
  Body: Flagged medicines list with % change

On agent failure:
  TO: satyam@appscale.in (CRITICAL)
  Subject: 🚨 [DhanwantariAI] Agent Run Failed: {agent_name}
  Body: Error details + CloudWatch log link
```

---

## 10. TODO & Implementation Phases

### Phase A — Infrastructure Setup

- [ ] **A1** Create S3 bucket `dhanwantari-kb-ap-south-1` (versioning enabled, no public access)
- [ ] **A2** Create 4 DynamoDB tables with PITR enabled
- [ ] **A3** Create IAM roles for both agents
- [ ] **A4** Create Secrets Manager entries for API keys
- [ ] **A5** Configure Bedrock model access policy (ap-south-1)

### Phase B — MediSync Agent

- [ ] **B1** Build `medisync-web-fetcher` Lambda (PMBJP PDF + brand HTML)
- [ ] **B2** Build `medisync-pdf-parser` Lambda (pdfplumber PMBJP + NLEM)
- [ ] **B3** Build `medisync-normaliser` Lambda (schema validation + ICD-10 mapping)
- [ ] **B4** Build `medisync-diff-engine` Lambda (change detection)
- [ ] **B5** Build `medisync-storage-writer` Lambda (DynamoDB + S3)
- [ ] **B6** Register MediSync Bedrock Agent with Claude Haiku
- [ ] **B7** Attach all action groups to Bedrock Agent
- [ ] **B8** Build Step Functions state machine for orchestration
- [ ] **B9** Configure EventBridge weekly trigger
- [ ] **B10** Build SES notification templates
- [ ] **B11** Test run with PMBJP PDF — validate output schema
- [ ] **B12** Test diff engine with synthetic version change

### Phase C — DiseaseIntel Agent

- [ ] **C1** Build `diseaseintel-source-researcher` Lambda (WHO + ICMR + PubMed)
- [ ] **C2** Build `diseaseintel-bmi-extractor` Lambda (India BMI matrix)
- [ ] **C3** Build `diseaseintel-symptom-extractor` Lambda (Claude Sonnet extraction)
- [ ] **C4** Build `diseaseintel-profile-builder` Lambda (master profile assembly)
- [ ] **C5** Build `diseaseintel-storage-writer` Lambda
- [ ] **C6** Register DiseaseIntel Bedrock Agent with Claude Sonnet
- [ ] **C7** Seed initial 31 diseases — validate against existing `disease_profiles.json`
- [ ] **C8** Build BMI × Disease matrix for all 31 diseases
- [ ] **C9** Configure EventBridge monthly trigger
- [ ] **C10** Expand to 145 diseases over 3 monthly runs

### Phase D — KB Patch Pipeline

- [ ] **D1** Build `kb-diff-publisher` Lambda
- [ ] **D2** Build `kb_manifest.json` generation
- [ ] **D3** Integrate `KBUpdateManager.ts` (mobile) with S3 manifest
- [ ] **D4** End-to-end test: agent run → S3 patch → mobile app applies patch
- [ ] **D5** Rollback test: corrupt patch → app falls back to previous version

### Phase E — Observability & Hardening

- [ ] **E1** CloudWatch dashboard for both agents
- [ ] **E2** Alert rules + SES notification templates
- [ ] **E3** Source URL whitelist enforcement
- [ ] **E4** PITR restore test (disaster recovery drill)
- [ ] **E5** Load test — 145 diseases × DiseaseIntel in single monthly run

---

*Document maintained by AppScale LLP — DhanwantariAI Project*  
*LLPIN: ACP-6024 | appscale.in | Bengaluru, India*
