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

export const STAGE_ORDER: Array<{ id: PipelineStage; label: string; agent: string }> = [
  { id: "research", label: "Grounding facts", agent: "Research Agent" },
  { id: "architect", label: "Designing syllabus", agent: "Architect Agent" },
  { id: "content", label: "Writing modules in parallel", agent: "Content Agents" },
  { id: "audio", label: "Reserving narration", agent: "TTS Agent" },
  { id: "persist", label: "Saving to D1", agent: "Supervisor" },
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
      return event.message === "…"
        ? state
        : { ...state, logs: [...state.logs.slice(-19), event.message] };
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
              ? "border-emerald-300/40 bg-emerald-400/10"
              : s.status === "running"
                ? "border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.18)]"
                : s.status === "error"
                  ? "border-rose-400/50 bg-rose-500/10"
                  : "border-white/10 bg-white/[0.02]";

          return (
            <motion.li
              key={stage.id}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${tone}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
                  s.status === "done"
                    ? "bg-emerald-400 text-neutral-950"
                    : s.status === "running"
                      ? "bg-cyan-400 text-neutral-950"
                      : s.status === "error"
                        ? "bg-rose-500 text-white"
                        : "bg-white/10 text-neutral-400"
                }`}
                aria-hidden="true"
              >
                {s.status === "done" ? "✓" : s.status === "error" ? "!" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{stage.label}</p>
                  <p className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    {stage.agent}
                  </p>
                </div>
                {!compact && s.detail ? (
                  <p className="mt-0.5 truncate text-xs text-neutral-400">{s.detail}</p>
                ) : null}
                {s.status === "running" ? (
                  <span className="sr-only">In progress</span>
                ) : null}
              </div>
              {s.status === "running" ? (
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee]" />
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
                className={`rounded-full border px-3 py-1 text-xs ${
                  m.status === "done"
                    ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                    : m.status === "retrying"
                      ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
                      : "border-cyan-300/30 bg-cyan-400/5 text-cyan-100"
                }`}
              >
                {m.status === "running" ? "✎ " : m.status === "retrying" ? "↻ " : "✓ "}
                {m.title || `Module ${i + 1}`}
              </span>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {state.error ? (
        <p role="alert" className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
