"use client";

import { motion } from "framer-motion";

const MESSAGES = ["Reading your notes", "Checking local details", "Sketching the modules"];

export function SkeletonLoader() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="relative"
      role="status"
      aria-live="polite"
      aria-label="Building your plan"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {MESSAGES.map((m, i) => (
          <motion.span
            key={m}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6 }}
            className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-brand-violet-deep shadow-soft"
          >
            {m}
          </motion.span>
        ))}
      </div>
      <div className="space-y-3">
        <div className="skeleton h-24 w-full rounded-3xl" />
        <div className="skeleton h-16 w-full rounded-3xl" />
        <div className="skeleton h-16 w-full rounded-3xl" />
        <div className="skeleton h-16 w-full rounded-3xl" />
      </div>
      <span className="sr-only">Building your course outline</span>
    </motion.div>
  );
}
