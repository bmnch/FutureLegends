"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type Props = Omit<HTMLMotionProps<"div">, "children"> & {
  children: ReactNode;
  /** Adds a lift + tilt on hover. */
  interactive?: boolean;
  tone?: "glass" | "strong" | "tint" | "white";
  className?: string;
};

const TONES = {
  glass: "glass",
  strong: "glass-strong",
  tint: "glass-tint",
  white: "bg-white border border-line shadow-soft",
};

export function GlassCard({
  children,
  interactive = false,
  tone = "glass",
  className = "",
  ...rest
}: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={
        interactive && !reduceMotion ? { y: -6, rotate: -0.4, scale: 1.01 } : undefined
      }
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`rounded-4xl ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
