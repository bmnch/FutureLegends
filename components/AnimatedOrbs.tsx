"use client";

import { motion } from "framer-motion";

export function AnimatedOrbs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <motion.div
        className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl"
        animate={{
          x: [0, 80, 20, 0],
          y: [0, 40, -30, 0],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-16 top-32 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl"
        animate={{
          x: [0, -60, -20, 0],
          y: [0, 50, 10, 0],
          scale: [1, 0.9, 1.2, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl"
        animate={{
          x: [0, 40, -50, 0],
          y: [0, -35, 25, 0],
          opacity: [0.5, 0.85, 0.6, 0.5],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0a0a0a_70%)]" />
    </div>
  );
}
