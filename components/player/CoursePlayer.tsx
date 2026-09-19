"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { chunkMarkdown, readingSeconds } from "@/lib/chunk-markdown";
import { PREFS_KEY, type PlayerPrefs } from "@/lib/generation-client";
import { stripEmDashes, stripLeadingTitleHeading } from "@/lib/markdown-utils";
import type { PlayerBlock, PlayerCourse, PlayerModule } from "@/lib/types";
import { NOT_HYDRATED, useStoredJson } from "@/lib/use-browser-storage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Pill } from "@/components/ui/Pill";
import { AiPanel, type TutorSeed } from "./AiPanel";
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
  checkpoints?: string[];
  active?: number;
  complete?: number;
};

type Item =
  | {
      kind: "chunk";
      id: string;
      blockId: string;
      title: string | null;
      markdown: string;
      firstOfBlock: boolean;
      seconds: number;
    }
  | { kind: "scenario"; id: string; block: PlayerBlock }
  | { kind: "quiz"; id: string; block: PlayerBlock; quizIndex: number };

const progressKey = (courseId: string) => `civior:progress:${courseId}`;

function buildItems(module: PlayerModule): Item[] {
  const items: Item[] = [];
  let quizIndex = 0;
  for (const block of module.blocks) {
    switch (block.content.kind) {
      case "text": {
        const markdown = stripLeadingTitleHeading(block.content.markdown, block.content.title);
        const chunks = chunkMarkdown(markdown, block.id);
        chunks.forEach((chunk, i) => {
          items.push({
            kind: "chunk",
            id: chunk.id,
            blockId: block.id,
            title: i === 0 ? (block.content as { title: string }).title : chunk.title,
            markdown: chunk.markdown,
            firstOfBlock: i === 0,
            seconds: readingSeconds(chunk.markdown),
          });
        });
        break;
      }
      case "scenario":
        items.push({ kind: "scenario", id: `${block.id}:scenario`, block });
        break;
      case "quiz":
        items.push({ kind: "quiz", id: block.id, block, quizIndex });
        quizIndex += 1;
        break;
      default:
        break;
    }
  }
  return items;
}

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
      transcript: stripEmDashes(`${block.content.title}. ${block.content.plainText}`),
      provider: block.content.narration?.provider ?? "stub",
    };
  }
  return null;
}

function defaultTrackId(module: PlayerModule | undefined): string | null {
  if (!module) return null;
  return module.blocks.find((b) => b.type === "audio")?.id ?? module.blocks.find((b) => b.type === "text")?.id ?? null;
}

function CheckpointDone({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 text-sm font-extrabold text-brand-mint-deep">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-mint text-white">
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M5 10.5l3 3 7-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </div>
  );
}

