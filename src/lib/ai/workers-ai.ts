import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  EMBEDDING_MODEL_CHAIN,
  LEGACY_RESPONSE_MODELS,
  TEXT_MODEL_CHAIN,
  type EmbeddingModelId,
  type TextModelId,
} from "./models";

// ---------------------------------------------------------------------------
// Binding access
// ---------------------------------------------------------------------------

export async function getAi(): Promise<Ai> {
  const { env } = await getCloudflareContext({ async: true });
  const ai = (env as CloudflareEnv).AI;
  if (!ai || typeof ai.run !== "function") {
    throw new Error("Cloudflare Workers AI binding `AI` is unavailable.");
  }
  return ai;
}

// ---------------------------------------------------------------------------
// Chat completion adapter
// ---------------------------------------------------------------------------

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type JsonSchema = Record<string, unknown>;

export type ChatOptions = {
  messages: ChatMessage[];
  /** Ordered list of models to try; defaults to the full capability chain. */
  models?: readonly TextModelId[];
  maxTokens?: number;
  temperature?: number;
  /**
   * When provided the request is sent in JSON Mode (`response_format`) and
   * the reply is parsed + returned as an object.
   */
  jsonSchema?: { name: string; schema: JsonSchema };
  /**
   * Reasoning models (Kimi K2.6, DeepSeek V4, GPT-OSS) think by default.
   * Disable for latency-sensitive calls such as interactive chat.
   */
  enableThinking?: boolean;
  /** Abort signal (e.g. client disconnected mid-stream). */
  signal?: AbortSignal;
};

export type ChatResult<T = string> = {
  model: TextModelId;
  output: T;
  /** Raw assistant text before JSON extraction (useful for diagnostics). */
  rawText: string;
  attempts: Array<{ model: TextModelId; error: string }>;
};

/**
 * Workers AI returns two different envelopes depending on the model family:
 *   - OpenAI-compatible: `{ choices: [{ message: { content } }] }`
 *   - Legacy Cloudflare:  `{ response: string | object }`
 * This normalises both into a string (or a pre-decoded object).
 */
function extractAssistantText(result: unknown): string | Record<string, unknown> {
  if (!result || typeof result !== "object") {
    throw new Error("Workers AI returned an empty result.");
  }
  const record = result as Record<string, unknown>;

  if (Array.isArray(record.choices) && record.choices.length > 0) {
    const first = record.choices[0] as Record<string, unknown>;
    const message = (first?.message ?? {}) as Record<string, unknown>;
    const content = message.content;
    if (typeof content === "string" && content.trim()) return content;
    if (content && typeof content === "object") {
      return content as Record<string, unknown>;
    }
    // Some reasoning models put the final answer in `text` when content is null.
    if (typeof first.text === "string" && first.text.trim()) return first.text;
    throw new Error("Workers AI choice had no assistant content.");
  }

  const response = record.response;
  if (typeof response === "string" && response.trim()) return response;
  if (response && typeof response === "object") {
    return response as Record<string, unknown>;
  }

  throw new Error("Workers AI response envelope was not recognised.");
}

/**
 * Robust JSON extraction: strips <think> blocks and markdown fences, then
 * falls back to the outermost `{...}` / `[...]` span.
 */
export function extractJson<T = unknown>(text: string): T {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through
  }

  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  const startCandidates = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (startCandidates.length === 0) {
    throw new Error("Model output did not contain JSON.");
  }
  const start = Math.min(...startCandidates);
  const closer = cleaned[start] === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(closer);
  if (end <= start) {
    throw new Error("Model output JSON was truncated.");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

function buildInput(model: TextModelId, options: ChatOptions): Record<string, unknown> {
  const isLegacy = LEGACY_RESPONSE_MODELS.has(model);
  const input: Record<string, unknown> = {
    messages: options.messages,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.4,
  };

  if (options.jsonSchema) {
    input.response_format = isLegacy
      ? // Legacy Cloudflare JSON Mode shape
        { type: "json_schema", json_schema: options.jsonSchema.schema }
      : // OpenAI-compatible shape (Kimi / DeepSeek / GPT-OSS)
        {
          type: "json_schema",
          json_schema: {
            name: options.jsonSchema.name,
            schema: options.jsonSchema.schema,
            strict: false,
          },
        };
  }

  if (!isLegacy && options.enableThinking === false) {
    input.chat_template_kwargs = { enable_thinking: false };
  }

  return input;
}

/**
 * Run a chat completion with automatic model fallback.
 *
 * Failure of one model (plan restriction, capacity, JSON that fails to parse)
 * transparently advances to the next model in the chain. Only when every
 * model fails is an aggregated error thrown.
 */
export async function runChat(options: ChatOptions): Promise<ChatResult<string>>;
export async function runChat<T>(
  options: ChatOptions & { jsonSchema: { name: string; schema: JsonSchema } },
): Promise<ChatResult<T>>;
export async function runChat<T>(
  options: ChatOptions,
): Promise<ChatResult<T | string>> {
  const ai = await getAi();
  const chain = options.models ?? TEXT_MODEL_CHAIN;
  const attempts: Array<{ model: TextModelId; error: string }> = [];

  for (const model of chain) {
    if (options.signal?.aborted) {
      throw new Error("Generation aborted by client.");
    }
    try {
      // The binding's overloads are keyed by model id; we build a schema-agnostic
      // OpenAI-style payload so cast through the generic signature.
      const raw = await (ai.run as unknown as (
        m: string,
        i: Record<string, unknown>,
      ) => Promise<unknown>)(model, buildInput(model, options));

      const assistant = extractAssistantText(raw);
      const rawText =
        typeof assistant === "string" ? assistant : JSON.stringify(assistant);

      if (options.jsonSchema) {
        const parsed =
          typeof assistant === "string"
            ? extractJson<T>(assistant)
            : (assistant as unknown as T);
        return { model, output: parsed, rawText, attempts };
      }

      return {
        model,
        output: rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim(),
        rawText,
        attempts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ model, error: message });
      console.warn(`[workers-ai] ${model} failed → trying next model`, message);
    }
  }

  const summary = attempts.map((a) => `${a.model}: ${a.error}`).join(" | ");
  throw new Error(`All Workers AI models failed. ${summary}`);
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export type EmbeddingResult = {
  model: EmbeddingModelId;
  vectors: number[][];
};

/**
 * Embed one or more texts with the highest-capability embedding model
 * available, falling back down the chain on failure. Vectors from a single
 * call always come from the same model, so they are directly comparable.
 */
export async function embedTexts(
  texts: string[],
  purpose: "query" | "document" = "document",
): Promise<EmbeddingResult> {
  if (texts.length === 0) return { model: EMBEDDING_MODEL_CHAIN[0], vectors: [] };

  const ai = await getAi();
  const errors: string[] = [];

  for (const model of EMBEDDING_MODEL_CHAIN) {
    try {
      const input: Record<string, unknown> =
        model === "@cf/qwen/qwen3-embedding-0.6b"
          ? purpose === "query"
            ? {
                queries: texts,
                instruction:
                  "Given a learner question, retrieve the course passage that answers it",
              }
            : { documents: texts }
          : { text: texts, truncate_inputs: true };

      const raw = (await (ai.run as unknown as (
        m: string,
        i: Record<string, unknown>,
      ) => Promise<unknown>)(model, input)) as { data?: number[][] };

      if (!raw?.data || !Array.isArray(raw.data) || raw.data.length !== texts.length) {
        throw new Error("Embedding response shape mismatch.");
      }
      return { model, vectors: raw.data };
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Embedding failed. ${errors.join(" | ")}`);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
