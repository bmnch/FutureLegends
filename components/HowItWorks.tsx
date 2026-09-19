"use client";

import { motion, useReducedMotion } from "framer-motion";

const STEPS = [
  {
    emoji: "🧠",
    tone: "from-brand-violet-soft to-white",
    title: "Brain dump it",
    body: "Type what is happening in plain words. City, job, deadline, the thing that is stressing you out. No structure needed.",
  },
  {
    emoji: "🪄",
    tone: "from-brand-coral-soft to-white",
    title: "We build your course",
    body: "Our AI checks the local facts, plans the modules and writes short lessons, real scenarios and quick quizzes just for you.",
  },
  {
    emoji: "🎧",
    tone: "from-brand-ocean-soft to-white",
    title: "Learn it your way",
    body: "Read it, listen to it, or ask the built in tutor anything. Pass a quick check and the next module unlocks.",
  },
] as const;

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="relative w-full scroll-mt-20 px-4 py-24 sm:px-8"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-brand-coral-deep">
            How it works
          </p>
          <h2
            id="how-it-works-heading"
            className="mt-3 text-balance font-display text-4xl font-bold text-ink sm:text-5xl"
          >
            From messy to sorted in about two minutes.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <motion.article
              key={step.title}
              initial={reduceMotion ? false : { opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              whileHover={reduceMotion ? undefined : { y: -8, rotate: index === 1 ? 0.6 : -0.6 }}
              transition={{ duration: 0.55, delay: reduceMotion ? 0 : index * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className={`glass relative overflow-hidden rounded-4xl bg-gradient-to-b ${step.tone} p-7`}
            >
              <span className="absolute right-5 top-4 font-display text-6xl font-bold text-ink/5">
                {index + 1}
              </span>
              <span
                aria-hidden="true"
                className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-3xl shadow-soft"
              >
                {step.emoji}
              </span>
              <h3 className="mt-5 font-display text-2xl font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-base font-semibold leading-relaxed text-ink-soft">{step.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
