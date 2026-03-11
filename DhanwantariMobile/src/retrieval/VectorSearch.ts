/**
 * VectorSearch.ts
 *
 * Qdrant Cloud vector-similarity search via the REST API.
 * Uses axios (already installed) — no extra native dependencies.
 *
 * Exposed functions:
 *   searchByVector(vector, collection, topK) — raw vector search
 *   searchDiseasesByVector(queryEmbedding)    — disease_symptoms collection
 *   searchMedicinesByVector(queryEmbedding)   — medicines collection
 */

import axios, {AxiosError} from 'axios';
import {Config} from '@config';
import type {VectorRecord} from '@store/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QdrantScoredPoint {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
}

interface QdrantSearchResponse {
  result: QdrantScoredPoint[];
  status: string;
  time: number;
}

// ─── Core search ─────────────────────────────────────────────────────────────

/**
 * Search a Qdrant collection with a pre-computed embedding vector.
 *
 * @param vector      384-dimensional float array (MiniLM-L6-v2 output)
 * @param collection  Qdrant collection name
 * @param topK        Maximum number of results
 */
export async function searchByVector(
  vector: number[],
  collection: string,
  topK: number = Config.VECTOR_TOP_K,
): Promise<VectorRecord[]> {
  const url = `${Config.QDRANT_URL}/collections/${collection}/points/search`;

  try {
    const response = await axios.post<QdrantSearchResponse>(
      url,
      {
        vector,
        limit: topK,
        with_payload: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': Config.QDRANT_API_KEY,
        },
        timeout: 8000,
      },
    );

    if (response.data.status !== 'ok') {
      console.warn('[VectorSearch] Qdrant returned non-ok status:', response.data.status);
      return [];
    }

    return response.data.result.map(point => ({
      id: String(point.id),
      score: point.score,
      payload: point.payload ?? {},
    }));
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response) {
      console.warn(
        '[VectorSearch] HTTP',
        axiosErr.response.status,
        collection,
        axiosErr.response.data,
      );
    } else {
      console.warn('[VectorSearch] Network error:', axiosErr.message);
    }
    return [];
  }
}

// ─── Disease collection ───────────────────────────────────────────────────────

/**
 * Search the `disease_symptoms` Qdrant collection.
 * Expected payload shape: { disease_id, disease_name, symptom_text }
 */
export async function searchDiseasesByVector(
  queryEmbedding: number[],
  topK = Config.VECTOR_TOP_K,
): Promise<VectorRecord[]> {
  return searchByVector(
    queryEmbedding,
    Config.Q_COLLECTION_DISEASE_SYMPTOMS,
    topK,
  );
}

// ─── Medicine collection ──────────────────────────────────────────────────────

/**
 * Search the `medicines` Qdrant collection.
 * Expected payload shape: { medicine_name, category, disease_ids[], description }
 */
export async function searchMedicinesByVector(
  queryEmbedding: number[],
  topK = 5,
): Promise<VectorRecord[]> {
  return searchByVector(
    queryEmbedding,
    Config.Q_COLLECTION_MEDICINES,
    topK,
  );
}

// ─── Clinical protocols collection ───────────────────────────────────────────

/**
 * Search the `clinical_protocols` Qdrant collection.
 * Expected payload shape: { protocol_name, content, referral_level, disease_ids[] }
 */
export async function searchProtocolsByVector(
  queryEmbedding: number[],
  topK = 3,
): Promise<VectorRecord[]> {
  return searchByVector(
    queryEmbedding,
    Config.Q_COLLECTION_CLINICAL_PROTOCOLS,
    topK,
  );
}

// ─── Upsert helper (for seeding) ──────────────────────────────────────────────

/**
 * Upsert a batch of vectors into a Qdrant collection.
 * Used by the sync engine to populate disease vectors from SQLite.
 */
export async function upsertVectors(
  collection: string,
  points: Array<{id: string; vector: number[]; payload: Record<string, unknown>}>,
): Promise<boolean> {
  const url = `${Config.QDRANT_URL}/collections/${collection}/points`;

  try {
    const response = await axios.put(
      url,
      {points},
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': Config.QDRANT_API_KEY,
        },
        timeout: 15000,
      },
    );
    return response.data?.status === 'ok';
  } catch (err) {
    console.warn('[VectorSearch] upsertVectors error:', (err as AxiosError).message);
    return false;
  }
}
