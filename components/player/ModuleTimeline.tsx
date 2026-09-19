"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { PlayerModule } from "@/lib/types";

export type ModuleState = "locked" | "available" | "active" | "complete";

type Props = {
  courseTitle: string;
  targetAudience: string;
  modules: PlayerModule[];
  activeIndex: number;
  states: ModuleState[];
  /** 0..1 fraction of quiz gates passed per module */
  progress: number[];
  onSelect: (index: number) => void;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M5 10.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="4.5" y="9" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function ModuleTimeline({
  courseTitle,
  targetAudience,
  modules,
  activeIndex,
  states,
  progress,
  onSelect,
}: Props) {
  const reduceMotion = useReducedMotion();
  const completed = states.filter((s) => s === "complete").length;
  const overall = modules.length ? completed / modules.length : 0;

  return (
    <nav
      aria-label="Course modules"
      className="glass-panel flex h-full flex-col rounded-3xl bg-white/[0.04] p-5 backdrop-blur-xl"
    >
      <div className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">
          Your intensive
        </p>
        <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-white">
          {courseTitle}
        </h2>
        <p className="mt-1.5 line-clamp-2 text-xs text-neutral-400">{targetAudience}</p>

        <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-neutral-400">
          <span>
            {completed}/{modules.length} complete
          </span>
          <span className="text-violet-300">{Math.round(overall * 100)}%</span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(overall * 100)}
          aria-label="Course progress"
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 shadow-[0_0_14px_rgba(34,211,238,0.6)]"
            initial={false}
            animate={{ width: `${overall * 100}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 110, damping: 20 }}
          />
        </div>
      </div>

      <ol className="scroll-slim relative flex-1 space-y-1 overflow-y-auto pr-1">
        {/* vertical rail */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-cyan-400/40 via-white/10 to-violet-400/30"
        />

        {modules.map((module, index) => {
          const state = states[index] ?? "locked";
          const isActive = index === activeIndex;
          const isLocked = state === "locked";
          const pct = Math.round((progress[index] ?? 0) * 100);

          return (
            <li key={module.id} className="relative">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onSelect(index)}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={isLocked}
                aria-label={`Module ${index + 1}: ${module.title}${isLocked ? " (locked)" : state === "complete" ? " (complete)" : ""}`}
                className={`group relative flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-400/12 to-violet-500/10 ring-1 ring-cyan-300/30"
                    : isLocked
                      ? "cursor-not-allowed opacity-55"
                      : "hover:bg-white/[0.05]"
                }`}
              >
                <span
                  className={`relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition ${
                    state === "complete"
                      ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.45)]"
                      : isActive
                        ? "timeline-node-active border-cyan-300 bg-cyan-400 text-neutral-950"
                        : isLocked
                          ? "border-white/15 bg-neutral-900 text-neutral-500"
                          : "border-violet-300/50 bg-violet-500/20 text-violet-100"
                  }`}
                >
                  {state === "complete" ? <CheckIcon /> : isLocked ? <LockIcon /> : index + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-medium ${
                      isActive ? "text-white" : isLocked ? "text-neutral-500" : "text-neutral-200"
                    }`}
                  >
                    {module.title}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-neutral-500">
                    {module.objective}
                  </span>
                  {!isLocked && state !== "complete" ? (
                    <span className="mt-1.5 block h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.span
                        className="block h-full rounded-full bg-cyan-300"
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: reduceMotion ? 0 : 0.4 }}
                      />
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
