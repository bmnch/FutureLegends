"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { GenerationEvent, PipelineStage } from "@/lib/types";

export type StageStatus = "pending" | "running" | "done" | "error";

export type ProgressState = {
  courseId: string | null;
  stages: Record<PipelineStage, { status: StageStatus; detail?: string }>;
  modules: Array<{ title: string; status: "running" | "done" | "retrying" }>;
  logs: string[];
  error: string | null;
  complete: { title: string; moduleCount: number } | null;
};

export const STAGE_ORDER: Array<{ id: PipelineStage; label: string; emoji: string; blurb: string }> = [
  { id: "research", label: "Checking the local facts", emoji: "🔎", blurb: "Laws, transit, prices, names" },
  { id: "architect", label: "Planning your modules", emoji: "🗺️", blurb: "The shape of the course" },
  { id: "content", label: "Writing the lessons", emoji: "✍️", blurb: "All modules at once" },
  { id: "audio", label: "Setting up audio", emoji: "🎧", blurb: "Narration for every section" },
  { id: "persist", label: "Saving your course", emoji: "💾", blurb: "Almost there" },
];

export function initialProgress(): ProgressState {
  return {
    courseId: null,
    stages: {
      research: { status: "pending" },
      architect: { status: "pending" },
      content: { status: "pending" },
      audio: { status: "pending" },
      persist: { status: "pending" },
    },
    modules: [],
    logs: [],
    error: null,
    complete: null,
  };
}

export function reduceProgress(state: ProgressState, event: GenerationEvent): ProgressState {
  switch (event.type) {
    case "accepted":
      return { ...state, courseId: event.courseId };
    case "stage":
      return {
        ...state,
        stages: {
          ...state.stages,
          [event.stage]: { status: event.status, detail: event.detail },
        },
      };
    case "module": {
      const modules = [...state.modules];
      while (modules.length < event.total) modules.push({ title: "", status: "running" });
      modules[event.index] = { title: event.title, status: event.status };
      return { ...state, modules };
    }
    case "log":
      return event.message === "…" ? state : { ...state, logs: [...state.logs.slice(-19), event.message] };
    case "complete":
      return {
        ...state,
        courseId: event.courseId,
        complete: { title: event.title, moduleCount: event.moduleCount },
      };
    case "error": {
      const stages = { ...state.stages };
      for (const key of Object.keys(stages) as PipelineStage[]) {
        if (stages[key].status === "running") stages[key] = { status: "error" };
      }
      return { ...state, stages, error: event.message };
    }
    default:
      return state;
  }
}

type Props = {
  state: ProgressState;
  compact?: boolean;
};

export function GenerationProgress({ state, compact = false }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <ol className="space-y-2.5">
        {STAGE_ORDER.map((stage, i) => {
          const s = state.stages[stage.id];
          const tone =
            s.status === "done"
              ? "bg-brand-mint-soft"
              : s.status === "running"
                ? "bg-white shadow-pop ring-2 ring-brand-violet/30"
                : s.status === "error"
                  ? "bg-brand-rose-soft"
                  : "bg-white/60";

          return (
            <motion.li
              key={stage.id}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className={`flex items-center gap-3 rounded-3xl px-4 py-3 transition ${tone}`}
            >
              <motion.span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-xl shadow-soft"
                animate={s.status === "running" && !reduceMotion ? { rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] } : undefined}
                transition={{ duration: 1.4, repeat: Infinity }}
                aria-hidden="true"
              >
                {s.status === "done" ? "✅" : s.status === "error" ? "⚠️" : stage.emoji}
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-extrabold ${s.status === "pending" ? "text-ink-faint" : "text-ink"}`}>{stage.label}</p>
                {!compact ? (
                  <p className="mt-0.5 truncate text-xs font-semibold text-ink-soft">{s.detail || stage.blurb}</p>
                ) : null}
                {s.status === "running" ? <span className="sr-only">In progress</span> : null}
              </div>
              {s.status === "running" ? (
                <span className="flex items-center gap-1" aria-hidden="true">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-brand-violet"
                      animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }}
                    />
                  ))}
                </span>
              ) : null}
            </motion.li>
          );
        })}
      </ol>

      <AnimatePresence>
        {state.modules.length > 0 ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap gap-2"
            aria-label="Module writing status"
          >
            {state.modules.map((m, i) => (
              <span
                key={i}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
                  m.status === "done"
                    ? "bg-brand-mint-soft text-brand-mint-deep"
                    : m.status === "retrying"
                      ? "bg-brand-sun-soft text-[#8a5a00]"
                      : "bg-brand-violet-soft text-brand-violet-deep"
                }`}
              >
                {m.status === "running" ? "✍️ " : m.status === "retrying" ? "🔁 " : "✅ "}
                {m.title || `Module ${i + 1}`}
              </span>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {state.error ? (
        <p role="alert" className="rounded-2xl bg-brand-rose-soft px-4 py-3 text-sm font-bold text-brand-rose">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
