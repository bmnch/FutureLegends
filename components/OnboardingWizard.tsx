"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SyllabusOutline } from "@/lib/types";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { SyllabusOutlineView } from "@/components/SyllabusOutlineView";

const TOTAL_STEPS = 4;

const PRIMARY_GOALS = [
  "Hospitality Payroll",
  "Transit Navigation",
  "G2 Driving Test Prep",
  "Moving Logistics",
] as const;

const BRAIN_DUMP_PLACEHOLDER =
  "e.g., I am an engineering student at TMU starting a hospitality job downtown. I need to know how to navigate transit, set up my bank for payroll, and understand my workplace rights.";

type Props = {
  initialAuthRequired?: boolean;
  initialAuthenticated?: boolean;
};

type Direction = 1 | -1;
type AuthMode = "register" | "login";

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

function buildBrainDump(brainDump: string, primaryGoal: string): string {
  return [
    `Brain dump: ${brainDump.trim()}`,
    `Primary goal category: ${primaryGoal}`,
  ].join("\n");
}

export function OnboardingWizard({
  initialAuthRequired = false,
  initialAuthenticated = false,
}: Props) {
  const brainDumpId = useId();
  const emailId = useId();
  const passwordId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState(initialAuthRequired ? 4 : 1);
  const [direction, setDirection] = useState<Direction>(1);
  const [brainDump, setBrainDump] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syllabus, setSyllabus] = useState<SyllabusOutline | null>(null);
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const progress = Math.min(step / TOTAL_STEPS, 1) * 100;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 140)}px`;
  }, []);

  useEffect(() => {
    setAuthenticated(initialAuthenticated);
  }, [initialAuthenticated]);

  useEffect(() => {
    autoResize();
  }, [brainDump, step, autoResize]);

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

  async function generateSyllabus() {
    if (!primaryGoal) {
      setError("Select a primary goal to continue.");
      return;
    }

    const userContext = buildBrainDump(brainDump, primaryGoal);
    setGenerating(true);
    setError(null);
    setSyllabus(null);
    goTo(3);

    try {
      const response = await fetch("/api/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userContext }),
      });

      const data = (await response.json()) as {
        syllabus?: SyllabusOutline;
        error?: string;
      };

      if (!response.ok || !data.syllabus) {
        throw new Error(data.error ?? "Failed to generate syllabus.");
      }

      setSyllabus({ ...data.syllabus, rawBrainDump: userContext });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      goTo(2);
    } finally {
      setGenerating(false);
    }
  }

  async function startCheckout() {
    if (!syllabus) return;

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
        setAuthenticated(false);
        goTo(4);
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

  function onUnlockClick() {
    if (authenticated) {
      void startCheckout();
      return;
    }
    goTo(4);
  }

  async function onAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!syllabus) return;

    setAuthLoading(true);
    setError(null);

    try {
      const action = authMode === "register" ? "register" : "login";
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const rawText = await response.text();
        console.error("[auth] non-JSON response", {
          action,
          status: response.status,
          contentType,
          body: rawText.slice(0, 1000),
        });
        throw new Error(
          `Server error (${response.status}): ${
            rawText.trim().slice(0, 200) || "empty response body"
          }`,
        );
      }

      const data = (await response.json()) as {
        error?: string;
        user?: { id: string; email: string };
      };

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? "Authentication failed.");
      }

      setAuthenticated(true);
      // Auto-trigger Stripe checkout — no second confirmation click.
      await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
      setAuthLoading(false);
    }
  }

  return (
    <div
      className="glass-panel w-full rounded-2xl bg-white/5 p-5 shadow-[0_0_40px_rgba(0,255,255,0.1)] backdrop-blur-lg sm:p-6"
      aria-busy={generating || authLoading || checkoutLoading}
    >
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">
            {step <= 3 ? "Pre-onboarding" : "Account unlock"} · Step{" "}
            {Math.min(step, TOTAL_STEPS)} of {TOTAL_STEPS}
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
                  Brain dump your situation
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Describe where you are, what changed, and what you need to
                  master today.
                </p>
              </div>
              <label htmlFor={brainDumpId} className="sr-only">
                Brain dump
              </label>
              <textarea
                ref={textareaRef}
                id={brainDumpId}
                rows={5}
                value={brainDump}
                onChange={(e) => setBrainDump(e.target.value)}
                placeholder={BRAIN_DUMP_PLACEHOLDER}
                aria-required="true"
                className="w-full resize-none border-0 bg-transparent px-1 py-2 text-base leading-relaxed text-white placeholder:text-neutral-500 focus:outline-none focus:ring-0"
              />
              <div className="flex justify-end border-t border-white/10 pt-4">
                <button
                  type="button"
                  disabled={!brainDump.trim()}
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
                  What is your primary goal?
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Pick the category that best matches your immediate need so we
                  can refine the AI prompt.
                </p>
              </div>
              <div
                className="flex flex-wrap gap-2.5"
                role="radiogroup"
                aria-label="Primary goal"
              >
                {PRIMARY_GOALS.map((label) => {
                  const selected = primaryGoal === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPrimaryGoal(label)}
                      className={`rounded-full border px-4 py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
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
                  disabled={!primaryGoal || generating}
                  onClick={() => void generateSyllabus()}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 px-6 text-sm font-semibold text-neutral-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Generate Syllabus
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
                    <p className="mt-2 text-sm text-neutral-400">
                      This outline is your value reveal — unlock the full
                      narrated intensive next.
                    </p>
                  </div>
                  <SyllabusOutlineView syllabus={syllabus} />
                  <div className="flex flex-col items-center gap-3 border-t border-white/10 pt-6">
                    <button
                      type="button"
                      onClick={onUnlockClick}
                      disabled={checkoutLoading}
                      aria-label="Unlock and narrate full course for four dollars and ninety-nine cents"
                      className="btn-pulse-cyan inline-flex h-14 w-full max-w-md items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 px-6 text-sm font-bold tracking-wide text-neutral-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {checkoutLoading
                        ? "Redirecting to checkout…"
                        : "Unlock & Narrate Full Course - $4.99"}
                    </button>
                    <p className="text-xs text-neutral-500">
                      Create your account · Then Stripe checkout starts
                      automatically
                    </p>
                  </div>
                </>
              )}
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
              className="flex flex-col gap-5 text-left"
            >
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-violet-300">
                  Conversion gate
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  {authMode === "register"
                    ? "Create your CiviorAI account"
                    : "Sign in to continue"}
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  After you authenticate, checkout starts automatically — no
                  extra click.
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Account mode"
                className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/30 p-1"
              >
                {(
                  [
                    ["register", "Create account"],
                    ["login", "Sign in"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={authMode === value}
                    onClick={() => setAuthMode(value)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                      authMode === value
                        ? "bg-cyan-400 text-neutral-950"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={onAuthSubmit} className="space-y-4">
                <div>
                  <label htmlFor={emailId} className="text-sm text-neutral-300">
                    Email
                  </label>
                  <input
                    id={emailId}
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-cyan-400/50 focus:outline-none"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor={passwordId}
                    className="text-sm text-neutral-300"
                  >
                    Password
                  </label>
                  <input
                    id={passwordId}
                    type="password"
                    autoComplete={
                      authMode === "register"
                        ? "new-password"
                        : "current-password"
                    }
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-cyan-400/50 focus:outline-none"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => goTo(3)}
                    className="text-sm text-neutral-400 transition hover:text-white"
                  >
                    Back to syllabus
                  </button>
                  <button
                    type="submit"
                    disabled={authLoading || checkoutLoading}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 px-6 text-sm font-semibold text-neutral-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-60"
                  >
                    {authLoading || checkoutLoading
                      ? "Securing checkout…"
                      : authMode === "register"
                        ? "Create & Checkout"
                        : "Sign In & Checkout"}
                  </button>
                </div>
              </form>
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
  );
}
