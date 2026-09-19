"use client";

import { motion } from "framer-motion";

export function SkeletonLoader() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden py-2"
      role="status"
      aria-live="polite"
      aria-label="Generating your custom syllabus"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-300">
          Scanning brain dump…
        </p>
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee]" />
      </div>

      <div className="space-y-4">
        <div className="skeleton-scan h-8 w-3/4 rounded-xl" />
        <div className="skeleton-scan h-4 w-1/2 rounded-lg" />
        <div className="grid gap-3 pt-2">
          <div className="skeleton-scan h-24 w-full rounded-2xl" />
          <div className="skeleton-scan h-24 w-full rounded-2xl" />
          <div className="skeleton-scan h-24 w-full rounded-2xl" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_60px_rgba(34,211,238,0.12)]"
      />
      <span className="sr-only">Loading syllabus outline</span>
    </motion.div>
  );
}
