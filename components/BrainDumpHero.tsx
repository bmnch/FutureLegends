"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AnimatedOrbs } from "@/components/AnimatedOrbs";
import { OnboardingWizard } from "@/components/OnboardingWizard";

type Props = {
  initialAuthRequired?: boolean;
};

export function BrainDumpHero({ initialAuthRequired = false }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="brain-dump-heading"
      className="relative isolate min-h-[100svh] w-full overflow-hidden bg-neutral-950"
    >
      <AnimatedOrbs />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col items-center justify-center px-6 py-20 text-center sm:px-8">
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 font-mono text-xs uppercase tracking-[0.32em] text-cyan-300"
        >
          CiviorAI
        </motion.p>

        <motion.h1
          id="brain-dump-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Don&apos;t search for the answer. Generate the course.
        </motion.h1>

        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="gradient-text mt-5 max-w-2xl text-base leading-relaxed sm:text-lg"
        >
          Tell us exactly what you need to master today, and our AI will build a
          localized, interactive curriculum just for you in seconds.
        </motion.p>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="mt-10 w-full"
        >
          <OnboardingWizard initialAuthRequired={initialAuthRequired} />
        </motion.div>
      </div>
    </section>
  );
}
