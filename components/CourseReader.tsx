"use client";

import { useId, useState } from "react";
import type { CourseContent } from "@/lib/types";

type Props = {
  course: CourseContent;
};

export function CourseReader({ course }: Props) {
  const headingId = useId();
  const [activeId, setActiveId] = useState(course.sections[0]?.id);

  return (
    <div
      className="flex h-full flex-col rounded-md border border-border bg-surface p-5"
      role="region"
      aria-labelledby={headingId}
    >
      <h1 id={headingId} className="text-2xl font-semibold text-foreground">
        {course.title}
      </h1>
      <p className="mt-1 text-sm text-muted">Interactive course reader</p>

      <nav
        aria-label="Course sections"
        className="mt-5 flex flex-wrap gap-2 border-b border-border pb-4"
      >
        {course.sections.map((section, index) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveId(section.id)}
            aria-current={activeId === section.id ? "true" : undefined}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon ${
              activeId === section.id
                ? "border-neon text-neon"
                : "border-border text-muted hover:border-zinc-500"
            }`}
          >
            {index + 1}. {section.heading}
          </button>
        ))}
      </nav>

      <div className="mt-5 flex-1 overflow-y-auto pr-1">
        {course.sections
          .filter((section) => section.id === activeId)
          .map((section) => (
            <article key={section.id} aria-labelledby={`section-${section.id}`}>
              <h2
                id={`section-${section.id}`}
                className="text-xl font-semibold text-foreground"
              >
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-zinc-300 whitespace-pre-wrap">
                {section.body}
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}
