"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PREFS_KEY, type PlayerPrefs } from "@/lib/generation-client";
import { stripLeadingTitleHeading } from "@/lib/markdown-utils";
import type { PlayerBlock, PlayerCourse, PlayerModule } from "@/lib/types";
import { NOT_HYDRATED, useStoredJson } from "@/lib/use-browser-storage";
import { AskQuestionFab, ChatDrawer } from "./ChatDrawer";
import { MarkdownContent } from "./MarkdownContent";
import { MediaBar, SPEEDS, type MediaTrack, type Speed } from "./MediaBar";
import { ModuleTimeline, type ModuleState } from "./ModuleTimeline";
import { QuizCard } from "./QuizCard";
import { ScenarioCard } from "./ScenarioCard";

type Props = {
  initialCourse: PlayerCourse;
};

type StoredProgress = {
  passed?: string[];
  visited?: string[];
  active?: number;
};

const progressKey = (courseId: string) => `civior:progress:${courseId}`;

function trackFromBlock(block: PlayerBlock): MediaTrack | null {
  if (block.content.kind === "audio") {
    return {
      id: block.id,
      title: block.content.title,
      url: block.audioUrl,
      transcript: block.content.transcript,
      provider: block.content.narration.provider,
    };
  }
  if (block.content.kind === "text") {
    return {
      id: block.id,
      title: block.content.title,
      url: block.audioUrl,
      transcript: `${block.content.title}. ${block.content.plainText}`,
      provider: block.content.narration?.provider ?? "stub",
    };
  }
  return null;
}

function defaultTrackId(module: PlayerModule | undefined): string | null {
  if (!module) return null;
  return (
    module.blocks.find((b) => b.type === "audio")?.id ??
    module.blocks.find((b) => b.type === "text")?.id ??
    null
  );
}

