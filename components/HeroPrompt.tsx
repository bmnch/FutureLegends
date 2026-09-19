"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";

const EXAMPLES = [
  "I just moved to Toronto for school and I have no idea how the TTC works.",
  "I start a serving job downtown next week. How does payroll and tipping work in Ontario?",
  "My G2 road test is in 12 days. What do I actually need to know?",
  "First apartment. Help me understand leases, deposits and what my landlord can ask for.",
  "I am a TMU engineering student juggling labs, a part time job and rent.",
];

const QUICK_STARTS = [
  { label: "🚇 Transit in a new city", text: "I just moved to a new city and I need to get around by transit for school and work. Help me understand fares, passes and planning a commute." },
  { label: "💸 First real paycheque", text: "I am starting my first job with a real paycheque. Help me understand payroll deductions, direct deposit, tips and my basic rights at work." },
  { label: "🚗 Driving test prep", text: "My driving road test is coming up in two weeks. Help me prepare for what examiners look for and the mistakes people make." },
  { label: "🏠 Renting for the first time", text: "I am signing my first lease. Help me understand deposits, what a landlord can ask for, and how to avoid getting ripped off." },
];

type Props = {
  onStart: (brainDump: string) => void;
};

export function HeroPrompt({ onStart }: Props) {
  const reduceMotion = useReducedMotion();
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  // Rotate the placeholder examples while the field is empty.
  useEffect(() => {
    if (value || focused) return;
    const timer = setInterval(() => setExampleIndex((i) => (i + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(timer);
  }, [value, focused]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 64)}px`;
  }, [value]);

  const ready = value.trim().length >= 12;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!ready) {
      textareaRef.current?.focus();
      return;
    }
    onStart(value.trim());
  }

  return (
    <form onSubmit={submit} className="w-full">
      <motion.div
        animate={
          focused
            ? { boxShadow: "0 30px 80px -30px rgba(123,108,246,0.55)", y: -2 }
            : { boxShadow: "0 20px 60px -30px rgba(43,35,66,0.25)", y: 0 }
        }
        transition={{ duration: 0.3 }}
        className="glass-strong relative rounded-4xl p-3 text-left sm:p-4"
      >
        <label htmlFor={id} className="px-3 pt-1 text-sm font-extrabold tracking-wide text-brand-violet-deep">
          What do you want to learn today?
        </label>

        <div className="relative">
          <textarea
            ref={textareaRef}
            id={id}
            name="brainDump"
            value={value}
            rows={2}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) submit();
            }}
            aria-describedby={`${id}-hint`}
            className="relative z-10 w-full resize-none bg-transparent px-3 py-2 text-lg font-semibold leading-relaxed text-ink outline-none placeholder:text-transparent sm:text-xl"
            placeholder=" "
          />
          <AnimatePresence mode="wait">
            {!value ? (
              <motion.span
                key={exampleIndex}
                aria-hidden="true"
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="pointer-events-none absolute left-3 top-2 right-3 text-lg font-semibold leading-relaxed text-ink-faint sm:text-xl"
              >
                {EXAMPLES[exampleIndex]}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-2 flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
          <p id={`${id}-hint`} className="text-xs font-semibold text-ink-faint sm:pb-3">
            Be messy. Mention your city, your school, your job, your deadline.
          </p>
          <Button
            type="submit"
            size="lg"
            className={`w-full sm:w-auto ${ready ? "animate-pulse-ring" : ""}`}
            trailing={
              <motion.span
                aria-hidden="true"
                animate={ready && !reduceMotion ? { rotate: [0, 12, -8, 0], scale: [1, 1.15, 1] } : undefined}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.2 }}
              >
                ✨
              </motion.span>
            }
          >
            Start Learning
          </Button>
        </div>
      </motion.div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {QUICK_STARTS.map((q, i) => (
          <motion.button
            key={q.label}
            type="button"
            onClick={() => {
              setValue(q.text);
              textareaRef.current?.focus();
            }}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.06 }}
            whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="glass rounded-full px-4 py-2 text-sm font-bold text-ink-soft transition hover:text-ink"
          >
            {q.label}
          </motion.button>
        ))}
      </div>
    </form>
  );
}
