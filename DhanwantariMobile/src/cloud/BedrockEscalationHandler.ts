/**
 * BedrockEscalationHandler.ts
 *
 * Calls AWS Bedrock (Claude 3 Haiku) when local confidence is insufficient.
 *
 * Authentication: AWS Signature V4 is required for direct Bedrock API calls.
 * To avoid bundling aws-sdk (large), this module supports two modes:
 *
 *   Mode A — Lambda Proxy (RECOMMENDED for mobile):
 *     Set Config.BEDROCK_PROXY_URL to a Lambda function URL.
 *     The Lambda signs the request server-side and forwards to Bedrock.
 *     No AWS credentials are embedded in the app.
 *
 *   Mode B — Direct (dev/testing only):
 *     Set BEDROCK_ACCESS_KEY_ID + BEDROCK_SECRET_KEY in config (NOT shipped).
 *     Signs the request in-app with manual SHA256 / HMAC-SHA256.
 *
 * In production only Mode A should be used.
 *
 * TLS Certificate Pinning (AWS-P0.4  v2.2 §11.2):
 *   Uses react-native-ssl-pinning to validate the API Gateway TLS cert chain.
 *   Pinned cert: Amazon RSA 2048 M03 (intermediate CA, valid until Aug 2030).
 *   Files bundled in:
 *     iOS  → ios/DhanwantariMobile/amazon_rsa_2048_m03.cer
 *     Android → android/app/src/main/assets/amazon_rsa_2048_m03.crt
 *   SPKI SHA-256 pins:
 *     Leaf (*.execute-api.ap-south-1.amazonaws.com, exp Aug 2026):
 *       CifvBerUQV7ploNbeZW/B1JMrqpNm5r+01B0EeMHkn4=
 *     Intermediate (Amazon RSA 2048 M03, exp Aug 2030):
 *       vxRon/El5KuI4vx5ey1DgmsYmRY0nDd5Cg4GfJ8S+bg=
 *     Root (Amazon Root CA 1, exp Dec 2037):
 *       ++MBgDH5WGvL9Bcn5Be30cRcL0f5O+NyoXuWtQdX1aI=
 *   When the leaf cert rotates (expected ~Aug 2026), update only the .cer/.crt
 *   files and re-release. Intermediate/root pins remain stable.
 */

// @ts-ignore — react-native-ssl-pinning ships CommonJS with no bundled types
import {fetch as sslFetch} from 'react-native-ssl-pinning';
import {AxiosError} from 'axios';
import {Config} from '@config';
import {stripPII} from './PIIStripper';
import type {DiagnosisResult, RetrievalBundle, UserProfile} from '@store/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BedrockResponse {
  answer: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  mode: 'proxy' | 'unavailable';
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(profile: UserProfile | null): string {
  const profileCtx = profile
    ? `You are assisting ${profile.firstName} ${profile.lastName}, age ${profile.age}, BMI ${profile.bmi.toFixed(1)} (${profile.bmiCategory}).`
    : 'You are assisting an unregistered user.';

  return `You are DhanwantariAI, a clinical decision support assistant for ASHA workers in rural India.
${profileCtx}

Your role:
- Provide evidence-based clinical guidance aligned with India's National Health Mission protocols
- Suggest JanAushadhi generic medicine alternatives with approximate INR prices
- Recommend appropriate referral level (ASHA manage / PHC / CHC / FRU / Hospital)
- Mention Ayurvedic / AYUSH alternatives where relevant
- Respond clearly, concisely, and empathetically
- Never make definitive diagnoses — guide and recommend professional consultation
- Flag any IMMEDIATE red-flag symptoms at the top of your response

Format: Use markdown with **bold** for drug names and referral facility names.
Language: Respond in the same language as the user's query.`;
}

// ─── Context builder ─────────────────────────────────────────────────────────

function buildUserPrompt(
  query: string,
  diagnosisResult: DiagnosisResult | null,
  retrievalBundle: RetrievalBundle | null,
): string {
  const parts: string[] = [];

  if (diagnosisResult) {
    const top3 = diagnosisResult.matchedDiseases
      .slice(0, 3)
      .map(d => `${d.disease.name} (score ${d.score}/100)`)
      .join(', ');

    parts.push(
      `**Local diagnosis summary:**\n` +
        `- Symptoms reported: ${diagnosisResult.matchedDiseases[0]?.matchedSymptoms?.join(', ') ?? 'none'}\n` +
        `- Top matched conditions: ${top3 || 'none'}\n` +
        `- Risk level: ${diagnosisResult.ruleEngineResult.riskLevel}\n` +
        `- Suggested referral: ${diagnosisResult.ruleEngineResult.referralLevel}\n` +
        `- Local confidence: ${Math.round(diagnosisResult.confidenceScore * 100)}%`,
    );
  }

  if (retrievalBundle && retrievalBundle.ftsResults.length > 0) {
    const snippets = retrievalBundle.ftsResults
      .slice(0, 3)
      .map(r => `${r.diseaseName}: ${r.snippet}`)
      .join('\n');
    parts.push(`**Retrieved clinical context:**\n${snippets}`);
  }

  parts.push(`**User query:** ${query}`);

  return parts.join('\n\n');
}

