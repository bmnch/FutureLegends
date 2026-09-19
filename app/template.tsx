"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Remounts on every route change, which gives each page a soft entrance.
 * Kept short so navigation still feels instant.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-dvh w-full flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
