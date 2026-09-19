"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Pill } from "@/components/ui/Pill";
import type { SampleCourse } from "@/lib/sample-courses";
import type { CourseListItem } from "@/src/lib/course/queries";

const TONES = ["violet", "coral", "ocean", "mint", "sun"] as const;
type Tone = (typeof TONES)[number];

const TONE_GRADIENT: Record<Tone, string> = {
  violet: "from-brand-violet-soft via-white to-white",
  coral: "from-brand-coral-soft via-white to-white",
  ocean: "from-brand-ocean-soft via-white to-white",
  mint: "from-brand-mint-soft via-white to-white",
  sun: "from-brand-sun-soft via-white to-white",
};

const TONE_BAR: Record<Tone, string> = {
  violet: "from-brand-violet to-brand-coral",
  coral: "from-brand-coral to-brand-sun",
  ocean: "from-brand-ocean to-brand-mint",
  mint: "from-brand-mint to-brand-ocean",
  sun: "from-brand-sun to-brand-coral",
};

const EMOJIS = ["📚", "🧭", "🛠️", "🌱", "🎯", "🧩", "🚀", "💡"];

function pick<T>(list: readonly T[], seed: string): T {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length]!;
}

function ProgressRing({ value, tone }: { value: number; tone: Tone }) {
  const reduceMotion = useReducedMotion();
  const r = 20;
  const c = 2 * Math.PI * r;
  const pct = Math.round(value * 100);
  return (
    <span className="relative grid h-14 w-14 place-items-center" aria-label={`${pct} percent complete`}>
      <svg viewBox="0 0 48 48" className="h-14 w-14 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(43,35,66,0.08)" strokeWidth="5" />
        <motion.circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={`url(#ring-${tone})`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id={`ring-${tone}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--violet)" />
            <stop offset="100%" stopColor={tone === "ocean" || tone === "mint" ? "var(--ocean)" : "var(--coral)"} />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-xs font-extrabold text-ink">{pct}%</span>
    </span>
  );
}

function ProgressBar({ value, tone }: { value: number; tone: Tone }) {
  const reduceMotion = useReducedMotion();
  return (
    <span className="block h-2.5 w-full overflow-hidden rounded-full bg-ink/8">
      <motion.span
        className={`block h-full rounded-full bg-gradient-to-r ${TONE_BAR[tone]}`}
        initial={false}
        animate={{ width: `${Math.max(value * 100, value > 0 ? 6 : 0)}%` }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </span>
  );
}

const cardMotion = (reduceMotion: boolean | null, index: number) => ({
  initial: reduceMotion ? false : { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: reduceMotion ? 0 : Math.min(index * 0.06, 0.4) },
  whileHover: reduceMotion ? undefined : { y: -8, rotate: index % 2 ? 0.7 : -0.7, scale: 1.01 },
  whileTap: reduceMotion ? undefined : { scale: 0.985 },
});

export function CreateCourseCard({ onClick }: { onClick: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...cardMotion(reduceMotion, 0)}
      className="group relative flex w-full flex-col overflow-hidden rounded-4xl bg-brand-gradient gradient-shift p-7 text-left text-white shadow-pop"
    >
      <span aria-hidden="true" className="blob -right-10 -top-10 h-40 w-40 bg-white/30" />
      <span aria-hidden="true" className="blob -bottom-12 left-6 h-36 w-36 bg-brand-sun/60" />
      <span className="relative grid h-16 w-16 place-items-center rounded-3xl bg-white/20 text-4xl backdrop-blur transition-transform duration-300 group-hover:rotate-90">
        +
      </span>
      <span className="relative mt-6 block font-display text-3xl font-bold leading-tight">Create a new course</span>
      <span className="relative mt-2 block text-base font-semibold text-white/90">
        Tell us what is going on. We build the lessons, the scenarios, the quizzes and the tutor.
      </span>
      <span className="relative mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-brand-violet-deep shadow-soft">
        Start a brain dump
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </motion.button>
  );
}

export function CourseCard({
  course,
  progress,
  index,
}: {
  course: CourseListItem;
  progress: number;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const tone = pick(TONES, course.id);
  const emoji = pick(EMOJIS, course.id);
  const status =
    course.status === "generating" ? "Still baking" : course.status === "failed" ? "Needs a retry" : progress >= 1 ? "Complete" : progress > 0 ? "In progress" : "New";
  const statusTone = course.status === "failed" ? "rose" : progress >= 1 ? "mint" : course.status === "generating" ? "sun" : tone;
  const href = course.status === "failed" ? `/setup/${course.id}` : `/dashboard/${course.id}`;
  const showTitles = index % 3 !== 1;

  return (
    <motion.div {...cardMotion(reduceMotion, index + 1)} className="w-full">
      <Link
        href={href}
        className={`group relative flex w-full flex-col overflow-hidden rounded-4xl bg-gradient-to-br ${TONE_GRADIENT[tone]} glass p-6 text-left focus-visible:outline focus-visible:outline-3 focus-visible:outline-brand-violet/60`}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-3xl shadow-soft transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            {emoji}
          </span>
          <ProgressRing value={course.status === "ready" ? progress : 0} tone={tone} />
        </div>

        <h3 className="mt-5 font-display text-2xl font-bold leading-tight text-ink">{course.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-ink-soft">{course.targetAudience}</p>

        {showTitles && course.moduleTitles.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-sm font-semibold text-ink-soft">
            {course.moduleTitles.slice(0, 3).map((m) => (
              <li key={m} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gradient" />
                <span className="truncate">{m}</span>
              </li>
            ))}
            {course.moduleTitles.length > 3 ? (
              <li className="text-ink-faint">+ {course.moduleTitles.length - 3} more</li>
            ) : null}
          </ul>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <Pill tone={statusTone}>{status}</Pill>
          <span className="text-xs font-extrabold text-ink-faint">{course.moduleCount} modules</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={course.status === "ready" ? progress : 0} tone={tone} />
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-violet-deep">
          {course.status === "failed" ? "Try generating again" : progress > 0 ? "Keep going" : "Jump in"}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </Link>
    </motion.div>
  );
}

export function SampleCourseCard({
  course,
  index,
  onPick,
}: {
  course: SampleCourse;
  index: number;
  onPick: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const tall = index % 3 === 0;
  return (
    <motion.button
      type="button"
      onClick={onPick}
      {...cardMotion(reduceMotion, index + 1)}
      className={`group relative flex w-full flex-col overflow-hidden rounded-4xl bg-gradient-to-br ${TONE_GRADIENT[course.tone]} glass p-6 text-left`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-3xl shadow-soft transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          {course.emoji}
        </span>
        <Pill tone="neutral">Sample</Pill>
      </div>
      <h3 className="mt-5 font-display text-2xl font-bold leading-tight text-ink">{course.title}</h3>
      <p className="mt-1.5 text-sm font-semibold text-ink-soft">{course.tagline}</p>
      {tall ? (
        <ul className="mt-4 space-y-1.5 text-sm font-semibold text-ink-soft">
          {course.modules.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gradient" />
              {m}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5 flex items-center justify-between gap-3">
        <Pill tone={course.tone}>{course.minutes} min</Pill>
        <span className="text-xs font-extrabold text-ink-faint">{course.modules.length} modules</span>
      </div>
      <div className="mt-3">
        <ProgressBar value={course.progress} tone={course.tone} />
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-violet-deep">
        Make it mine
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </motion.button>
  );
}
