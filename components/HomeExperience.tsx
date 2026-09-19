"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedOrbs } from "@/components/AnimatedOrbs";
import { AuthModal } from "@/components/AuthModal";
import { HowItWorks } from "@/components/HowItWorks";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SiteNavbar } from "@/components/SiteNavbar";

type AuthMode = "login" | "register";

type Props = {
  initialAuthRequired?: boolean;
};

export function HomeExperience({ initialAuthRequired = false }: Props) {
  const reduceMotion = useReducedMotion();
  const wizardAnchorRef = useRef<HTMLDivElement | null>(null);

  const [authOpen, setAuthOpen] = useState(initialAuthRequired);
  const [authMode, setAuthMode] = useState<AuthMode>(
    initialAuthRequired ? "login" : "register",
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [wizardSession, setWizardSession] = useState(0);
  const [enterOnboardingOnAuth, setEnterOnboardingOnAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { authenticated?: boolean };
        if (!cancelled) setAuthenticated(Boolean(data.authenticated));
      } catch {
        if (!cancelled) setAuthenticated(false);
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  function openAuth(mode: AuthMode, options?: { enterOnboarding?: boolean }) {
    setAuthMode(mode);
    setEnterOnboardingOnAuth(Boolean(options?.enterOnboarding));
    setAuthOpen(true);
  }

  function handleAuthenticated() {
    setAuthenticated(true);
    setAuthOpen(false);

    if (enterOnboardingOnAuth || authMode === "register") {
      setWizardSession((value) => value + 1);
      window.requestAnimationFrame(() => {
        wizardAnchorRef.current?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "center",
        });
      });
    }

    setEnterOnboardingOnAuth(false);
  }

  return (
    <div className="bg-neutral-950">
      <SiteNavbar
        authenticated={authenticated}
        onSignIn={() => openAuth("login")}
        onSignUp={() => openAuth("register", { enterOnboarding: true })}
      />

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => {
          setAuthOpen(false);
          setEnterOnboardingOnAuth(false);
        }}
        onAuthenticated={handleAuthenticated}
      />

      <section
        aria-labelledby="brain-dump-heading"
        className="relative isolate min-h-[100svh] w-full overflow-hidden bg-neutral-950"
      >
        <AnimatedOrbs />

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center sm:px-8">
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
            Tell us exactly what you need to master today, and our AI will build
            a localized, interactive curriculum just for you in seconds.
          </motion.p>

          <motion.div
            ref={wizardAnchorRef}
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-10 w-full"
          >
            <OnboardingWizard
              key={wizardSession}
              initialAuthRequired={initialAuthRequired && wizardSession === 0}
              initialAuthenticated={authenticated}
            />
          </motion.div>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.28 }}
            className="mt-6 text-sm text-neutral-500"
          >
            Already know what you want?{" "}
            <button
              type="button"
              onClick={() => openAuth("register", { enterOnboarding: true })}
              className="text-cyan-300 underline decoration-cyan-500/40 underline-offset-4 transition hover:text-cyan-200 hover:decoration-cyan-300"
            >
              Sign up to skip the preview.
            </button>
          </motion.p>
        </div>
      </section>

      <div className="relative overflow-hidden bg-neutral-950">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/4 top-0 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-1/4 top-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl"
        />
        <HowItWorks />
      </div>
    </div>
  );
}
