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
import { AnimatedOrbs } from "@/components/AnimatedOrbs";
import { SyllabusOutlineView } from "@/components/SyllabusOutlineView";
import { SkeletonLoader } from "@/components/SkeletonLoader";

const PLACEHOLDER =
  "e.g., I am an engineering student at TMU starting a hospitality job downtown. I need to know how to navigate transit, set up my bank for payroll, and understand my workplace rights.";

export function BrainDumpHero() {
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syllabus, setSyllabus] = useState<SyllabusOutline | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const hasTyped = text.trim().length > 0;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Please describe your situation before generating a syllabus.");
      return;
    }

    setLoading(true);
    setError(null);
    setSyllabus(null);

    try {
      const response = await fetch("/api/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brainDump: trimmed }),
      });

      const data = (await response.json()) as {
        syllabus?: SyllabusOutline;
        error?: string;
      };

      if (!response.ok || !data.syllabus) {
        throw new Error(data.error ?? "Failed to generate syllabus.");
      }

      setSyllabus({ ...data.syllabus, rawBrainDump: trimmed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
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

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setCheckoutLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="brain-dump-heading"
      className="relative isolate min-h-[100svh] w-full overflow-hidden bg-neutral-950"
    >
      <AnimatedOrbs />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col items-center justify-center px-6 py-20 text-center sm:px-8">
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 font-mono text-xs uppercase tracking-[0.32em] text-cyan-300"
        >
          CiviorAI
        </motion.p>

        <motion.h1
          id="brain-dump-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Don&apos;t search for the answer. Generate the course.
        </motion.h1>

        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="gradient-text mt-5 max-w-2xl text-base leading-relaxed sm:text-lg"
        >
          Tell us exactly what you need to master today, and our AI will build a
          localized, interactive curriculum just for you in seconds.
        </motion.p>

        <motion.form
          onSubmit={onSubmit}
          aria-busy={loading}
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="mt-10 w-full text-left"
        >
          <div className="glass-panel rounded-2xl bg-white/5 p-4 shadow-[0_0_40px_rgba(0,255,255,0.1)] backdrop-blur-lg sm:p-5">
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <SkeletonLoader />
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-4"
                >
                  <label
                    htmlFor={textareaId}
                    className="text-sm font-medium text-neutral-200"
                  >
                    Describe your situation and what you need to learn today.
                  </label>
                  <textarea
                    ref={textareaRef}
                    id={textareaId}
                    name="brainDump"
                    rows={5}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={PLACEHOLDER}
                    aria-required="true"
                    aria-invalid={Boolean(error) && !text.trim()}
                    aria-describedby={
                      error ? "brain-dump-error" : "brain-dump-hint"
                    }
                    className="w-full resize-none border-0 bg-transparent px-1 py-2 text-base leading-relaxed text-white placeholder:text-neutral-500 focus:outline-none focus:ring-0"
                  />
                  <p id="brain-dump-hint" className="text-xs text-neutral-500">
                    Tip: include city, institution, workplace, and deadlines.
                  </p>
                  <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`inline-flex h-12 items-center justify-center rounded-xl bg-cyan-400 px-6 text-sm font-semibold tracking-wide text-neutral-950 transition hover:bg-cyan-300 hover:shadow-[0_0_28px_rgba(34,211,238,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                        hasTyped ? "btn-pulse-cyan" : ""
                      }`}
                    >
                      Generate Custom Syllabus
                    </button>
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-violet-300/80">
                      Edge AI · Localized
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.form>

        {error ? (
          <p
            id="brain-dump-error"
            role="alert"
            className="mt-4 text-sm text-rose-400"
          >
            {error}
          </p>
        ) : null}

        <AnimatePresence>
          {syllabus && !loading ? (
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.5 }}
              className="mt-12 w-full space-y-8 text-left"
            >
              <SyllabusOutlineView syllabus={syllabus} />

              <div className="flex flex-col items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={checkoutLoading}
                  aria-label="Unlock and narrate full course for four dollars and ninety-nine cents"
                  className="btn-pulse-cyan inline-flex h-14 w-full max-w-md items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 px-6 text-sm font-bold tracking-wide text-neutral-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutLoading
                    ? "Redirecting to checkout…"
                    : "Unlock & Narrate Full Course - $4.99"}
                </button>
                <p className="text-xs text-neutral-500">
                  Unlocks full intensive expansion and AI voice narration.
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
