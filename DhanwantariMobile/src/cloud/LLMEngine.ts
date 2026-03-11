/**
 * LLMEngine.ts
 *
 * Tier-aware LLM routing for DhanwantariAI.
 *
 * Routing priority (highest → lowest):
 *   1. On-device GGUF (llama.rn) — TIER_2/3 with model downloaded
 *      [stub — llama.rn not yet installed; wired for future integration]
 *   2. Network llama.cpp server  — Config.LLM_BASE_URL health check passes
 *   3. AWS Bedrock (Claude Haiku) — via BedrockEscalationHandler
 *   4. Offline pattern fallback  — offlineFallback.ts
 *
 * All paths return a string (the assistant's response).
 * Callers receive the response + the tier used, for logging / UI display.
 */

import axios from 'axios';
import {generateOfflineResponse} from '@services/offlineFallback';
import {escalateToBedrock} from './BedrockEscalationHandler';
import {Config} from '@config';
import type {ChatMessage, DiagnosisResult, UserProfile} from '@store/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LLMTier =
  | 'on_device'
  | 'local_server'
  | 'bedrock'
  | 'offline_fallback';

export interface LLMResult {
  response: string;
  tier: LLMTier;
  latencyMs: number;
}

// ─── Network llama.cpp health check ──────────────────────────────────────────

async function isLocalServerAvailable(): Promise<boolean> {
  try {
    const res = await axios.get(`${Config.LLM_BASE_URL}/health`, {
      timeout: 2000,
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

// ─── Network llama.cpp completion ────────────────────────────────────────────

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callLocalServer(
  messages: OpenAIMessage[],
): Promise<string> {
  const response = await axios.post(
    `${Config.LLM_BASE_URL}/v1/chat/completions`,
    {
      messages,
      max_tokens: 512,
      temperature: 0.7,
      stream: false,
    },
    {
      headers: {'Content-Type': 'application/json'},
      timeout: 30000,
    },
  );
  return (
    response.data?.choices?.[0]?.message?.content ??
    response.data?.content ??
    ''
  );
}

// ─── System prompt (shared across tiers) ─────────────────────────────────────

function buildSystemPrompt(profile: UserProfile | null): string {
  const ctx = profile
    ? `Patient: ${profile.firstName}, age ${profile.age}, BMI ${profile.bmi.toFixed(1)} (${profile.bmiCategory}).`
    : '';

  return (
    'You are DhanwantariAI, a clinical decision support assistant for Indian ASHA workers. ' +
    'You have knowledge of 146 common diseases, JanAushadhi medicines, Ayurvedic remedies, ' +
    'and India-specific health protocols. ' +
    ctx +
    ' Respond concisely and always recommend professional consultation for serious symptoms.'
  );
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Route a user query through the best available LLM tier.
 *
 * @param userMessage       The user's question or chat input
 * @param profile           Current user profile (for personalisation)
 * @param history           Recent conversation history (last N messages)
 * @param diagnosisResult   Optional diagnosis result for Bedrock context
 * @param preferBedrock     If true, skip local server and go to Bedrock directly
 */
export async function askLLM(
  userMessage: string,
  profile: UserProfile | null,
  history: ChatMessage[] = [],
  diagnosisResult: DiagnosisResult | null = null,
  preferBedrock = false,
): Promise<LLMResult> {
  const start = Date.now();

  // ── Tier 1: On-device GGUF (stub for future llama.rn integration) ──────────
  // TODO: Check if llama.rn model file exists on disk and load it.
  // const deviceProfile = await detectDeviceCapability();
  // if (deviceProfile.llmDownloaded && deviceProfile.tier !== 'TIER_1') { … }

  // ── Tier 2: Network llama.cpp server ───────────────────────────────────────
  if (!preferBedrock) {
    try {
      const available = await isLocalServerAvailable();
      if (available) {
        const messages: OpenAIMessage[] = [
          {role: 'system', content: buildSystemPrompt(profile)},
          // Inject last 4 messages of history for context
          ...history.slice(-4).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          {role: 'user', content: userMessage},
        ];

        const text = await callLocalServer(messages);
        if (text.trim()) {
          return {
            response: text.trim(),
            tier: 'local_server',
            latencyMs: Date.now() - start,
          };
        }
      }
    } catch (err) {
      console.warn('[LLMEngine] Local server failed:', err);
    }
  }

  // ── Tier 3: AWS Bedrock ────────────────────────────────────────────────────
  if (Config.BEDROCK_PROXY_URL) {
    try {
      const bedrockResult = await escalateToBedrock(
        userMessage,
        diagnosisResult,
        profile,
      );
      if (bedrockResult.mode !== 'unavailable') {
        return {
          response: bedrockResult.answer,
          tier: 'bedrock',
          latencyMs: Date.now() - start,
        };
      }
    } catch (err) {
      console.warn('[LLMEngine] Bedrock failed:', err);
    }
  }

  // ── Tier 4: Offline pattern fallback ──────────────────────────────────────
  const offlineResponse = generateOfflineResponse(
    userMessage,
    profile,
    history,
  );

  return {
    response: offlineResponse,
    tier: 'offline_fallback',
    latencyMs: Date.now() - start,
  };
}

/**
 * Returns a human-readable label for the LLM tier used.
 * Used for UI badges in ChatScreen.
 */
export function llmTierLabel(tier: LLMTier): string {
  switch (tier) {
    case 'on_device':
      return '🧠 On-Device AI';
    case 'local_server':
      return '💻 Local LLM Server';
    case 'bedrock':
      return '☁️ Bedrock (Claude Haiku)';
    case 'offline_fallback':
      return '📴 Offline Mode';
  }
}