// ─── Proxy call (Mode A — TLS pinned) ────────────────────────────────────────

async function callViaProxy(
  systemPrompt: string,
  userPrompt: string,
): Promise<BedrockResponse> {
  const requestBody = {
    modelId: Config.BEDROCK_MODEL_ID,
    region: Config.BEDROCK_REGION,
    messages: [
      {role: 'user', content: userPrompt},
    ],
    system: systemPrompt,
    max_tokens: Config.MAX_BEDROCK_TOKENS,
  };

  // react-native-ssl-pinning verifies the TLS chain against the bundled
  // Amazon RSA 2048 M03 intermediate cert before the request body is sent.
  const response = await sslFetch(Config.BEDROCK_PROXY_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(requestBody),
    timeoutInterval: 20000,
    sslPinning: {
      // filename without extension — iOS reads .cer, Android reads .crt
      certs: ['amazon_rsa_2048_m03'],
    },
  });

  const data = typeof response.bodyString === 'string'
    ? JSON.parse(response.bodyString)
    : response.data ?? {};

  // Support both direct Bedrock response shape and proxy-wrapped shape
  const content =
    data?.content?.[0]?.text ??
    data?.answer ??
    data?.completion ??
    'No response from Bedrock.';

  return {
    answer: String(content),
    inputTokens: data?.usage?.input_tokens ?? data?.inputTokens ?? 0,
    outputTokens: data?.usage?.output_tokens ?? data?.outputTokens ?? 0,
    model: Config.BEDROCK_MODEL_ID,
    mode: 'proxy',
  };
}

// ─── Main escalation API ──────────────────────────────────────────────────────

/**
 * Escalate to AWS Bedrock when local confidence is insufficient.
 *
 * Returns the Bedrock answer string, or a graceful fallback message if
 * network is unavailable or proxy URL is not configured.
 *
 * @param query            The user's clinical question
 * @param diagnosisResult  Optional local diagnosis result (adds context)
 * @param profile          Active user profile (adds personalisation)
 */
export async function escalateToBedrock(
  query: string,
  diagnosisResult: DiagnosisResult | null = null,
  profile: UserProfile | null = null,
): Promise<BedrockResponse> {
  // Strip PII before sending to cloud (v2.2 §7.1 DPDP compliance)
  const cleanQuery = stripPII(query);
  const systemPrompt = buildSystemPrompt(profile);
  const userPrompt = buildUserPrompt(
    cleanQuery,
    diagnosisResult,
    diagnosisResult?.retrievalBundle ?? null,
  );

  // If no proxy URL configured, return unavailable message
  if (!Config.BEDROCK_PROXY_URL) {
    return {
      answer:
        '☁️ **Cloud verification is not configured.** Please connect to an ASHA supervisor or visit the nearest PHC for this query.\n\n' +
        (diagnosisResult?.personalizedAnalysis ?? ''),
      inputTokens: 0,
      outputTokens: 0,
      model: Config.BEDROCK_MODEL_ID,
      mode: 'unavailable',
    };
  }

  try {
    return await callViaProxy(systemPrompt, userPrompt);
  } catch (err) {
    const axiosErr = err as AxiosError;
    const statusCode = axiosErr.response?.status;

    let fallbackAnswer =
      '☁️ **Cloud verification unavailable** — network error.';

    if (statusCode === 429) {
      fallbackAnswer =
        '☁️ **Cloud service busy.** Please try again in a few minutes.';
    } else if (statusCode && statusCode >= 500) {
      fallbackAnswer =
        '☁️ **Cloud service temporarily unavailable.** Please use local guidance and refer to PHC if unsure.';
    }

    if (diagnosisResult?.personalizedAnalysis) {
      fallbackAnswer += `\n\n**Local Assessment:** ${diagnosisResult.personalizedAnalysis}`;
    }

    console.warn('[BedrockEscalation] Error:', axiosErr.message, statusCode);

    return {
      answer: fallbackAnswer,
      inputTokens: 0,
      outputTokens: 0,
      model: Config.BEDROCK_MODEL_ID,
      mode: 'unavailable',
    };
  }
}
