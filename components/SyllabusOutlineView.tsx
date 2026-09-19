"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SyllabusOutline } from "@/lib/types";
import { Pill } from "@/components/ui/Pill";

type Props = {
  syllabus: SyllabusOutline;
};

const TONES = ["violet", "coral", "ocean", "mint", "sun"] as const;

export function SyllabusOutlineView({ syllabus }: Props) {
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const totalMinutes = syllabus.modules.reduce((sum, m) => sum + (m.estimatedMinutes || 0), 0);

  return (
    <motion.section
      aria-labelledby={headingId}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rounded-3xl bg-brand-gradient-soft p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="violet">{syllabus.modules.length} modules</Pill>
          {totalMinutes > 0 ? <Pill tone="coral">about {totalMinutes} min</Pill> : null}
        </div>
        <h3 id={headingId} className="mt-3 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {syllabus.courseTitle}
        </h3>
      </div>

      <ol className="mt-4 space-y-2.5">
        {syllabus.modules.map((module, index) => {
          const isOpen = Boolean(open[index]);
          const panelId = `${headingId}-panel-${index}`;
          const tone = TONES[index % TONES.length];
          return (
            <motion.li
              key={`${module.title}-${index}`}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.06 * index, duration: 0.35 }}
              className="overflow-hidden rounded-3xl bg-white/85 shadow-soft"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen((prev) => ({ ...prev, [index]: !prev[index] }))}
                className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-white"
              >
                <span
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold ${
                    tone === "violet"
                      ? "bg-brand-violet-soft text-brand-violet-deep"
                      : tone === "coral"
                        ? "bg-brand-coral-soft text-brand-coral-deep"
                        : tone === "ocean"
                          ? "bg-brand-ocean-soft text-brand-ocean-deep"
                          : tone === "mint"
                            ? "bg-brand-mint-soft text-brand-mint-deep"
                            : "bg-brand-sun-soft text-[#8a5a00]"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold text-ink">{module.title}</span>
                  <span className="mt-0.5 block text-sm font-semibold text-ink-soft">{module.description}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs font-extrabold text-ink-faint">
                  {module.estimatedMinutes} min
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} aria-hidden="true" className="inline-block">
                    ▾
                  </motion.span>
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    id={panelId}
                    key="panel"
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <ul className="flex flex-wrap gap-2 px-5 pb-4">
                      {module.topics.map((topic) => (
                        <li key={topic} className="rounded-full bg-ink/6 px-3 py-1.5 text-xs font-bold text-ink-soft">
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ol>
    </motion.section>
  );
}
