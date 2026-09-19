"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { PlayerModule } from "@/lib/types";

export type ModuleState = "locked" | "available" | "active" | "complete";

type Props = {
  modules: PlayerModule[];
  activeIndex: number;
  states: ModuleState[];
  /** 0..1 fraction of the module finished */
  progress: number[];
  onSelect: (index: number) => void;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M5 10.5l3 3 7-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="4.5" y="9" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ModuleTimeline({ modules, activeIndex, states, progress, onSelect }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label="Course modules" className="flex h-full min-h-0 flex-col">
      <p className="mb-3 px-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-faint">Modules</p>
      <ol className="scroll-slim relative min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 left-[19px] top-4 w-0.5 rounded-full bg-gradient-to-b from-brand-violet/40 via-line-strong to-brand-coral/30"
        />
        {modules.map((module, index) => {
          const state = states[index] ?? "locked";
          const isActive = index === activeIndex;
          const isLocked = state === "locked";
          const pct = Math.round((progress[index] ?? 0) * 100);

          return (
            <li key={module.id} className="relative">
              <motion.button
                type="button"
                disabled={isLocked}
                onClick={() => onSelect(index)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Module ${index + 1}: ${module.title}${isLocked ? " (locked)" : state === "complete" ? " (complete)" : ""}`}
                whileHover={reduceMotion || isLocked ? undefined : { x: 3 }}
                className={`group relative flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left transition ${
                  isActive ? "bg-white shadow-soft" : isLocked ? "cursor-not-allowed opacity-60" : "hover:bg-white/70"
                }`}
              >
                <span
                  className={`relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold transition ${
                    state === "complete"
                      ? "bg-brand-mint text-white"
                      : isActive
                        ? "animate-pulse-ring bg-brand-gradient text-white"
                        : isLocked
                          ? "bg-ink/8 text-ink-faint"
                          : "bg-brand-violet-soft text-brand-violet-deep"
                  }`}
                >
                  {state === "complete" ? <CheckIcon /> : isLocked ? <LockIcon /> : index + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-extrabold leading-snug ${isActive ? "text-ink" : isLocked ? "text-ink-faint" : "text-ink-soft"}`}>
                    {module.title}
                  </span>
                  {!isLocked && state !== "complete" ? (
                    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
                      <motion.span
                        className="block h-full rounded-full bg-brand-gradient"
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: reduceMotion ? 0 : 0.4 }}
                      />
                    </span>
                  ) : null}
                </span>
              </motion.button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
