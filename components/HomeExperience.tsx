"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AppNavbar } from "@/components/AppNavbar";
import { AuthModal } from "@/components/AuthModal";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { CreateCourseModal } from "@/components/CreateCourseModal";
import { HeroPrompt } from "@/components/HeroPrompt";
import { HowItWorks } from "@/components/HowItWorks";
import { SampleCourses } from "@/components/SampleCourses";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useSession, type SessionUser } from "@/lib/use-session";

type AuthMode = "login" | "register";

type Props = {
  initialUser: SessionUser | null;
  initialAuthRequired?: boolean;
  checkoutCancelled?: boolean;
};

export function HomeExperience({
  initialUser,
  initialAuthRequired = false,
  checkoutCancelled = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const session = useSession(initialUser);

  const [authOpen, setAuthOpen] = useState(initialAuthRequired);
  const [authMode, setAuthMode] = useState<AuthMode>(initialAuthRequired ? "login" : "register");
  const [createOpen, setCreateOpen] = useState(false);
  const [seedBrainDump, setSeedBrainDump] = useState("");
  const [toast, setToast] = useState<string | null>(
    checkoutCancelled ? "No worries, your course is saved. Come back whenever." : null,
  );

  const openAuth = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const startCourse = useCallback((brainDump: string) => {
    setSeedBrainDump(brainDump);
    setCreateOpen(true);
  }, []);

  return (
    <div className="relative flex w-full flex-1 flex-col">
      <AppNavbar
        user={session.user}
        loading={session.loading}
        onSignIn={() => openAuth("login")}
        onSignUp={() => openAuth("register")}
        onSignOut={session.signOut}
        transparent
      />

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={(user) => {
          session.setUser(user);
          setAuthOpen(false);
        }}
      />

      <CreateCourseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialBrainDump={seedBrainDump}
        user={session.user}
        onAuthenticated={(user) => session.setUser(user)}
      />

      {/* Hero */}
      <section
        aria-labelledby="hero-heading"
        className="relative isolate -mt-16 flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 pb-20 pt-28 sm:px-8"
      >
        <BackgroundBlobs />

        <div className="relative z-10 flex w-full max-w-5xl flex-col items-center text-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <Pill tone="violet" icon={<span aria-hidden="true">✨</span>}>
              Courses built for your actual life
            </Pill>
          </motion.div>

          <motion.h1
            id="hero-heading"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="mt-6 max-w-4xl text-balance font-display text-5xl font-bold leading-[1.02] tracking-tight text-ink sm:text-6xl md:text-7xl lg:text-8xl"
          >
            Learn the stuff life{" "}
            <span className="relative inline-block">
              <span className="text-gradient">just threw at you.</span>
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 300 20"
                preserveAspectRatio="none"
                className="absolute -bottom-3 left-0 h-3 w-full sm:-bottom-4 sm:h-4"
              >
                <motion.path
                  d="M4 14 C 70 4, 140 4, 296 12"
                  fill="none"
                  stroke="var(--sun)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  initial={reduceMotion ? undefined : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, delay: 0.5, ease: "easeOut" }}
                />
              </motion.svg>
            </span>
          </motion.h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mt-7 max-w-2xl text-balance text-lg font-semibold leading-relaxed text-ink-soft sm:text-xl"
          >
            New city? New job? A test next week? Tell us what is going on and we
            will build you a short, friendly course made for exactly that.
          </motion.p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 w-full max-w-3xl"
          >
            <HeroPrompt onStart={startCourse} />
          </motion.div>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.35 }}
            className="mt-6 text-sm font-semibold text-ink-faint"
          >
            Free preview of your course outline. No card needed to start.
          </motion.p>
        </div>

        <motion.a
          href="#how-it-works"
          aria-label="Scroll to how it works"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full p-2 text-ink-faint hover:text-ink"
        >
          <motion.span
            className="block"
            animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        </motion.a>
      </section>

      <HowItWorks />

      <SampleCourses onPick={startCourse} />

      {/* Closing CTA */}
      <section className="relative w-full overflow-hidden px-4 pb-24 pt-10 sm:px-8">
        <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-5xl bg-brand-gradient gradient-shift px-6 py-16 text-center text-white shadow-pop sm:px-12">
          <div aria-hidden="true" className="blob -left-10 -top-16 h-56 w-56 bg-white/30" />
          <div aria-hidden="true" className="blob -bottom-20 right-0 h-64 w-64 bg-brand-sun/60" />
          <h2 className="relative font-display text-4xl font-bold sm:text-5xl">
            Ready when you are.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg font-semibold text-white/90">
            Type one messy paragraph. Get a clean plan. Start feeling on top of it today.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="dark"
              size="lg"
              onClick={() => {
                document.getElementById("hero-heading")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
                setTimeout(() => document.getElementById("hero-prompt")?.focus(), 500);
              }}
            >
              Build my course
            </Button>
            {!session.user ? (
              <Button variant="secondary" size="lg" onClick={() => openAuth("login")}>
                I already have an account
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="w-full px-6 pb-10 text-center text-sm font-semibold text-ink-faint">
        Made with care in Toronto. CiviorAI checks local facts but always confirm
        anything official with the source.
      </footer>

      <AnimatePresence>
        {toast ? (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-strong fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-ink"
          >
            {toast}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-lg px-2 py-1 text-ink-faint hover:text-ink"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