export function CoursePlayer({ initialCourse }: Props) {
  const reduceMotion = useReducedMotion();
  const [course, setCourse] = useState<PlayerCourse>(initialCourse);

  // learner progress: stored snapshot plus in-session overrides
  const storedProgress = useStoredJson<StoredProgress>(progressKey(course.id));
  const storedPrefs = useStoredJson<PlayerPrefs>(PREFS_KEY);
  const hydrated = storedProgress !== NOT_HYDRATED;

  const [passedOverride, setPassedOverride] = useState<Set<string> | null>(null);
  const [visitedOverride, setVisitedOverride] = useState<Set<string> | null>(null);
  const [checkpointOverride, setCheckpointOverride] = useState<Set<string> | null>(null);
  const [activeOverride, setActiveOverride] = useState<number | null>(null);
  const [trackOverride, setTrackOverride] = useState<{ moduleId: string; blockId: string } | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [seed, setSeed] = useState<TutorSeed>({ nonce: 0, question: "" });
  const contentRef = useRef<HTMLDivElement | null>(null);

  const passedQuizIds = useMemo(
    () => passedOverride ?? new Set(hydrated && storedProgress ? storedProgress.passed ?? [] : []),
    [passedOverride, hydrated, storedProgress],
  );
  const visited = useMemo(
    () => visitedOverride ?? new Set(hydrated && storedProgress ? storedProgress.visited ?? [] : []),
    [visitedOverride, hydrated, storedProgress],
  );
  const checkpoints = useMemo(
    () => checkpointOverride ?? new Set(hydrated && storedProgress ? storedProgress.checkpoints ?? [] : []),
    [checkpointOverride, hydrated, storedProgress],
  );
  const activeIndex =
    activeOverride ?? (hydrated && storedProgress && typeof storedProgress.active === "number" ? storedProgress.active : 0);

  const initialSpeed: Speed | null = !hydrated
    ? null
    : (SPEEDS.find((s) => s === (storedPrefs !== NOT_HYDRATED ? storedPrefs?.playbackSpeed : undefined)) ?? 1);

  // poll while the pipeline is still running
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
        // transient, try again next tick
      }
    };
    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [course.status, course.id]);

  // derived state
  const modules = course.modules;
  const safeActive = Math.min(activeIndex, Math.max(modules.length - 1, 0));
  const activeModule = modules[safeActive];

  const moduleItems = useMemo(() => modules.map(buildItems), [modules]);

  const itemDone = useCallback(
    (item: Item) => (item.kind === "quiz" ? passedQuizIds.has(item.block.id) : checkpoints.has(item.id)),
    [passedQuizIds, checkpoints],
  );

  const moduleProgress = useMemo(
    () =>
      moduleItems.map((items, i) => {
        if (items.length === 0) return visited.has(modules[i]!.id) ? 1 : 0;
        return items.filter(itemDone).length / items.length;
      }),
    [moduleItems, itemDone, visited, modules],
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

  const completeCount = states.filter((s) => s === "complete").length;

  // Persist progress (external system write, so an effect is the right place).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        progressKey(course.id),
        JSON.stringify({
          passed: [...passedQuizIds],
          visited: [...visited],
          checkpoints: [...checkpoints],
          active: safeActive,
          complete: completeCount,
        } satisfies StoredProgress),
      );
    } catch {
      // ignore
    }
  }, [course.id, hydrated, passedQuizIds, visited, checkpoints, safeActive, completeCount]);

  const items = moduleItems[safeActive] ?? [];
  const firstPendingIndex = items.findIndex((it) => !itemDone(it));
  const revealedCount = revealAll || firstPendingIndex === -1 ? items.length : firstPendingIndex + 1;
  const activeComplete = states[safeActive] === "complete";
  const hasNext = safeActive < modules.length - 1;
  const allComplete = modules.length > 0 && states.every((s) => s === "complete");

  const trackId = activeModule && trackOverride?.moduleId === activeModule.id ? trackOverride.blockId : defaultTrackId(activeModule);
  const track = useMemo<MediaTrack | null>(() => {
    if (!activeModule || !trackId) return null;
    const block = activeModule.blocks.find((b) => b.id === trackId);
    return block ? trackFromBlock(block) : null;
  }, [activeModule, trackId]);

  const selectModule = useCallback(
    (index: number) => {
      if (states[index] === "locked") return;
      const target = modules[index];
      if (target) setVisitedOverride(new Set(visited).add(target.id));
      setActiveOverride(index);
      setRevealAll(false);
      setRailOpen(false);
      contentRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [states, modules, visited, reduceMotion],
  );

  const markCheckpoint = useCallback(
    (id: string) => {
      setCheckpointOverride(new Set(checkpoints).add(id));
      // Bring the newly revealed item into view once it has rendered.
      window.setTimeout(() => {
        document.getElementById(`item-${id}`)?.nextElementSibling?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      }, 60);
    },
    [checkpoints, reduceMotion],
  );

  const openTutorWith = useCallback((question: string) => {
    setSeed((prev) => ({ nonce: prev.nonce + 1, question }));
    setTutorOpen(true);
  }, []);

  // generating / failed states
  if (course.status !== "ready" || modules.length === 0) {
    const failed = course.status === "failed";
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center px-4 py-16">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong w-full max-w-xl rounded-4xl p-8 text-center"
        >
          <span className="text-5xl" aria-hidden="true">
            {failed ? "😅" : "👩‍🍳"}
          </span>
          <Pill tone={failed ? "rose" : "sun"} className="mt-4">
            {failed ? "Something went wrong" : "Still baking"}
          </Pill>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink">{course.title}</h2>
          {failed ? (
            <>
              <p className="mt-3 text-base font-semibold text-ink-soft">
                {stripEmDashes(String((course.generationMeta as { error?: string } | null)?.error ?? "The generator stopped before your course was saved."))}
              </p>
              <div className="mt-6 flex justify-center">
                <ButtonLink href={`/setup/${course.id}`} size="lg">
                  Try again
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-base font-semibold text-ink-soft">
                We are writing your lessons, scenarios and quizzes right now. This page refreshes on its own.
              </p>
              <div className="mt-6 grid gap-3">
                <div className="skeleton mx-auto h-6 w-2/3 rounded-xl" />
                <div className="skeleton h-20 w-full rounded-3xl" />
                <div className="skeleton h-20 w-full rounded-3xl" />
              </div>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  const overallPct = Math.round((completeCount / modules.length) * 100);

  const tutor = activeModule ? (
    <AiPanel
      key={activeModule.id}
      courseId={course.id}
      moduleId={activeModule.id}
      moduleTitle={activeModule.title}
      seed={seed}
      onClose={tutorOpen ? () => setTutorOpen(false) : undefined}
      className="h-full"
    />
  ) : null;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-3 px-3 sm:px-4">
        <Logo compact />
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          className="glass inline-flex h-10 items-center gap-2 rounded-2xl px-3 text-sm font-extrabold text-ink xl:hidden"
          aria-label="Open module list"
        >
          <span aria-hidden="true">☰</span>
          <span className="hidden sm:inline">Modules</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold leading-tight text-ink sm:text-lg">{course.title}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">
              Module {safeActive + 1} of {modules.length}
            </span>
            <span className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-ink/8 md:block" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallPct} aria-label="Course progress">
              <motion.span
                className="block h-full rounded-full bg-brand-gradient"
                initial={false}
                animate={{ width: `${overallPct}%` }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
              />
            </span>
            <span className="hidden text-[11px] font-extrabold text-brand-violet-deep md:inline">{overallPct}%</span>
          </div>
        </div>
        <ButtonLink href="/dashboard" variant="secondary" size="sm" className="hidden sm:inline-flex">
          My courses
        </ButtonLink>
        <Button variant="primary" size="sm" className="lg:hidden" onClick={() => setTutorOpen(true)} leading={<span aria-hidden="true">🤖</span>}>
          Tutor
        </Button>
      </header>

      {/* Split pane */}
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
        {/* Module rail */}
        <aside className="glass hidden w-72 shrink-0 flex-col rounded-4xl p-4 xl:flex">
          <div className="mb-4 rounded-3xl bg-brand-gradient-soft p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-violet-deep">Your progress</p>
            <p className="mt-1 font-display text-3xl font-bold text-ink">{overallPct}%</p>
            <p className="text-xs font-bold text-ink-soft">
              {completeCount} of {modules.length} modules done
            </p>
          </div>
          <ModuleTimeline modules={modules} activeIndex={safeActive} states={states} progress={moduleProgress} onSelect={selectModule} />
        </aside>

        {/* Content pane */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={contentRef} className="glass scroll-slim min-h-0 flex-1 overflow-y-auto rounded-4xl" aria-live="polite">
            <AnimatePresence mode="wait">
              {activeModule ? (
                <motion.div
                  key={activeModule.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10"
                >
                  <header className="mb-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="violet">Module {safeActive + 1}</Pill>
                      <Pill tone="neutral">
                        {items.filter(itemDone).length} of {items.length} steps
                      </Pill>
                      <button
                        type="button"
                        onClick={() => setRevealAll((v) => !v)}
                        className="ml-auto text-xs font-extrabold text-brand-ocean-deep underline decoration-2 underline-offset-2"
                      >
                        {revealAll || firstPendingIndex === -1 ? "Step by step" : "Show everything"}
                      </button>
                    </div>
                    <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
                      {stripEmDashes(activeModule.title)}
                    </h1>
                    <p className="mt-4 rounded-3xl bg-brand-sun-soft px-5 py-4 text-base font-semibold leading-relaxed text-ink">
                      <span className="mr-2 font-extrabold text-[#8a5a00]">By the end you will</span>
                      {stripEmDashes(activeModule.objective)}
                    </p>
                  </header>

                  <div className="space-y-6">
                    {items.slice(0, revealedCount).map((item, i) => {
                      const done = itemDone(item);
                      const isLast = i === items.length - 1;
                      const loaded = item.kind === "chunk" && trackId === item.blockId;
                      return (
                        <motion.div
                          key={item.id}
                          id={`item-${item.id}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                          className="scroll-mt-6"
                        >
                          {item.kind === "chunk" ? (
                            <article className="rounded-4xl bg-white p-6 shadow-soft sm:p-8">
                              {item.title ? (
                                <div className="mb-4 flex items-start justify-between gap-3">
                                  <h2 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">{stripEmDashes(item.title)}</h2>
                                  {item.firstOfBlock ? (
                                    <button
                                      type="button"
                                      onClick={() => setTrackOverride({ moduleId: activeModule.id, blockId: item.blockId })}
                                      aria-pressed={loaded}
                                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                                        loaded ? "bg-brand-violet text-white shadow-pop" : "bg-brand-violet-soft text-brand-violet-deep hover:bg-brand-violet hover:text-white"
                                      }`}
                                    >
                                      {loaded ? "● In player" : "🎧 Listen"}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                              <MarkdownContent markdown={item.markdown} />
                              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                                <span className="text-xs font-bold text-ink-faint">About {Math.max(1, Math.round(item.seconds / 60))} min read</span>
                                {done ? (
                                  <CheckpointDone label="Got it" />
                                ) : (
                                  <Button size="md" variant="primary" onClick={() => markCheckpoint(item.id)} trailing={<span aria-hidden="true">👍</span>}>
                                    {isLast ? "Got it" : "Got it, next"}
                                  </Button>
                                )}
                              </div>
                            </article>
                          ) : item.kind === "scenario" && item.block.content.kind === "scenario" ? (
                            <div>
                              <ScenarioCard scenario={item.block.content} />
                              <div className="mt-3 flex justify-end">
                                {done ? (
                                  <CheckpointDone label="Scenario done" />
                                ) : (
                                  <Button size="md" variant="ocean" onClick={() => markCheckpoint(item.id)} trailing={<span aria-hidden="true">→</span>}>
                                    I have thought it through
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : item.kind === "quiz" && item.block.content.kind === "quiz" ? (
                            <QuizCard
                              quiz={item.block.content}
                              index={item.quizIndex}
                              passed={passedQuizIds.has(item.block.id)}
                              onPass={() => setPassedOverride(new Set(passedQuizIds).add(item.block.id))}
                              onAskTutor={openTutorWith}
                            />
                          ) : null}
                        </motion.div>
                      );
                    })}
                  </div>

                  {revealedCount < items.length ? (
                    <p className="mt-6 text-center text-sm font-bold text-ink-faint">
                      {items.length - revealedCount} more {items.length - revealedCount === 1 ? "step" : "steps"} in this module
                    </p>
                  ) : null}

                  <footer className="mt-10 flex flex-col items-start gap-4 rounded-4xl bg-brand-gradient-soft p-6 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-base font-bold text-ink">
                      {activeComplete
                        ? allComplete
                          ? "That is the whole course. Seriously well done. 🎉"
                          : "Module done! The next one is open."
                        : firstPendingIndex === -1
                          ? "Almost there."
                          : "Work through each step and pass the quick check to unlock the next module."}
                    </p>
                    {hasNext ? (
                      <Button size="lg" disabled={!activeComplete} onClick={() => selectModule(safeActive + 1)} trailing={<span aria-hidden="true">→</span>}>
                        {activeComplete ? "Next module" : "Locked"}
                      </Button>
                    ) : allComplete ? (
                      <ButtonLink href="/dashboard" size="lg" variant="dark">
                        Back to my courses
                      </ButtonLink>
                    ) : null}
                  </footer>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {initialSpeed !== null ? (
            <div className="mt-3">
              <MediaBar track={track} moduleLabel={activeModule ? `Module ${safeActive + 1}` : ""} initialSpeed={initialSpeed} />
            </div>
          ) : null}
        </main>

        {/* AI artifact engine (persistent on large screens) */}
        <aside className="hidden w-[24rem] shrink-0 lg:flex xl:w-[27rem] 2xl:w-[30rem]">{tutor}</aside>
      </div>

      {/* Mobile: module rail drawer */}
      <AnimatePresence>
        {railOpen ? (
          <>
            <motion.button
              key="rail-scrim"
              type="button"
              aria-label="Close module list"
              onClick={() => setRailOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm xl:hidden"
            />
            <motion.aside
              key="rail"
              initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="glass-strong fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-sm flex-col rounded-r-4xl p-4 xl:hidden"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-lg font-bold text-ink">{course.title}</p>
                <button type="button" onClick={() => setRailOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink-soft shadow-soft">
                  ✕
                </button>
              </div>
              <ModuleTimeline modules={modules} activeIndex={safeActive} states={states} progress={moduleProgress} onSelect={selectModule} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Mobile: tutor sheet */}
      <AnimatePresence>
        {tutorOpen ? (
          <>
            <motion.button
              key="tutor-scrim"
              type="button"
              aria-label="Close tutor"
              onClick={() => setTutorOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              key="tutor-sheet"
              initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="fixed inset-x-0 bottom-0 z-50 h-[88dvh] p-2 lg:hidden"
            >
              {tutor}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
