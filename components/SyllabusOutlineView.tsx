"use client";

import { useId, useState } from "react";
import { motion } from "framer-motion";
import type { SyllabusOutline } from "@/lib/types";

type Props = {
  syllabus: SyllabusOutline;
};

export function SyllabusOutlineView({ syllabus }: Props) {
  const headingId = useId();
  const [openModules, setOpenModules] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(syllabus.modules.map((_, i) => [i, i === 0])),
  );

  function toggleModule(index: number) {
    setOpenModules((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  return (
    <motion.section
      aria-labelledby={headingId}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div className="glass-panel mb-6 rounded-2xl p-6 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-violet-300">
          Interactive outline
        </p>
        <h2
          id={headingId}
          className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
        >
          {syllabus.courseTitle}
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          {syllabus.modules.length}-module localized syllabus
        </p>
      </div>

      <ol className="relative space-y-4">
        <div
          aria-hidden="true"
          className="absolute left-[1.15rem] top-4 bottom-4 w-px bg-gradient-to-b from-cyan-400/50 via-violet-500/40 to-transparent"
        />

        {syllabus.modules.map((module, index) => {
          const isOpen = openModules[index];
          const panelId = `module-panel-${index}`;
          const buttonId = `module-button-${index}`;

          return (
            <motion.li
              key={`${module.title}-${index}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index, duration: 0.4 }}
              className="relative"
            >
              <div className="glass-card overflow-hidden rounded-2xl">
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleModule(index)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left transition hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-300"
                >
                  <span>
                    <span className="font-mono text-xs text-cyan-300">
                      Module {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="mt-1 block text-base font-medium text-white">
                      {module.title}
                    </span>
                    <span className="mt-1 block text-sm text-neutral-400">
                      {module.description}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-neutral-500">
                    {module.estimatedMinutes} min · {isOpen ? "−" : "+"}
                  </span>
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="border-t border-white/10 px-5 py-4"
                >
                  <ul className="flex flex-wrap gap-2">
                    {module.topics.map((topic) => (
                      <li
                        key={topic}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300"
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </motion.section>
  );
}
