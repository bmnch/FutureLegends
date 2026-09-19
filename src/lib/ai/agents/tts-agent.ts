import type { NarrationMeta, TtsProvider } from "@/lib/types";

/**
 * TTS Agent (documented stub)
 * ---------------------------
 * Converts a block of narration text into an audio URL. The pipeline is fully
 * wired for real audio - every text block and the per-module narration block
 * carry an `audio_url` - but this implementation deliberately returns a
 * deterministic placeholder URL so the rest of the system can be built and
 * tested without incurring TTS cost or needing object storage.
 *
 * The player detects `provider: "stub"` (and `<audio>` load errors) and falls
 * back to the browser's Web Speech API so play/pause/seek/speed controls work
 * end-to-end today.
 *
 * ## Wiring a real provider
 *
 * ### Option A - Cloudflare Workers AI · Deepgram Aura-2 (no extra vendor)
 * ```ts
 * const { env } = await getCloudflareContext({ async: true });
 * const mp3 = await env.AI.run("@cf/deepgram/aura-2-en", {
 *   text,                       // ≤ 2,000 chars per call → chunk longer text
 *   speaker: "athena",          // see Ai_Cf_Deepgram_Aura_2_En_Input["speaker"]
 *   encoding: "mp3",
 *   bit_rate: 48000,
 * });                            // returns base64 MP3 (string)
 * const bytes = Uint8Array.from(atob(mp3), (c) => c.charCodeAt(0));
 * await env.AUDIO_BUCKET.put(`tts/${hash}.mp3`, bytes, {
 *   httpMetadata: { contentType: "audio/mpeg" },
 * });
 * return { url: `${env.AUDIO_PUBLIC_BASE}/tts/${hash}.mp3`, provider: "deepgram-aura" };
 * ```
 * Requires an R2 binding (`[[r2_buckets]] binding = "AUDIO_BUCKET"`) plus a
 * public bucket domain, and `env.d.ts` additions.
 *
 * ### Option B - ElevenLabs
 * ```ts
 * const res = await fetch(
 *   `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
 *   {
 *     method: "POST",
 *     headers: {
 *       "xi-api-key": process.env.ELEVENLABS_API_KEY!,
 *       "Content-Type": "application/json",
 *     },
 *     body: JSON.stringify({
 *       text,
 *       model_id: "eleven_multilingual_v2",
 *       voice_settings: { stability: 0.5, similarity_boost: 0.75 },
 *     }),
 *   },
 * );
 * const bytes = new Uint8Array(await res.arrayBuffer());
 * // ...store in R2 exactly as in Option A and return { provider: "elevenlabs" }
 * ```
 * Map `voicePersona` → `voiceId` (professional / warm / energetic) in
 * `VOICE_MAP` below.
 *
 * Both paths should hash `text + voice` (see `stableHash`) so identical
 * narration is generated once and cached at the same URL.
 */

export type GenerateAudioOptions = {
  voicePersona?: string;
  /** Language hint for multilingual providers. */
  language?: string;
};

export type GenerateAudioResult = {
  url: string;
  provider: TtsProvider;
  meta: NarrationMeta;
};

/** Average spoken English pace ≈ 150 words per minute. */
const WORDS_PER_MINUTE = 150;

/** Persona → provider voice identifiers (fill in when wiring a real provider). */
export const VOICE_MAP: Record<string, { deepgram: string; elevenlabs: string }> = {
  professional: { deepgram: "athena", elevenlabs: "EXAVITQu4vr4xnSDxMaL" },
  warm: { deepgram: "luna", elevenlabs: "21m00Tcm4TlvDq8ikWAM" },
  energetic: { deepgram: "apollo", elevenlabs: "TxGEqnHWrfWFTfGW9XjX" },
};

const PLACEHOLDER_BASE_URL = "https://audio.civior.ai/placeholder";

/** Fast, dependency-free FNV-1a hash - stable across runs for cache keys. */
export function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function estimateDurationSec(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round((words / WORDS_PER_MINUTE) * 60));
}

/**
 * Generate (or in this stub, *reserve*) narration audio for a block of text.
 *
 * @returns A URL plus narration metadata that is persisted alongside the block.
 */
export async function generateAudio(
  text: string,
  options: GenerateAudioOptions = {},
): Promise<GenerateAudioResult> {
  const voicePersona = options.voicePersona ?? "professional";
  const normalized = text.replace(/\s+/g, " ").trim();
  const hash = stableHash(`${voicePersona}::${normalized}`);

  // STUB: deterministic dummy URL. Replace this block with Option A or B above.
  const url = `${PLACEHOLDER_BASE_URL}/${voicePersona}/${hash}.mp3`;

  return {
    url,
    provider: "stub",
    meta: {
      provider: "stub",
      voicePersona,
      estimatedDurationSec: estimateDurationSec(normalized),
      characterCount: normalized.length,
    },
  };
}
