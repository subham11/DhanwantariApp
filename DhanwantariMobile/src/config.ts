/**
 * config.ts
 * Central application configuration.
 *
 * In production/CI, replace these values via build-time environment injection
 * (react-native-config or babel-plugin-inline-dotenv). The .env file at the
 * project root holds the source-of-truth values; this file contains fallbacks
 * and structured access.
 */

export const Config = {
  // ── Qdrant Cloud ────────────────────────────────────────────────────────
  QDRANT_URL:
    'https://46696dcb-3c39-41db-bab3-80d80027e898.eu-west-2-0.aws.cloud.qdrant.io:6333',
  QDRANT_API_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.xnl7rtHTVwDTcAYcHXBnOCgiC87H2eR6S1eH5MpNjNE',

  // Qdrant collection names
  Q_COLLECTION_DISEASE_SYMPTOMS: 'disease_symptoms',
  Q_COLLECTION_MEDICINES: 'medicines',
  Q_COLLECTION_CLINICAL_PROTOCOLS: 'clinical_protocols',

  // Embedding model dimensions (MiniLM-L6-v2, bundled TFLite)
  EMBEDDING_DIMS: 384,

  // ── AWS Bedrock ─────────────────────────────────────────────────────────
  BEDROCK_REGION: 'ap-south-1',
  BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
  // Bedrock proxy URL — Lambda proxy (AWS-P0.3) deployed 2025, ap-south-1
  // POST /escalate → DhanwantariBedrockProxy Lambda → Claude 3 Haiku
  BEDROCK_PROXY_URL:
    'https://4fx87rqhze.execute-api.ap-south-1.amazonaws.com/prod/escalate',

  // ── Local LLM (llama.rn / llama.cpp) ───────────────────────────────────
  LLM_BASE_URL: 'http://localhost:8080',

  // ── Confidence thresholds (v2.2) ────────────────────────────────────────
  /** Answer locally, no escalation */
  CONFIDENCE_HIGH: 0.85,
  /** Show answer + offer "Verify" button → Bedrock */
  CONFIDENCE_MEDIUM: 0.70,
  /** Auto-escalate to Bedrock */
  CONFIDENCE_AUTO_ESCALATE: 0.55,
  /** Very low confidence — show low-confidence disclaimer */
  CONFIDENCE_VERY_LOW: 0.40,
  /** Zero retrieval — immediate Bedrock escalation */
  CONFIDENCE_NONE: 0.0,

  // ── Misc ────────────────────────────────────────────────────────────────
  VECTOR_TOP_K: 5,
  FTS5_MAX_RESULTS: 10,
  MAX_BEDROCK_TOKENS: 512,
} as const;
