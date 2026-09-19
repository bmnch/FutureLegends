"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SyllabusOutline } from "@/lib/types";
import { savePendingCourse } from "@/lib/generation-client";
import type { SessionUser } from "@/lib/use-session";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { SyllabusOutlineView } from "@/components/SyllabusOutlineView";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";

const FOCUS_OPTIONS = [
  { id: "Money & work", emoji: "💸" },
  { id: "Getting around", emoji: "🚇" },
  { id: "Tests & exams", emoji: "📝" },
  { id: "Moving & housing", emoji: "🏠" },
  { id: "School life", emoji: "🎓" },
  { id: "Something else", emoji: "✨" },
] as const;

const PLACEHOLDER =
  "Example: I just moved to Toronto for school and I start a serving job downtown next week. I need to figure out the TTC, get paid properly and know my rights at work.";

type Step = 1 | 2 | 3 | 4;
type Direction = 1 | -1;
type AuthMode = "register" | "login";

type Props = {
  initialBrainDump?: string;
  user: SessionUser | null;
  onAuthenticated?: (user: SessionUser) => void;
};

const slide = {
  enter: (d: Direction) => ({ x: d > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: Direction) => ({ x: d > 0 ? -48 : 48, opacity: 0 }),
};

const STEP_LABELS = ["Your situation", "Your focus", "Your plan", "Unlock"];

function buildBrainDump(brainDump: string, focus: string, custom: string): string {
  const focusLine = focus === "Something else" && custom.trim() ? custom.trim() : focus;
  return [`Brain dump: ${brainDump.trim()}`, `Main focus: ${focusLine}`].join("\n");
}

export function OnboardingWizard({ initialBrainDump = "", user, onAuthenticated }: Props) {
  const reduceMotion = useReducedMotion();
  const brainDumpId = useId();
  const emailId = useId();
  const passwordId = useId();
  const customId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [step, setStep] = useState<Step>(initialBrainDump.trim() ? 2 : 1);
  const [direction, setDirection] = useState<Direction>(1);
  const [brainDump, setBrainDump] = useState(initialBrainDump);
  const [focus, setFocus] = useState<string>("");
  const [customFocus, setCustomFocus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [syllabus, setSyllabus] = useState<SyllabusOutline | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const authenticated = user !== null;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 150)}px`;
  }, [brainDump, step]);

  function goTo(next: Step) {
    setDirection(next > step ? 1 : -1);
    setError(null);
    setStep(next);
  }

  async function generateOutline() {
    if (!focus) {
      setError("Pick the thing that matters most so we can aim the course.");
      return;
    }
    const userContext = buildBrainDump(brainDump, focus, customFocus);
    setGenerating(true);
    setSyllabus(null);
    goTo(3);

    try {
      const response = await fetch("/api/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userContext }),
      });
      const data = (await response.json()) as { syllabus?: SyllabusOutline; error?: string };
      if (!response.ok || !data.syllabus) {
        throw new Error(data.error ?? "We could not build the outline. Try again in a moment.");
      }
      setSyllabus({ ...data.syllabus, rawBrainDump: userContext });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went sideways. Try again.");
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
      const data = (await response.json()) as { url?: string; courseId?: string; error?: string };

      if (response.status === 401) {
        goTo(4);
        setCheckoutLoading(false);
        return;
      }
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout did not start. Try again.");
      }

      // Carry the brain dump and outline across the Stripe redirect (or the
      // premium shortcut straight into /setup) so generation has context.
      if (data.courseId) {
        savePendingCourse({
          courseId: data.courseId,
          brainDump: syllabus.rawBrainDump ?? buildBrainDump(brainDump, focus, customFocus),
          outline: syllabus,
          savedAt: new Date().toISOString(),
        });
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout did not start. Try again.");
      setCheckoutLoading(false);
    }
  }

  function onUnlock() {
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
      const response = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error(`The server had a hiccup (${response.status}). Try again.`);
      }
      const data = (await response.json()) as { error?: string; user?: SessionUser };
      if (!response.ok || !data.user) {
        throw new Error(data.error ?? "We could not sign you in.");
      }
      onAuthenticated?.(data.user);
      await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not sign you in.");
      setAuthLoading(false);
    }
  }

  const busy = generating || authLoading || checkoutLoading;
  const progress = step / 4;

  return (
    <div aria-busy={busy} className="flex h-full flex-col">
      {/* Stepper */}
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const active = n === step;
          return (
            <li key={label} className="flex flex-col gap-1.5">
              <span className="h-2 overflow-hidden rounded-full bg-ink/8">
                <motion.span
                  className="block h-full rounded-full bg-brand-gradient"
                  initial={false}
                  animate={{ width: done || active ? "100%" : "0%" }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 22 }}
                />
              </span>
              <span
                className={`truncate text-[11px] font-extrabold uppercase tracking-wider ${
                  active ? "text-brand-violet-deep" : done ? "text-ink-soft" : "text-ink-faint"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <span className="sr-only" role="status">
        Step {step} of 4, {Math.round(progress * 100)} percent
      </span>

      <div className="relative min-h-[320px] flex-1">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          {step === 1 ? (
            <motion.div
              key="step-1"
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-5"
            >
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">So, what is going on?</h2>
                <p className="mt-2 text-base font-semibold text-ink-soft">
                  Where you are, what changed, what you need to handle. Messy is perfect.
                </p>
              </div>
              <label htmlFor={brainDumpId} className="sr-only">
                Your situation
              </label>
              <textarea
                ref={textareaRef}
                id={brainDumpId}
                rows={5}
                value={brainDump}
                onChange={(e) => setBrainDump(e.target.value)}
                placeholder={PLACEHOLDER}
                className="w-full resize-none rounded-3xl border border-line-strong bg-white/80 px-5 py-4 text-lg font-semibold leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-violet focus:ring-4 focus:ring-brand-violet/15"
              />
              <div className="flex justify-end">
                <Button size="lg" disabled={brainDump.trim().length < 12} onClick={() => goTo(2)} trailing={<span aria-hidden="true">→</span>}>
                  Next
                </Button>
              </div>
            </motion.div>
          ) : null}

          {step === 2 ? (
            <motion.div
              key="step-2"
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-5"
            >
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">What matters most right now?</h2>
                <p className="mt-2 text-base font-semibold text-ink-soft">
                  We will aim the whole course at this first.
                </p>
              </div>

              <div className="rounded-3xl bg-white/70 p-4 text-sm font-semibold leading-relaxed text-ink-soft">
                <span className="mr-2 font-extrabold text-brand-violet-deep">You said:</span>
                <span className="line-clamp-3">{brainDump}</span>
                <button
                  type="button"
                  onClick={() => goTo(1)}
                  className="ml-2 font-extrabold text-brand-ocean-deep underline decoration-2 underline-offset-2"
                >
                  Edit
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Main focus">
                {FOCUS_OPTIONS.map((opt) => {
                  const selected = focus === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setFocus(opt.id)}
                      whileHover={reduceMotion ? undefined : { y: -3 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                      className={`flex items-center gap-2.5 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-extrabold transition ${
                        selected
                          ? "border-brand-violet bg-brand-violet-soft text-brand-violet-deep shadow-pop"
                          : "border-transparent bg-white/80 text-ink-soft hover:bg-white"
                      }`}
                    >
                      <span aria-hidden="true" className="text-xl">{opt.emoji}</span>
                      {opt.id}
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence initial={false}>
                {focus === "Something else" ? (
                  <motion.div
                    key="custom"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <label htmlFor={customId} className="sr-only">
                      Describe your focus
                    </label>
                    <input
                      id={customId}
                      value={customFocus}
                      onChange={(e) => setCustomFocus(e.target.value)}
                      placeholder="Tell us in a few words"
                      className="w-full rounded-2xl border border-line-strong bg-white/80 px-4 py-3 text-base font-semibold text-ink outline-none focus:border-brand-violet focus:ring-4 focus:ring-brand-violet/15"
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => goTo(1)}>
                  Back
                </Button>
                <Button size="lg" disabled={!focus || generating} onClick={() => void generateOutline()} trailing={<span aria-hidden="true">🪄</span>}>
                  Build my plan
                </Button>
              </div>
            </motion.div>
          ) : null}

          {step === 3 ? (
            <motion.div
              key="step-3"
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-6"
            >
              {generating || !syllabus ? (
                <div>
                  <h2 className="font-display text-3xl font-bold text-ink">Building your plan...</h2>
                  <p className="mt-2 text-base font-semibold text-ink-soft">
                    Reading your notes, checking the local details, sketching the modules.
                  </p>
                  <div className="mt-6">
                    <SkeletonLoader />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Pill tone="mint" icon={<span aria-hidden="true">🎉</span>}>
                      Your plan is ready
                    </Pill>
                    <h2 className="mt-3 font-display text-3xl font-bold text-ink">Here is the shape of it.</h2>
                    <p className="mt-2 text-base font-semibold text-ink-soft">
                      Unlock it and we write every lesson, scenario and quiz in full, with audio and a tutor.
                    </p>
                  </div>
                  <SyllabusOutlineView syllabus={syllabus} />
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <Button
                      size="xl"
                      className="w-full animate-pulse-ring"
                      loading={checkoutLoading}
                      onClick={onUnlock}
                      trailing={<span aria-hidden="true">🚀</span>}
                    >
                      {checkoutLoading ? "Getting things ready" : "Unlock the full course"}
                    </Button>
                    <p className="text-center text-sm font-semibold text-ink-faint">
                      $4.99 one time per course. Premium members skip checkout.
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
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-5"
            >
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">
                  {authMode === "register" ? "Save it to an account" : "Welcome back"}
                </h2>
                <p className="mt-2 text-base font-semibold text-ink-soft">
                  {authMode === "register"
                    ? "Free, takes ten seconds. Then we take you straight to checkout."
                    : "Log in and we will take you straight to checkout."}
                </p>
              </div>

              <div role="tablist" aria-label="Account mode" className="grid grid-cols-2 gap-1 rounded-2xl bg-ink/6 p-1">
                {(
                  [
                    ["register", "Create account"],
                    ["login", "Log in"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={authMode === value}
                    onClick={() => setAuthMode(value)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-extrabold transition ${
                      authMode === value ? "bg-white text-ink shadow-soft" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={onAuthSubmit} className="space-y-4">
                <div>
                  <label htmlFor={emailId} className="text-sm font-extrabold text-ink">
                    Email
                  </label>
                  <input
                    id={emailId}
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5 w-full rounded-2xl border border-line-strong bg-white px-4 py-3 text-base font-semibold text-ink outline-none focus:border-brand-violet focus:ring-4 focus:ring-brand-violet/15"
                  />
                </div>
                <div>
                  <label htmlFor={passwordId} className="text-sm font-extrabold text-ink">
                    Password
                  </label>
                  <input
                    id={passwordId}
                    type="password"
                    autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="mt-1.5 w-full rounded-2xl border border-line-strong bg-white px-4 py-3 text-base font-semibold text-ink outline-none focus:border-brand-violet focus:ring-4 focus:ring-brand-violet/15"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button variant="ghost" type="button" onClick={() => goTo(3)}>
                    Back to my plan
                  </Button>
                  <Button type="submit" size="lg" loading={authLoading || checkoutLoading}>
                    {authLoading || checkoutLoading
                      ? "One sec"
                      : authMode === "register"
                        ? "Create account & unlock"
                        : "Log in & unlock"}
                  </Button>
                </div>
              </form>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error ? (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl bg-brand-rose-soft px-4 py-3 text-sm font-bold text-brand-rose"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
