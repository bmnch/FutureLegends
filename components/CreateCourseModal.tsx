"use client";

import { useEffect, useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import type { SessionUser } from "@/lib/use-session";

type Props = {
  open: boolean;
  onClose: () => void;
  initialBrainDump?: string;
  user: SessionUser | null;
  onAuthenticated?: (user: SessionUser) => void;
};

/**
 * Full screen "create a course" takeover. Wraps the wizard so the landing page
 * and the dashboard share one flow.
 */
export function CreateCourseModal({ open, onClose, initialBrainDump = "", user, onAuthenticated }: Props) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="create-course"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="glass-strong relative z-10 flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-4xl sm:rounded-4xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
              <p id={titleId} className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-coral-deep">
                New course
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink-soft shadow-soft transition hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="scroll-slim flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <OnboardingWizard initialBrainDump={initialBrainDump} user={user} onAuthenticated={onAuthenticated} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
