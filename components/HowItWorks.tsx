"use client";

import { motion, useReducedMotion } from "framer-motion";

const STEPS = [
  {
    step: "01",
    title: "Dump Your Context",
    description:
      "Explain your exact situation — city, school, job, constraints, and what you need to master today.",
  },
  {
    step: "02",
    title: "AI Constructs the Syllabus",
    description:
      "Real-time edge generation turns your brain dump into a highly specific, localized curriculum.",
  },
  {
    step: "03",
    title: "Master the Module",
    description:
      "Unlock interactive text lessons and AI TTS audio narration built around your context.",
  },
] as const;

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="relative mx-auto w-full max-w-6xl px-6 pb-24 sm:px-8"
    >
      <div className="mb-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300/80">
          How it works
        </p>
        <h2
          id="how-it-works-heading"
          className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl"
        >
          From chaos to curriculum
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {STEPS.map((item, index) => (
          <motion.article
            key={item.step}
            initial={reduceMotion ? false : { opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{
              duration: 0.55,
              delay: reduceMotion ? 0 : index * 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="glass-card group relative rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:shadow-[0_0_32px_rgba(34,211,238,0.15)]"
          >
            <span className="font-mono text-xs text-violet-300">{item.step}</span>
            <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {item.description}
            </p>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition group-hover:opacity-100"
              style={{
                background:
                  "linear-gradient(135deg, rgba(34,211,238,0.15), transparent 40%, rgba(124,58,237,0.2))",
              }}
            />
          </motion.article>
        ))}
      </div>
    </section>
  );
}
