"use client";

import { useId, useState } from "react";
import { motion } from "framer-motion";
import type { SyllabusOutline } from "@/lib/types";

type Props = {
  syllabus: SyllabusOutline;
};

export function SyllabusOutlineView({ syllabus }: Props) {
  const headingId = useId();
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(syllabus.modules.map((m, i) => [m.id, i === 0])),
  );

  function toggleModule(id: string) {
    setOpenModules((prev) => ({ ...prev, [id]: !prev[id] }));
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
          {syllabus.title}
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          Locale: {syllabus.locale} · Audience: {syllabus.audience}
        </p>

        {syllabus.learningGoals.length > 0 ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <h3 className="text-sm font-medium text-white">Learning goals</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-400">
              {syllabus.learningGoals.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <ol className="relative space-y-4">
        <div
          aria-hidden="true"
          className="absolute left-[1.15rem] top-4 bottom-4 w-px bg-gradient-to-b from-cyan-400/50 via-violet-500/40 to-transparent md:left-1/2 md:-translate-x-px"
        />

        {syllabus.modules.map((module, index) => {
          const isOpen = openModules[module.id];
          const panelId = `module-panel-${module.id}`;
          const buttonId = `module-button-${module.id}`;

          return (
            <motion.li
              key={module.id}
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
                  onClick={() => toggleModule(module.id)}
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
                      {module.summary}
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
                  {module.localContext ? (
                    <p className="mb-3 text-sm text-cyan-200/90">
                      Local context: {module.localContext}
                    </p>
                  ) : null}
                  <ul className="space-y-2">
                    {module.lessons.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <p className="text-sm font-medium text-white">
                          {lesson.title}
                        </p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {lesson.objective}
                        </p>
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
