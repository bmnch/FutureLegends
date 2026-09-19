"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  GenerationProgress,
  initialProgress,
  reduceProgress,
  type ProgressState,
} from "@/components/player/GenerationProgress";
import {
  PREFS_KEY,
  clearPendingCourse,
  pendingCourseKey,
  streamCourseGeneration,
  type PendingCourse,
} from "@/lib/generation-client";
import { NOT_HYDRATED, useStoredJson } from "@/lib/use-browser-storage";

const VOICE_PERSONAS = [
  {
    id: "professional",
    label: "Professional & Direct",
    description: "Clear, concise coaching with zero fluff.",
  },
  {
    id: "warm",
    label: "Warm & Encouraging",
    description: "Supportive tone that keeps momentum high.",
  },
  {
    id: "energetic",
    label: "Fast-paced & Energetic",
    description: "Upbeat delivery for quick, focused sessions.",
  },
] as const;

const PLAYBACK_SPEEDS = [1, 1.25, 1.5] as const;

type Props = {
  courseId: string;
};

export function CourseSetupForm({ courseId }: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const personaGroupId = useId();
  const speedGroupId = useId();
  const brainDumpId = useId();
  const abortRef = useRef<AbortController | null>(null);

  // Brain dump + outline saved before the Stripe redirect (see OnboardingWizard).
  const storedRaw = useStoredJson<PendingCourse>(pendingCourseKey(courseId));
  const stored =
    storedRaw !== NOT_HYDRATED && storedRaw && typeof storedRaw.brainDump === "string"
      ? storedRaw
      : null;

  const [editing, setEditing] = useState(false);
  const [brainDumpDraft, setBrainDumpDraft] = useState<string | null>(null);
  const [persona, setPersona] = useState<string>("professional");
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
  const [phase, setPhase] = useState<"form" | "generating" | "done">("form");
  const [progress, setProgress] = useState<ProgressState>(initialProgress());
  const [error, setError] = useState<string | null>(null);

  const pending = editing ? null : stored;
  const brainDump = brainDumpDraft ?? stored?.brainDump ?? "";

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dump = brainDump.trim();
    if (dump.length < 20) {
      setError("Tell us a little more — at least a couple of sentences.");
      return;
    }

    setError(null);
    setPhase("generating");
    setProgress(initialProgress());

    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ voicePersona: persona, playbackSpeed: speed }));
    } catch {
      // ignore
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamCourseGeneration(
        {
          brainDump: dump,
          courseId,
          outline: stored?.outline ?? null,
          voicePersona: persona,
        },
        (ev) => setProgress((prev) => reduceProgress(prev, ev)),
        controller.signal,
      );
      clearPendingCourse(courseId);
      setPhase("done");
      router.push(`/dashboard/${result.courseId}`);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("form");
    }
  }

  const generating = phase !== "form";

  return (
    <form
      onSubmit={onSubmit}
      aria-busy={generating}
      className="glass-panel mx-auto w-full max-w-2xl rounded-2xl bg-white/5 p-6 shadow-[0_0_40px_rgba(0,255,255,0.1)] backdrop-blur-lg sm:p-8"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">
        {generating ? "Multi-agent generation" : "Post-onboarding setup"}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {generating ? "Your agents are building the course" : "Finalize your generation settings"}
      </h1>
      <p className="mt-2 text-sm text-neutral-400">
        {generating
          ? "Research → Architect → parallel Content Agents → narration → D1. Keep this tab open; you'll be redirected automatically."
          : "These preferences shape the intensive LLM expansion and TTS narration before you enter the course player."}
      </p>

      <AnimatePresence mode="wait" initial={false}>
        {generating ? (
          <motion.div
            key="progress"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-8"
          >
            <GenerationProgress state={progress} />
            {progress.complete ? (
              <p className="mt-4 text-sm text-emerald-200" role="status">
                “{progress.complete.title}” is ready — opening your player…
              </p>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {pending ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-violet-300">
                  Your brain dump{pending.outline ? ` · outline: ${pending.outline.courseTitle}` : ""}
                </p>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
                  {pending.brainDump}
                </p>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mt-3 text-xs text-cyan-300 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-200"
                >
                  Edit before generating
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <label htmlFor={brainDumpId} className="text-sm font-medium text-neutral-200">
                  Your situation (brain dump)
                </label>
                <p className="mt-1 text-xs text-neutral-500">
                  {stored
                    ? "Refine your notes — the agents ground every module in this text."
                    : "We couldn't find your earlier notes on this device — paste or rewrite them here."}
                </p>
                <textarea
                  id={brainDumpId}
                  rows={6}
                  value={brainDump}
                  onChange={(e) => setBrainDumpDraft(e.target.value)}
                  placeholder="e.g., I am an engineering student at TMU starting a hospitality job downtown. I need to know how to navigate transit, set up my bank for payroll, and understand my workplace rights."
                  className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-600 focus:border-cyan-400/50 focus:outline-none"
                />
              </div>
            )}

            <fieldset className="mt-8" aria-labelledby={personaGroupId}>
              <legend id={personaGroupId} className="text-sm font-medium text-neutral-200">
                Voice persona
              </legend>
              <div className="mt-3 grid gap-3" role="radiogroup">
                {VOICE_PERSONAS.map((option) => {
                  const selected = persona === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPersona(option.id)}
                      className={`rounded-2xl border px-4 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                        selected
                          ? "border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.2)]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-white">{option.label}</span>
                      <span className="mt-1 block text-xs text-neutral-400">{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-8" aria-labelledby={speedGroupId}>
              <legend id={speedGroupId} className="text-sm font-medium text-neutral-200">
                Default playback speed
              </legend>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Playback speed">
                {PLAYBACK_SPEEDS.map((value) => {
                  const selected = speed === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSpeed(value)}
                      className={`min-w-20 rounded-xl border px-4 py-2.5 font-mono text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                        selected
                          ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                          : "border-white/10 text-neutral-400 hover:border-white/25"
                      }`}
                    >
                      {value}x
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <p role="alert" className="mt-5 text-sm text-rose-400">
          {error}
        </p>
      ) : null}

      {!generating ? (
        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          className="btn-pulse-cyan mt-8 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 px-6 text-sm font-bold tracking-wide text-neutral-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          Generate My Interactive Course
        </motion.button>
      ) : null}
      <p className="mt-3 text-center text-xs text-neutral-500">Course ID {courseId}</p>
    </form>
  );
}
