"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

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
  const personaGroupId = useId();
  const speedGroupId = useId();
  const [persona, setPersona] = useState<string>("professional");
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          voicePersona: persona,
          playbackSpeed: speed,
        }),
      });

      const data = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to start course generation.");
      }

      router.push(`/dashboard/${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="glass-panel mx-auto w-full max-w-2xl rounded-2xl bg-white/5 p-6 shadow-[0_0_40px_rgba(0,255,255,0.1)] backdrop-blur-lg sm:p-8"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">
        Post-onboarding setup
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
        Finalize your generation settings
      </h1>
      <p className="mt-2 text-sm text-neutral-400">
        These preferences shape the intensive LLM expansion and TTS narration
        before you enter the course player.
      </p>

      <fieldset className="mt-8" aria-labelledby={personaGroupId}>
        <legend
          id={personaGroupId}
          className="text-sm font-medium text-neutral-200"
        >
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
                <span className="block text-sm font-semibold text-white">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-neutral-400">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-8" aria-labelledby={speedGroupId}>
        <legend
          id={speedGroupId}
          className="text-sm font-medium text-neutral-200"
        >
          Default playback speed
        </legend>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Playback speed"
        >
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

      {error ? (
        <p role="alert" className="mt-5 text-sm text-rose-400">
          {error}
        </p>
      ) : null}

      <motion.button
        type="submit"
        disabled={loading}
        whileTap={{ scale: 0.98 }}
        className="btn-pulse-cyan mt-8 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 px-6 text-sm font-bold tracking-wide text-neutral-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Starting generation…" : "Generate My Interactive Course"}
      </motion.button>
      <p className="mt-3 text-center text-xs text-neutral-500">
        Course ID {courseId}
      </p>
    </form>
  );
}
