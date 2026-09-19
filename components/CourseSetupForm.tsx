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
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import {
  PREFS_KEY,
  clearPendingCourse,
  pendingCourseKey,
  streamCourseGeneration,
  type PendingCourse,
} from "@/lib/generation-client";
import { NOT_HYDRATED, useStoredJson } from "@/lib/use-browser-storage";

const VOICE_PERSONAS = [
  { id: "professional", emoji: "🎯", label: "Straight to the point", description: "Clear and direct. Zero fluff." },
  { id: "warm", emoji: "🌱", label: "Warm and encouraging", description: "Friendly, supportive, keeps you going." },
  { id: "energetic", emoji: "⚡", label: "Upbeat and quick", description: "High energy for short focused sessions." },
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

  // Brain dump and outline saved before the Stripe redirect (see OnboardingWizard).
  const storedRaw = useStoredJson<PendingCourse>(pendingCourseKey(courseId));
  const stored = storedRaw !== NOT_HYDRATED && storedRaw && typeof storedRaw.brainDump === "string" ? storedRaw : null;

  const [editing, setEditing] = useState(false);
  const [brainDumpDraft, setBrainDumpDraft] = useState<string | null>(null);
  const [persona, setPersona] = useState<string>("warm");
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
      setError("Give us a little more to work with. A couple of sentences is plenty.");
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
        { brainDump: dump, courseId, outline: stored?.outline ?? null, voicePersona: persona },
        (ev) => setProgress((prev) => reduceProgress(prev, ev)),
        controller.signal,
      );
      clearPendingCourse(courseId);
      setPhase("done");
      router.push(`/dashboard/${result.courseId}`);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Something went sideways. Try again.");
      setPhase("form");
    }
  }

  const generating = phase !== "form";

  return (
    <form onSubmit={onSubmit} aria-busy={generating} className="glass-strong mx-auto w-full max-w-2xl rounded-4xl p-6 sm:p-9">
      <Pill tone={generating ? "sun" : "violet"} icon={<span aria-hidden="true">{generating ? "👩‍🍳" : "🎛️"}</span>}>
        {generating ? "Building your course" : "Last step"}
      </Pill>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">
        {generating ? "Give us a minute or two" : "How do you like to learn?"}
      </h1>
      <p className="mt-2 text-base font-semibold text-ink-soft">
        {generating
          ? "We are checking facts, planning modules and writing every lesson. Keep this tab open and we will take you straight in."
          : "Pick a voice and a pace. Then we build the whole thing."}
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
              <p className="mt-4 rounded-2xl bg-brand-mint-soft px-4 py-3 text-sm font-extrabold text-brand-mint-deep" role="status">
                &ldquo;{progress.complete.title}&rdquo; is ready. Opening it now...
              </p>
            ) : null}
          </motion.div>
        ) : (
          <motion.div key="form" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {pending ? (
              <div className="mt-6 rounded-3xl bg-white/80 p-5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-brand-violet-deep">
                  Your notes{pending.outline ? ` for "${pending.outline.courseTitle}"` : ""}
                </p>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-ink-soft">{pending.brainDump}</p>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mt-3 text-sm font-extrabold text-brand-ocean-deep underline decoration-2 underline-offset-2"
                >
                  Edit before we build
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <label htmlFor={brainDumpId} className="text-sm font-extrabold text-ink">
                  Your situation
                </label>
                <p className="mt-1 text-xs font-semibold text-ink-soft">
                  {stored ? "Tweak your notes. Every lesson is grounded in this." : "We could not find your notes on this device. Paste or retype them here."}
                </p>
                <textarea
                  id={brainDumpId}
                  rows={6}
                  value={brainDump}
                  onChange={(e) => setBrainDumpDraft(e.target.value)}
                  placeholder="Example: I just moved to Toronto for school and I start a serving job downtown next week. I need to figure out the TTC, get paid properly and know my rights at work."
                  className="mt-2 w-full resize-y rounded-3xl border border-line-strong bg-white px-4 py-3 text-base font-semibold leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-brand-violet focus:ring-4 focus:ring-brand-violet/15"
                />
              </div>
            )}

            <fieldset className="mt-8" aria-labelledby={personaGroupId}>
              <legend id={personaGroupId} className="text-sm font-extrabold text-ink">
                Voice
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3" role="radiogroup">
                {VOICE_PERSONAS.map((option) => {
                  const selected = persona === option.id;
                  return (
                    <motion.button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPersona(option.id)}
                      whileHover={reduceMotion ? undefined : { y: -3 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                      className={`rounded-3xl border-2 p-4 text-left transition ${
                        selected ? "border-brand-violet bg-brand-violet-soft shadow-pop" : "border-transparent bg-white/80 hover:bg-white"
                      }`}
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {option.emoji}
                      </span>
                      <span className="mt-2 block text-sm font-extrabold text-ink">{option.label}</span>
                      <span className="mt-1 block text-xs font-semibold text-ink-soft">{option.description}</span>
                    </motion.button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-8" aria-labelledby={speedGroupId}>
              <legend id={speedGroupId} className="text-sm font-extrabold text-ink">
                Listening speed
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
                      className={`min-w-20 rounded-2xl px-4 py-2.5 text-sm font-extrabold transition ${
                        selected ? "bg-ink text-white shadow-soft" : "bg-white/80 text-ink-soft hover:bg-white hover:text-ink"
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
        <p role="alert" className="mt-5 rounded-2xl bg-brand-rose-soft px-4 py-3 text-sm font-bold text-brand-rose">
          {error}
        </p>
      ) : null}

      {!generating ? (
        <Button type="submit" size="xl" className="mt-8 w-full animate-pulse-ring" trailing={<span aria-hidden="true">🚀</span>}>
          Build my course
        </Button>
      ) : null}
    </form>
  );
}
