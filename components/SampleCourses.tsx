"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SAMPLE_COURSES } from "@/lib/sample-courses";
import { Pill } from "@/components/ui/Pill";

const TONE_BG: Record<string, string> = {
  violet: "from-brand-violet-soft",
  coral: "from-brand-coral-soft",
  ocean: "from-brand-ocean-soft",
  mint: "from-brand-mint-soft",
  sun: "from-brand-sun-soft",
};

type Props = {
  onPick: (brainDump: string) => void;
};

export function SampleCourses({ onPick }: Props) {
  const reduceMotion = useReducedMotion();
  const featured = SAMPLE_COURSES.slice(0, 3);

  return (
    <section aria-labelledby="samples-heading" className="w-full px-4 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-brand-ocean-deep">
              Made for real life
            </p>
            <h2 id="samples-heading" className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
              Courses people actually needed.
            </h2>
          </div>
          <p className="max-w-sm text-base font-semibold text-ink-soft">
            Tap one to make it yours. We will remix it around your details.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {featured.map((course, i) => (
            <motion.button
              key={course.id}
              type="button"
              onClick={() => onPick(course.brainDump)}
              initial={reduceMotion ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              whileHover={reduceMotion ? undefined : { y: -8, rotate: i % 2 ? 0.8 : -0.8, scale: 1.01 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : i * 0.1 }}
              className={`glass group relative flex flex-col overflow-hidden rounded-4xl bg-gradient-to-br ${TONE_BG[course.tone]} to-white p-6 text-left`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-3xl shadow-soft transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  {course.emoji}
                </span>
                <Pill tone={course.tone}>{course.minutes} min</Pill>
              </div>
              <h3 className="mt-5 font-display text-2xl font-bold leading-tight text-ink">
                {course.title}
              </h3>
              <p className="mt-2 text-sm font-semibold text-ink-soft">{course.tagline}</p>
              <ul className="mt-4 space-y-1.5 text-sm font-semibold text-ink-soft">
                {course.modules.slice(0, 3).map((m) => (
                  <li key={m} className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gradient" />
                    {m}
                  </li>
                ))}
                {course.modules.length > 3 ? (
                  <li className="text-ink-faint">+ {course.modules.length - 3} more</li>
                ) : null}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-violet-deep">
                Make it mine
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
