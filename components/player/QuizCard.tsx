"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { splitInlineMarkdown } from "@/lib/markdown-utils";
import type { QuizBlockPayload } from "@/lib/types";

/** Renders the light inline markdown (**bold**, *italic*, `code`) the model uses in quiz copy. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {splitInlineMarkdown(text).map((part, i) => {
        switch (part.kind) {
          case "strong":
            return <strong key={i} className="font-semibold text-white">{part.value}</strong>;
          case "em":
            return <em key={i}>{part.value}</em>;
          case "code":
            return (
              <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em]">
                {part.value}
              </code>
            );
          default:
            return <span key={i}>{part.value}</span>;
        }
      })}
    </>
  );
}

type Props = {
  quiz: QuizBlockPayload;
  index: number;
  passed: boolean;
  onPass: () => void;
  onAskTutor?: (question: string) => void;
};

/**
 * Interactive glass quiz card. Selecting an option reveals its pre-generated,
 * localized feedback instantly. The card reports `onPass` only when a correct
 * option is chosen, which is what unlocks the next module.
 */
export function QuizCard({ quiz, index, passed, onPass, onAskTutor }: Props) {
  const reduceMotion = useReducedMotion();
  const groupId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const selectedOption = quiz.options.find((o) => o.id === selected) ?? null;
  const isCorrect = selectedOption?.correct === true;

  function choose(optionId: string) {
    if (passed) return;
    const option = quiz.options.find((o) => o.id === optionId);
    if (!option) return;
    setSelected(optionId);
    setAttempts((n) => n + 1);
    if (option.correct) onPass();
  }

  return (
    <motion.section
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby={`${groupId}-q`}
      className={`glass-card relative overflow-hidden rounded-3xl p-6 sm:p-7 ${
        passed
          ? "ring-1 ring-emerald-300/40 shadow-[0_0_40px_rgba(52,211,153,0.15)]"
          : "ring-1 ring-violet-400/25"
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet-300">
            Knowledge check {index + 1}
          </p>
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
              passed
                ? "bg-emerald-400/15 text-emerald-200"
                : "bg-white/5 text-neutral-400"
            }`}
          >
            {passed ? "Passed" : "Required to continue"}
          </span>
        </div>

        <h3 id={`${groupId}-q`} className="mt-3 text-lg font-semibold leading-snug text-white sm:text-xl">
          <Inline text={quiz.question} />
        </h3>

        <div role="radiogroup" aria-labelledby={`${groupId}-q`} className="mt-5 grid gap-2.5">
          {quiz.options.map((option) => {
            const isSelected = selected === option.id;
            const showState = isSelected || (passed && option.correct);
            const tone = showState
              ? option.correct
                ? "border-emerald-300/60 bg-emerald-400/10 text-white shadow-[0_0_24px_rgba(52,211,153,0.18)]"
                : "border-rose-400/60 bg-rose-500/10 text-white"
              : "border-white/10 bg-white/[0.03] text-neutral-200 hover:border-cyan-300/40 hover:bg-white/[0.06]";

            return (
              <motion.button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={passed && !option.correct}
                onClick={() => choose(option.id)}
                whileTap={reduceMotion || passed ? undefined : { scale: 0.985 }}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-default ${tone}`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] uppercase ${
                    showState
                      ? option.correct
                        ? "border-emerald-300 bg-emerald-400 text-neutral-950"
                        : "border-rose-400 bg-rose-500 text-white"
                      : "border-white/20 text-neutral-400"
                  }`}
                >
                  {option.id}
                </span>
                <span className="leading-relaxed">
                  <Inline text={option.text} />
                </span>
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {selectedOption ? (
            <motion.div
              key={selectedOption.id}
              role="status"
              aria-live="polite"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className={`mt-5 rounded-2xl border p-4 text-sm leading-relaxed ${
                isCorrect
                  ? "border-emerald-300/30 bg-emerald-400/[0.07] text-emerald-50"
                  : "border-rose-400/30 bg-rose-500/[0.07] text-rose-50"
              }`}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-80">
                {isCorrect ? "Correct — localized feedback" : "Not yet — here's why"}
              </p>
              <p className="mt-1.5">
                <Inline text={selectedOption.feedback} />
              </p>
              {isCorrect && quiz.explanation ? (
                <p className="mt-2 text-emerald-100/80">
                  <Inline text={quiz.explanation} />
                </p>
              ) : null}
              {!isCorrect ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-rose-200/70">
                    Attempt {attempts} · pick another answer to continue
                  </span>
                  {onAskTutor ? (
                    <button
                      type="button"
                      onClick={() =>
                        onAskTutor(
                          `I answered "${selectedOption.text}" to "${quiz.question}" and it was wrong. Explain the right answer using this module.`,
                        )
                      }
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-white transition hover:border-cyan-300/50 hover:text-cyan-200"
                    >
                      Ask the tutor →
                    </button>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
