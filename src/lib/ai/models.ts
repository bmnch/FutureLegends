/**
 * Workers AI model registry for the CiviorAI multi-agent pipeline.
 *
 * Selection verified against `@cloudflare/workers-types@5.20260919.1` (every id
 * below is a key of the `AiModels` interface) and the Workers AI catalog at
 * https://developers.cloudflare.com/workers-ai/models/ (Sep 2026).
 *
 * Rationale — highest capability first, with a graceful fallback chain so the
 * product still works on accounts that have not enabled paid-tier models:
 *
 *  1. `@cf/moonshotai/kimi-k2.6` — frontier-scale 1T-parameter MoE, 262,144
 *     token context, native structured outputs, reasoning, function calling.
 *     The most capable text model on Workers AI; used for every agent.
 *  2. `@cf/deepseek-ai/deepseek-v4-pro-0813` — high-capability reasoning model
 *     with a 1,048,576 token context window. Fallback when Kimi is unavailable,
 *     and the preferred model when the grounding context is very large.
 *  3. `@cf/openai/gpt-oss-120b` — 120B open-weight reasoning model.
 *  4. `@cf/meta/llama-3.3-70b-instruct-fp8-fast` — 70B, officially listed under
 *     Workers AI JSON Mode support and available on the free tier. Last-resort
 *     fallback so generation never hard-fails on plan restrictions.
 *
 * Embeddings:
 *  1. `@cf/qwen/qwen3-embedding-0.6b` — largest (600M-parameter) embedding
 *     model in the catalog, instruction-aware, multilingual.
 *  2. `@cf/baai/bge-m3` — 568M-parameter multilingual fallback (8,192 tokens).
 *
 * Text-to-speech (wired as a documented stub, see `agents/tts-agent.ts`):
 *  - `@cf/deepgram/aura-2-en` — Cloudflare's Deepgram Aura-2 partner model.
 */

export const TEXT_MODELS = {
  frontier: "@cf/moonshotai/kimi-k2.6",
  longContext: "@cf/deepseek-ai/deepseek-v4-pro-0813",
  reasoning120b: "@cf/openai/gpt-oss-120b",
  llama70b: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
} as const satisfies Record<string, keyof AiModels>;

export type TextModelId = (typeof TEXT_MODELS)[keyof typeof TEXT_MODELS];

/**
 * Ordered fallback chain. Every agent tries these in order and moves on when
 * a model is unavailable (plan restriction, capacity, malformed JSON, ...).
 */
export const TEXT_MODEL_CHAIN: readonly TextModelId[] = [
  TEXT_MODELS.frontier,
  TEXT_MODELS.longContext,
  TEXT_MODELS.reasoning120b,
  TEXT_MODELS.llama70b,
];

/** Lower-latency chain for interactive chat: skip the 1M-context model. */
export const CHAT_MODEL_CHAIN: readonly TextModelId[] = [
  TEXT_MODELS.frontier,
  TEXT_MODELS.reasoning120b,
  TEXT_MODELS.llama70b,
];

export const EMBEDDING_MODELS = {
  primary: "@cf/qwen/qwen3-embedding-0.6b",
  fallback: "@cf/baai/bge-m3",
} as const satisfies Record<string, keyof AiModels>;

export type EmbeddingModelId =
  (typeof EMBEDDING_MODELS)[keyof typeof EMBEDDING_MODELS];

export const EMBEDDING_MODEL_CHAIN: readonly EmbeddingModelId[] = [
  EMBEDDING_MODELS.primary,
  EMBEDDING_MODELS.fallback,
];

export const TTS_MODELS = {
  deepgramAuraEn: "@cf/deepgram/aura-2-en",
} as const satisfies Record<string, keyof AiModels>;

/** Models whose input/output follow the legacy `{ prompt|messages } → { response }` shape. */
export const LEGACY_RESPONSE_MODELS: ReadonlySet<string> = new Set([
  TEXT_MODELS.llama70b,
]);
