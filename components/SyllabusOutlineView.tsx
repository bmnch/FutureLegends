"use client";

import { useId, useState } from "react";
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
    <section
      aria-labelledby={headingId}
      className="rounded-md border border-border bg-surface-elevated/80 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-2 border-b border-border pb-5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-neon-hot">
          Interactive outline
        </p>
        <h2
          id={headingId}
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          {syllabus.title}
        </h2>
        <p className="text-sm text-muted">
          Locale: {syllabus.locale} · Audience: {syllabus.audience}
        </p>
      </div>

      {syllabus.learningGoals.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-medium text-foreground">Learning goals</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {syllabus.learningGoals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="mt-6 space-y-3">
        {syllabus.modules.map((module, index) => {
          const isOpen = openModules[module.id];
          const panelId = `module-panel-${module.id}`;
          const buttonId = `module-button-${module.id}`;

          return (
            <li
              key={module.id}
              className="overflow-hidden rounded-md border border-border bg-surface"
            >
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleModule(module.id)}
                className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neon"
              >
                <span>
                  <span className="font-mono text-xs text-neon">
                    Module {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-1 block text-base font-medium text-foreground">
                    {module.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {module.summary}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted">
                  {module.estimatedMinutes} min · {isOpen ? "−" : "+"}
                </span>
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="border-t border-border px-4 py-4"
              >
                {module.localContext ? (
                  <p className="mb-3 text-sm text-neon/90">
                    Local context: {module.localContext}
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {module.lessons.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="rounded border border-border/70 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {lesson.title}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {lesson.objective}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
