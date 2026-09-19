"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ScenarioBlockPayload } from "@/lib/types";
import { MarkdownContent } from "./MarkdownContent";

type Props = {
  scenario: ScenarioBlockPayload;
};

export function ScenarioCard({ scenario }: Props) {
  const reduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-label={`Scenario: ${scenario.title}`}
      className="glass-card relative overflow-hidden rounded-3xl p-6 ring-1 ring-cyan-300/20 sm:p-7"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl"
      />

      <div className="relative">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">
          Practical scenario · {scenario.setting}
        </p>
        <h3 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {scenario.title}
        </h3>

        <div className="mt-4">
          <MarkdownContent markdown={scenario.narrative} className="text-[1rem]" />
        </div>

        <div className="mt-5 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-violet-200">
            Your challenge
          </p>
          <p className="mt-1.5 text-base leading-relaxed text-white">{scenario.challenge}</p>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-expanded={revealed}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            {revealed ? "Hide the walkthrough" : "Think it through, then reveal the walkthrough"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {revealed ? (
            <motion.div
              key="walkthrough"
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300">
                  Model walkthrough
                </p>
                <div className="mt-3">
                  <MarkdownContent markdown={scenario.walkthrough} className="text-[1rem]" />
                </div>
                <blockquote className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-neutral-200">
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
                    Debrief
                  </span>
                  <p className="mt-1.5">{scenario.debrief}</p>
                </blockquote>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
