import type { GenerationEvent, SyllabusOutline } from "@/lib/types";

export type GenerateCourseRequest = {
  brainDump: string;
  courseId?: string;
  outline?: SyllabusOutline | null;
  voicePersona?: string;
};

export type PendingCourse = {
  courseId: string;
  brainDump: string;
  outline: SyllabusOutline | null;
  savedAt: string;
};

const PENDING_KEY_PREFIX = "civior:pending-course:";

export const pendingCourseKey = (courseId: string) => PENDING_KEY_PREFIX + courseId;

/** Learner playback preferences captured on the setup page. */
export const PREFS_KEY = "civior:player-prefs";

export type PlayerPrefs = {
  voicePersona?: string;
  playbackSpeed?: number;
};

/** Persist the brain dump + outline across the Stripe redirect. */
export function savePendingCourse(pending: PendingCourse) {
  try {
    sessionStorage.setItem(PENDING_KEY_PREFIX + pending.courseId, JSON.stringify(pending));
    localStorage.setItem(PENDING_KEY_PREFIX + pending.courseId, JSON.stringify(pending));
  } catch {
    // storage unavailable — the setup page will ask for the brain dump again
  }
}

export function clearPendingCourse(courseId: string) {
  try {
    sessionStorage.removeItem(PENDING_KEY_PREFIX + courseId);
    localStorage.removeItem(PENDING_KEY_PREFIX + courseId);
  } catch {
    // ignore
  }
}

/**
 * Call `/api/generate-course` and consume its NDJSON progress stream.
 * Resolves with the final `complete` event; rejects on `error` events, HTTP
 * failures, or a dropped stream.
 */
export async function streamCourseGeneration(
  body: GenerateCourseRequest,
  onEvent: (event: GenerationEvent) => void,
  signal?: AbortSignal,
): Promise<Extract<GenerationEvent, { type: "complete" }>> {
  const response = await fetch("/api/generate-course", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let message = `Generation request failed (${response.status}).`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("The server did not return a progress stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let complete: Extract<GenerationEvent, { type: "complete" }> | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event: GenerationEvent;
    try {
      event = JSON.parse(trimmed) as GenerationEvent;
    } catch {
      return;
    }
    onEvent(event);
    if (event.type === "complete") complete = event;
    if (event.type === "error") throw new Error(event.message);
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      handleLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) handleLine(buffer);

  if (!complete) {
    throw new Error("The generation stream ended before the course was saved.");
  }
  return complete;
}
