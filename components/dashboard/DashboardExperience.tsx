"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AppNavbar } from "@/components/AppNavbar";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { CreateCourseModal } from "@/components/CreateCourseModal";
import { CourseCard, CreateCourseCard, SampleCourseCard } from "@/components/dashboard/CourseCards";
import { Pill } from "@/components/ui/Pill";
import { SAMPLE_COURSES } from "@/lib/sample-courses";
import { NOT_HYDRATED, useStoredJsonMap } from "@/lib/use-browser-storage";
import { useSession, type SessionUser } from "@/lib/use-session";
import type { CourseListItem } from "@/src/lib/course/queries";

export type StoredProgress = {
  passed?: string[];
  visited?: string[];
  active?: number;
  /** Number of modules fully complete. Written by the player. */
  complete?: number;
  checkpoints?: string[];
};

type Props = {
  user: SessionUser;
  courses: CourseListItem[];
};

const progressKey = (courseId: string) => `civior:progress:${courseId}`;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardExperience({ user, courses }: Props) {
  const reduceMotion = useReducedMotion();
  const session = useSession(user);
  // Time-of-day greeting is resolved on the client only, so SSR never disagrees.
  const hello = useSyncExternalStore(
    () => () => {},
    () => greeting(),
    () => "Hey",
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [seed, setSeed] = useState("");

  const keys = useMemo(() => courses.map((c) => progressKey(c.id)), [courses]);
  const stored = useStoredJsonMap<StoredProgress>(keys);

  const progressFor = (course: CourseListItem): number => {
    if (stored === NOT_HYDRATED) return 0;
    const p = stored[progressKey(course.id)];
    if (!p || course.moduleCount === 0) return 0;
    if (typeof p.complete === "number") return Math.min(1, p.complete / course.moduleCount);
    return Math.min(1, (p.visited?.length ?? 0) / course.moduleCount);
  };

  const modulesDone =
    stored === NOT_HYDRATED
      ? 0
      : courses.reduce((sum, c) => sum + (stored[progressKey(c.id)]?.complete ?? 0), 0);
  const totalModules = courses.reduce((sum, c) => sum + c.moduleCount, 0);
  const firstName = user.email.split("@")[0] ?? "there";

  const openCreate = (brainDump = "") => {
    setSeed(brainDump);
    setCreateOpen(true);
  };

  // Samples fill the grid while the learner has few courses of their own.
  const samples = courses.length >= 4 ? SAMPLE_COURSES.slice(0, 2) : SAMPLE_COURSES;

  return (
    <div className="relative flex w-full flex-1 flex-col">
      <AppNavbar user={session.user ?? user} onSignOut={session.signOut} />

      <CreateCourseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialBrainDump={seed}
        user={session.user ?? user}
        onAuthenticated={(u) => session.setUser(u)}
      />

      <section className="relative isolate w-full overflow-hidden px-4 pb-6 pt-10 sm:px-8 lg:px-12">
        <BackgroundBlobs intensity={0.6} />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-extrabold uppercase tracking-[0.2em] text-brand-coral-deep"
            >
              {hello}, {firstName} 👋
            </motion.p>
            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-2 font-display text-4xl font-bold text-ink sm:text-5xl lg:text-6xl"
            >
              What are we learning today?
            </motion.h1>
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="flex flex-wrap gap-2.5"
          >
            <Pill tone="violet" className="px-4 py-2 text-sm">
              {courses.length} {courses.length === 1 ? "course" : "courses"}
            </Pill>
            <Pill tone="mint" className="px-4 py-2 text-sm">
              {modulesDone} of {totalModules} modules done
            </Pill>
            {user.plan === "premium" ? (
              <Pill tone="sun" className="px-4 py-2 text-sm">
                Premium
              </Pill>
            ) : null}
          </motion.div>
        </div>
      </section>

      <section aria-label="Your courses" className="w-full px-4 pb-24 sm:px-8 lg:px-12">
        <div className="columns-1 gap-6 sm:columns-2 xl:columns-3 2xl:columns-4 [&>*]:mb-6 [&>*]:break-inside-avoid">
          <CreateCourseCard onClick={() => openCreate()} />

          {courses.map((course, i) => (
            <CourseCard key={course.id} course={course} progress={progressFor(course)} index={i} />
          ))}

          {samples.map((sample, i) => (
            <SampleCourseCard
              key={sample.id}
              course={sample}
              index={courses.length + i}
              onPick={() => openCreate(sample.brainDump)}
            />
          ))}
        </div>

        {courses.length === 0 ? (
          <p className="mt-6 text-center text-sm font-semibold text-ink-faint">
            The cards with a &ldquo;Sample&rdquo; tag are ideas. Tap one and we will remix it around your life.
          </p>
        ) : null}
      </section>
    </div>
  );
}
