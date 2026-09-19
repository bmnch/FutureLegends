"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ScenarioBlockPayload } from "@/lib/types";
import { stripEmDashes } from "@/lib/markdown-utils";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
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
      className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-brand-ocean-soft via-white to-brand-violet-soft/40 p-6 shadow-soft sm:p-7"
    >
      <div className="relative">
        <Pill tone="ocean" icon={<span aria-hidden="true">🎬</span>}>
          Real life scenario
        </Pill>
        <p className="mt-3 text-sm font-extrabold uppercase tracking-wider text-brand-ocean-deep">{stripEmDashes(scenario.setting)}</p>
        <h3 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{stripEmDashes(scenario.title)}</h3>

        <div className="mt-4">
          <MarkdownContent markdown={scenario.narrative} />
        </div>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-soft">
          <p className="text-xs font-extrabold uppercase tracking-wider text-brand-coral-deep">Your move</p>
          <p className="mt-1.5 text-lg font-bold leading-relaxed text-ink">{stripEmDashes(scenario.challenge)}</p>
        </div>

        <div className="mt-5">
          <Button variant={revealed ? "secondary" : "ocean"} onClick={() => setRevealed((v) => !v)} aria-expanded={revealed}>
            {revealed ? "Hide the walkthrough" : "Think it through, then show me"}
          </Button>
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
              <div className="mt-5 border-t border-line pt-5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-brand-mint-deep">How to handle it</p>
                <div className="mt-3">
                  <MarkdownContent markdown={scenario.walkthrough} />
                </div>
                <div className="mt-5 rounded-3xl bg-brand-sun-soft p-5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#8a5a00]">The takeaway</p>
                  <p className="mt-1.5 text-base font-semibold leading-relaxed text-ink">{stripEmDashes(scenario.debrief)}</p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
