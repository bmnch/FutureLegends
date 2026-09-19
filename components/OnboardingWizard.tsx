"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SyllabusOutline } from "@/lib/types";
import { AuthModal } from "@/components/AuthModal";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { SyllabusOutlineView } from "@/components/SyllabusOutlineView";

const TOTAL_STEPS = 4;

const CONTEXT_PILLS = [
  "Transit Navigation",
  "Financial Setup",
  "Local Regulations",
  "Workplace Rights",
] as const;

const LEARNING_STYLES = [
  {
    id: "text",
    label: "Text-Heavy",
    description: "Deep written guides you can skim and revisit.",
  },
  {
    id: "audio",
    label: "Interactive Audio Narrations",
    description: "Listen along while you move through each module.",
  },
  {
    id: "quiz",
    label: "Quiz-Based Learning",
    description: "Check understanding with short applied quizzes.",
  },
] as const;

const GOAL_PLACEHOLDER =
  "e.g., I am an engineering student at TMU starting a hospitality job downtown. I need to know how to navigate transit, set up my bank for payroll, and understand my workplace rights.";

type Props = {
  initialAuthRequired?: boolean;
};

type Direction = 1 | -1;

const slideVariants = {
  enter: (direction: Direction) => ({
    x: direction > 0 ? 56 : -56,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: Direction) => ({
    x: direction > 0 ? -56 : 56,
    opacity: 0,
  }),
};

function buildBrainDump(
  goal: string,
  contexts: string[],
  learningStyle: string,
): string {
  const styleLabel =
    LEARNING_STYLES.find((item) => item.id === learningStyle)?.label ??
    learningStyle;

  return [
    `Primary objective: ${goal.trim()}`,
    contexts.length
      ? `Priority focus areas: ${contexts.join(", ")}`
      : "Priority focus areas: general localized onboarding",
    `Preferred learning style: ${styleLabel}`,
  ].join("\n");
}

export function OnboardingWizard({ initialAuthRequired = false }: Props) {
  const goalId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const reduceMotion = useReducedMotion();
  const pendingCheckoutRef = useRef(false);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<Direction>(1);
  const [goal, setGoal] = useState("");
  const [contexts, setContexts] = useState<string[]>([]);
  const [learningStyle, setLearningStyle] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syllabus, setSyllabus] = useState<SyllabusOutline | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(initialAuthRequired);
  const [authenticated, setAuthenticated] = useState(false);

  const progress = Math.min(step / TOTAL_STEPS, 1) * 100;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 140)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [goal, step, autoResize]);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { authenticated?: boolean };
        if (!cancelled) setAuthenticated(Boolean(data.authenticated));
      } catch {
        if (!cancelled) setAuthenticated(false);
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setError(null);
    setStep(next);
  }

  function toggleContext(label: string) {
    setContexts((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
  }

  async function generateSyllabus() {
    if (!learningStyle) {
      setError("Select how you learn best to continue.");
      return;
    }

    const brainDump = buildBrainDump(goal, contexts, learningStyle);
    setGenerating(true);
    setError(null);
    setSyllabus(null);
    goTo(4);

    try {
      const response = await fetch("/api/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brainDump }),
      });

      const data = (await response.json()) as {
        syllabus?: SyllabusOutline;
        error?: string;
      };

      if (!response.ok || !data.syllabus) {
        throw new Error(data.error ?? "Failed to generate syllabus.");
      }

      setSyllabus({ ...data.syllabus, rawBrainDump: brainDump });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      goTo(3);
    } finally {
      setGenerating(false);
    }
  }

  async function startCheckout(options?: { skipAuthGate?: boolean }) {
    if (!syllabus) return;

    if (!authenticated && !options?.skipAuthGate) {
      pendingCheckoutRef.current = true;
      setAuthOpen(true);
      return;
    }

    setCheckoutLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus }),
      });

      const data = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (response.status === 401) {
        pendingCheckoutRef.current = true;
        setAuthenticated(false);
        setAuthOpen(true);
        setCheckoutLoading(false);
        return;
      }

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setCheckoutLoading(false);
    }
  }

  function handleAuthenticated() {
    setAuthenticated(true);
    if (pendingCheckoutRef.current) {
      pendingCheckoutRef.current = false;
      void startCheckout({ skipAuthGate: true });
    }
  }

  return (
    <>
      <AuthModal
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          pendingCheckoutRef.current = false;
        }}
        onAuthenticated={handleAuthenticated}
      />

      <div
        className="glass-panel w-full rounded-2xl bg-white/5 p-5 shadow-[0_0_40px_rgba(0,255,255,0.1)] backdrop-blur-lg sm:p-6"
        aria-busy={generating}
      >
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">
              Step {Math.min(step, TOTAL_STEPS)} of {TOTAL_STEPS}
            </p>
            <p className="font-mono text-[11px] text-violet-300/80">
              {Math.round(progress)}%
            </p>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label="Onboarding progress"
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 shadow-[0_0_16px_rgba(34,211,238,0.55)]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 120, damping: 20 }
              }
            />
          </div>
        </div>

        <div className="relative min-h-[280px] overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {step === 1 ? (
              <motion.div
                key="step-1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5 text-left"
              >
                <div>
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">
                    What is your primary objective today?
                  </h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    Dump the raw goal — city, job, school, deadlines — in your
                    own words.
                  </p>
                </div>
                <label htmlFor={goalId} className="sr-only">
                  Primary objective
                </label>
                <textarea
                  ref={textareaRef}
                  id={goalId}
                  rows={5}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={GOAL_PLACEHOLDER}
                  aria-required="true"
                  className="w-full resize-none border-0 bg-transparent px-1 py-2 text-base leading-relaxed text-white placeholder:text-neutral-500 focus:outline-none focus:ring-0"
                />
                <div className="flex justify-end border-t border-white/10 pt-4">
                  <button
                    type="button"
                    disabled={!goal.trim()}
                    onClick={() => goTo(2)}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-400 px-6 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div
                key="step-2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5 text-left"
              >
                <div>
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">
                    Let&apos;s narrow that down.
                  </h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    Toggle the themes that matter most for your situation.
                  </p>
                </div>
                <div
                  className="flex flex-wrap gap-2.5"
                  role="group"
                  aria-label="Contextual focus areas"
                >
                  {CONTEXT_PILLS.map((label) => {
                    const selected = contexts.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleContext(label)}
                        className={`rounded-full border px-4 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                          selected
                            ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                            : "border-white/10 bg-white/5 text-neutral-300 hover:border-white/25 hover:bg-white/10"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => goTo(1)}
                    className="text-sm text-neutral-400 transition hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(3)}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-400 px-6 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    Next
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 3 ? (
              <motion.div
                key="step-3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5 text-left"
              >
                <div>
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">
                    How do you learn best?
                  </h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    We&apos;ll shape the syllabus delivery around your
                    preference.
                  </p>
                </div>
                <div
                  className="grid gap-3"
                  role="radiogroup"
                  aria-label="Learning preference"
                >
                  {LEARNING_STYLES.map((option) => {
                    const selected = learningStyle === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setLearningStyle(option.id)}
                        className={`rounded-2xl border px-4 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                          selected
                            ? "border-violet-400/50 bg-violet-500/15 shadow-[0_0_24px_rgba(124,58,237,0.25)]"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20"
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
                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => goTo(2)}
                    className="text-sm text-neutral-400 transition hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!learningStyle || generating}
                    onClick={() => void generateSyllabus()}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 px-6 text-sm font-semibold text-neutral-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Generate Syllabus
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 4 ? (
              <motion.div
                key="step-4"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-6 text-left"
              >
                {generating || !syllabus ? (
                  <div>
                    <h2 className="mb-4 text-xl font-semibold text-white sm:text-2xl">
                      Building your localized curriculum…
                    </h2>
                    <SkeletonLoader />
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">
                        Aha moment
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                        Your custom syllabus is ready
                      </h2>
                    </div>
                    <SyllabusOutlineView syllabus={syllabus} />
                    <div className="flex flex-col items-center gap-3 border-t border-white/10 pt-6">
                      <button
                        type="button"
                        onClick={() => void startCheckout()}
                        disabled={checkoutLoading}
                        aria-label="Unlock and narrate full course for four dollars and ninety-nine cents"
                        className="btn-pulse-cyan inline-flex h-14 w-full max-w-md items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 px-6 text-sm font-bold tracking-wide text-neutral-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {checkoutLoading
                          ? "Redirecting to checkout…"
                          : "Unlock & Narrate Full Course - $4.99"}
                      </button>
                      <p className="text-xs text-neutral-500">
                        Sign in required · Unlocks intensive text + AI narration
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-rose-400">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
