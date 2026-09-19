"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { splitInlineMarkdown, stripEmDashes } from "@/lib/markdown-utils";
import type { QuizBlockPayload } from "@/lib/types";
import { Pill } from "@/components/ui/Pill";

/** Renders the light inline markdown (**bold**, *italic*, `code`) the model uses in quiz copy. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {splitInlineMarkdown(stripEmDashes(text)).map((part, i) => {
        switch (part.kind) {
          case "strong":
            return (
              <strong key={i} className="font-extrabold text-ink">
                {part.value}
              </strong>
            );
          case "em":
            return <em key={i}>{part.value}</em>;
          case "code":
            return (
              <code key={i} className="rounded bg-brand-violet-soft px-1 py-0.5 font-mono text-[0.9em] text-brand-violet-deep">
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

const WRONG_NUDGES = ["Not quite. Have another go.", "Close, but no. Try again.", "Nope. One more shot."];

/**
 * Interactive quiz card. Picking an option reveals its feedback right away.
 * `onPass` fires only when a correct option is chosen, which unlocks the next module.
 */
export function QuizCard({ quiz, index, passed, onPass, onAskTutor }: Props) {
  const reduceMotion = useReducedMotion();
  const groupId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(0);

  const selectedOption = quiz.options.find((o) => o.id === selected) ?? null;
  const isCorrect = selectedOption?.correct === true;

  function choose(optionId: string) {
    if (passed) return;
    const option = quiz.options.find((o) => o.id === optionId);
    if (!option) return;
    setSelected(optionId);
    setAttempts((n) => n + 1);
    if (option.correct) onPass();
    else setShake((n) => n + 1);
  }

  return (
    <motion.section
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby={`${groupId}-q`}
      className={`relative overflow-hidden rounded-4xl p-6 shadow-soft sm:p-7 ${
        passed ? "bg-gradient-to-br from-brand-mint-soft via-white to-white ring-2 ring-brand-mint/40" : "bg-white"
      }`}
    >
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <Pill tone={passed ? "mint" : "coral"} icon={<span aria-hidden="true">{passed ? "🎉" : "🧠"}</span>}>
            Quick check {index + 1}
          </Pill>
          <span className="text-xs font-extrabold text-ink-faint">{passed ? "Nailed it" : "Unlocks the next module"}</span>
        </div>

        <h3 id={`${groupId}-q`} className="mt-4 font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
          <Inline text={quiz.question} />
        </h3>

        <motion.div
          key={shake}
          role="radiogroup"
          aria-labelledby={`${groupId}-q`}
          animate={shake && !reduceMotion ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
          transition={{ duration: 0.4 }}
          className="mt-5 grid gap-2.5"
        >
          {quiz.options.map((option) => {
            const isSelected = selected === option.id;
            const showState = isSelected || (passed && option.correct);
            const tone = showState
              ? option.correct
                ? "border-brand-mint bg-brand-mint-soft text-ink"
                : "border-brand-rose bg-brand-rose-soft text-ink"
              : "border-line-strong bg-white text-ink hover:border-brand-violet hover:bg-brand-violet-soft/40";

            return (
              <motion.button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={passed && !option.correct}
                onClick={() => choose(option.id)}
                whileHover={reduceMotion || passed ? undefined : { x: 3 }}
                whileTap={reduceMotion || passed ? undefined : { scale: 0.985 }}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-base font-semibold transition disabled:cursor-default ${tone}`}
              >
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold uppercase ${
                    showState
                      ? option.correct
                        ? "bg-brand-mint text-white"
                        : "bg-brand-rose text-white"
                      : "bg-ink/6 text-ink-soft"
                  }`}
                >
                  {showState ? (option.correct ? "✓" : "✕") : option.id}
                </span>
                <span className="leading-relaxed">
                  <Inline text={option.text} />
                </span>
              </motion.button>
            );
          })}
        </motion.div>

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
              className={`mt-5 rounded-2xl p-4 text-base font-semibold leading-relaxed ${
                isCorrect ? "bg-brand-mint-soft text-ink" : "bg-brand-rose-soft text-ink"
              }`}
            >
              <p className={`text-xs font-extrabold uppercase tracking-wider ${isCorrect ? "text-brand-mint-deep" : "text-brand-rose"}`}>
                {isCorrect ? "Yes! Here is why" : WRONG_NUDGES[(attempts - 1) % WRONG_NUDGES.length]}
              </p>
              <p className="mt-1.5">
                <Inline text={selectedOption.feedback} />
              </p>
              {isCorrect && quiz.explanation ? (
                <p className="mt-2 text-ink-soft">
                  <Inline text={quiz.explanation} />
                </p>
              ) : null}
              {!isCorrect && onAskTutor ? (
                <button
                  type="button"
                  onClick={() =>
                    onAskTutor(
                      `I answered "${selectedOption.text}" to "${quiz.question}" and it was wrong. Explain the right answer using this module.`,
                    )
                  }
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-extrabold text-brand-violet-deep shadow-soft transition hover:bg-brand-violet hover:text-white"
                >
                  Ask the tutor to explain →
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