export function CoursePlayer({ initialCourse }: Props) {
  const reduceMotion = useReducedMotion();
  const [course, setCourse] = useState<PlayerCourse>(initialCourse);

  // ── learner progress: stored snapshot + in-session overrides ───────────
  const storedProgress = useStoredJson<StoredProgress>(progressKey(course.id));
  const storedPrefs = useStoredJson<PlayerPrefs>(PREFS_KEY);
  const hydrated = storedProgress !== NOT_HYDRATED;

  const [passedOverride, setPassedOverride] = useState<Set<string> | null>(null);
  const [visitedOverride, setVisitedOverride] = useState<Set<string> | null>(null);
  const [activeOverride, setActiveOverride] = useState<number | null>(null);
  const [trackOverride, setTrackOverride] = useState<{ moduleId: string; blockId: string } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [seed, setSeed] = useState<{ nonce: number; question: string }>({ nonce: 0, question: "" });
  const contentRef = useRef<HTMLDivElement | null>(null);

  const passedQuizIds = useMemo(
    () =>
      passedOverride ??
      new Set(hydrated && storedProgress ? storedProgress.passed ?? [] : []),
    [passedOverride, hydrated, storedProgress],
  );
  const visited = useMemo(
    () =>
      visitedOverride ??
      new Set(hydrated && storedProgress ? storedProgress.visited ?? [] : []),
    [visitedOverride, hydrated, storedProgress],
  );
  const activeIndex =
    activeOverride ??
    (hydrated && storedProgress && typeof storedProgress.active === "number"
      ? storedProgress.active
      : 0);

  const initialSpeed: Speed | null = !hydrated
    ? null
    : (SPEEDS.find(
        (s) => s === (storedPrefs !== NOT_HYDRATED ? storedPrefs?.playbackSpeed : undefined),
      ) ?? 1);

  // Persist progress (external system write — allowed in an effect).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        progressKey(course.id),
        JSON.stringify({ passed: [...passedQuizIds], visited: [...visited], active: activeIndex }),
      );
    } catch {
      // ignore
    }
  }, [course.id, hydrated, passedQuizIds, visited, activeIndex]);

  // ── poll while the pipeline is still running ───────────────────────────
  useEffect(() => {
    if (course.status !== "generating") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/courses/${course.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { course?: PlayerCourse };
        if (!cancelled && data.course) setCourse(data.course);
      } catch {
        // transient — try again next tick
      }
    };
    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [course.status, course.id]);

  // ── derived state ──────────────────────────────────────────────────────
  const modules = course.modules;
  const safeActive = Math.min(activeIndex, Math.max(modules.length - 1, 0));
  const activeModule = modules[safeActive];

  const moduleProgress = useMemo(
    () =>
      modules.map((m, i) => {
        const quizzes = m.blocks.filter((b) => b.type === "quiz");
        if (quizzes.length === 0) {
          // Modules without a gate count as complete once seen.
          return visited.has(m.id) || i === safeActive ? 1 : 0;
        }
        const passed = quizzes.filter((q) => passedQuizIds.has(q.id)).length;
        return passed / quizzes.length;
      }),
    [modules, passedQuizIds, visited, safeActive],
  );

  const states = useMemo<ModuleState[]>(() => {
    const result: ModuleState[] = [];
    for (let i = 0; i < modules.length; i += 1) {
      const complete = moduleProgress[i] === 1;
      const prevComplete = i === 0 || result[i - 1] === "complete";
      if (complete) result.push("complete");
      else if (i === safeActive) result.push("active");
      else if (prevComplete) result.push("available");
      else result.push("locked");
    }
    return result;
  }, [modules.length, moduleProgress, safeActive]);

  const trackId =
    activeModule && trackOverride?.moduleId === activeModule.id
      ? trackOverride.blockId
      : defaultTrackId(activeModule);

  const track = useMemo<MediaTrack | null>(() => {
    if (!activeModule || !trackId) return null;
    const block = activeModule.blocks.find((b) => b.id === trackId);
    return block ? trackFromBlock(block) : null;
  }, [activeModule, trackId]);

  const activeComplete = states[safeActive] === "complete";
  const hasNext = safeActive < modules.length - 1;
  const allComplete = modules.length > 0 && states.every((s) => s === "complete");

  const selectModule = useCallback(
    (index: number) => {
      if (states[index] === "locked") return;
      const target = modules[index];
      if (target) setVisitedOverride(new Set(visited).add(target.id));
      setActiveOverride(index);
      contentRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [states, modules, visited, reduceMotion],
  );

  const openTutorWith = useCallback((question: string) => {
    setSeed((prev) => ({ nonce: prev.nonce + 1, question }));
    setChatOpen(true);
  }, []);

  // ── render: still generating / failed ──────────────────────────────────
  if (course.status !== "ready" || modules.length === 0) {
    return (
      <div className="glass-panel mx-auto mt-10 w-full max-w-2xl rounded-3xl p-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300">
          {course.status === "failed" ? "Generation failed" : "Generating your intensive"}
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">{course.title}</h2>
        {course.status === "failed" ? (
          <>
            <p className="mt-3 text-sm text-rose-200">
              {String(
                (course.generationMeta as { error?: string } | null)?.error ??
                  "The pipeline stopped before your course was saved.",
              )}
            </p>
            <a
              href={`/setup/${course.id}`}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-cyan-400 px-6 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300"
            >
              Regenerate course
            </a>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-neutral-400">
              The Research, Architect and Content agents are still working. This page refreshes
              automatically.
            </p>
            <div className="mt-6 grid gap-3">
              <div className="skeleton-scan h-6 w-2/3 justify-self-center rounded-lg" />
              <div className="skeleton-scan h-24 w-full rounded-2xl" />
              <div className="skeleton-scan h-24 w-full rounded-2xl" />
            </div>
          </>
        )}
      </div>
    );
  }

  // ── render: player ─────────────────────────────────────────────────────
  return (
    <div className="relative flex h-[calc(100svh-1.5rem)] flex-col gap-3 sm:h-[calc(100svh-2rem)]">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]">
        {/* Sidebar */}
        <div className="hidden min-h-0 lg:block">
          <ModuleTimeline
            courseTitle={course.title}
            targetAudience={course.targetAudience}
            modules={modules}
            activeIndex={safeActive}
            states={states}
            progress={moduleProgress}
            onSelect={selectModule}
          />
        </div>

        {/* Mobile module switcher */}
        <div
          className="scroll-slim flex gap-2 overflow-x-auto pb-1 lg:hidden"
          role="tablist"
          aria-label="Modules"
        >
          {modules.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={i === safeActive}
              disabled={states[i] === "locked"}
              onClick={() => selectModule(i)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition disabled:opacity-40 ${
                i === safeActive
                  ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                  : states[i] === "complete"
                    ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 text-neutral-300"
              }`}
            >
              {i + 1}. {m.title}
            </button>
          ))}
        </div>

        {/* Main content pane */}
        <main
          ref={contentRef}
          className="glass-panel scroll-slim relative min-h-0 overflow-y-auto rounded-3xl bg-white/[0.03] backdrop-blur-xl"
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            {activeModule ? (
              <motion.div
                key={activeModule.id}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10"
              >
                <header className="mb-8">
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300">
                    Module {safeActive + 1} of {modules.length}
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                    {activeModule.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-300">
                    <span className="font-medium text-violet-200">Objective · </span>
                    {activeModule.objective}
                  </p>
                </header>

                <div className="space-y-8">
                  {activeModule.blocks.map((block, i) => {
                    switch (block.content.kind) {
                      case "text": {
                        const loaded = trackId === block.id;
                        return (
                          <motion.article
                            key={block.id}
                            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.35 }}
                            className="relative"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h2 className="text-xl font-semibold tracking-tight text-white">
                                {block.content.title}
                              </h2>
                              <button
                                type="button"
                                onClick={() =>
                                  setTrackOverride({ moduleId: activeModule.id, blockId: block.id })
                                }
                                aria-pressed={loaded}
                                className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                                  loaded
                                    ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                                    : "border-white/10 text-neutral-400 hover:border-white/25 hover:text-white"
                                }`}
                              >
                                {loaded ? "● Loaded" : "▶ Listen"}
                              </button>
                            </div>
                            <MarkdownContent
                              markdown={stripLeadingTitleHeading(
                                block.content.markdown,
                                block.content.title,
                              )}
                            />
                          </motion.article>
                        );
                      }
                      case "scenario":
                        return <ScenarioCard key={block.id} scenario={block.content} />;
                      case "quiz": {
                        const quizIndex = activeModule.blocks
                          .filter((b) => b.type === "quiz")
                          .findIndex((b) => b.id === block.id);
                        return (
                          <QuizCard
                            key={block.id}
                            quiz={block.content}
                            index={quizIndex}
                            passed={passedQuizIds.has(block.id)}
                            onPass={() => setPassedOverride(new Set(passedQuizIds).add(block.id))}
                            onAskTutor={openTutorWith}
                          />
                        );
                      }
                      case "audio":
                        return null;
                      default:
                        return null;
                    }
                  })}
                </div>

                <footer className="mt-10 flex flex-col items-start gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-neutral-400">
                    {activeComplete
                      ? allComplete
                        ? "You've completed every module. Revisit any of them from the timeline."
                        : "Module complete — the next one is unlocked."
                      : "Pass every knowledge check above to unlock the next module."}
                  </p>
                  {hasNext ? (
                    <motion.button
                      type="button"
                      disabled={!activeComplete}
                      onClick={() => selectModule(safeActive + 1)}
                      whileTap={reduceMotion || !activeComplete ? undefined : { scale: 0.98 }}
                      className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                        activeComplete
                          ? "bg-gradient-to-r from-cyan-400 to-violet-400 text-neutral-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] hover:brightness-110"
                          : "cursor-not-allowed border border-white/10 text-neutral-500"
                      }`}
                    >
                      {activeComplete ? "Next module →" : "Locked"}
                    </motion.button>
                  ) : null}
                </footer>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>
      </div>

      {/* Persistent media / accessibility bar */}
      {initialSpeed !== null ? (
        <MediaBar
          track={track}
          moduleLabel={activeModule ? `Module ${safeActive + 1}` : ""}
          initialSpeed={initialSpeed}
        />
      ) : null}

      <AskQuestionFab onClick={() => setChatOpen(true)} hidden={chatOpen} />
      {activeModule ? (
        <ChatDrawer
          key={`${activeModule.id}:${seed.nonce}`}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          courseId={course.id}
          moduleId={activeModule.id}
          moduleTitle={activeModule.title}
          initialInput={seed.question}
        />
      ) : null}
    </div>
  );
}
