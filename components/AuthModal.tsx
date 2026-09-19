"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import type { SessionUser } from "@/lib/use-session";

type Mode = "login" | "register";

type Props = {
  open: boolean;
  initialMode?: Mode;
  onClose: () => void;
  onAuthenticated?: (user: SessionUser) => void;
};

export function AuthModal({ open, initialMode = "login", onClose, onAuthenticated }: Props) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const emailId = useId();
  const passwordId = useId();
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the dialog opens (state adjustment during render).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMode(initialMode);
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error(`The server had a hiccup (${response.status}). Try again.`);
      }
      const data = (await response.json()) as { error?: string; user?: SessionUser };
      if (!response.ok || !data.user) {
        throw new Error(data.error ?? "That did not work. Check your details and try again.");
      }
      onAuthenticated?.(data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="glass-strong relative z-10 w-full max-w-md rounded-4xl p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <LogoMark className="h-11 w-11" />
                <div>
                  <h2 id={titleId} className="font-display text-2xl font-bold text-ink">
                    {mode === "login" ? "Welcome back" : "Let's get you set up"}
                  </h2>
                  <p className="text-sm font-semibold text-ink-soft">
                    {mode === "login" ? "Pick up where you left off." : "Free account. Ten seconds."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink-soft shadow-soft transition hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div role="tablist" aria-label="Sign in or create account" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-ink/6 p-1">
              {(
                [
                  ["login", "Log in"],
                  ["register", "Create account"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => {
                    setMode(value);
                    setError(null);
                  }}
                  className={`rounded-xl px-3 py-2.5 text-sm font-extrabold transition ${
                    mode === value ? "bg-white text-ink shadow-soft" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor={emailId} className="text-sm font-extrabold text-ink">
                  Email
                </label>
                <input
                  ref={firstFieldRef}
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-2xl border border-line-strong bg-white px-4 py-3 text-base font-semibold text-ink outline-none focus:border-brand-violet focus:ring-4 focus:ring-brand-violet/15"
                />
              </div>
              <div>
                <label htmlFor={passwordId} className="text-sm font-extrabold text-ink">
                  Password
                </label>
                <input
                  id={passwordId}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="mt-1.5 w-full rounded-2xl border border-line-strong bg-white px-4 py-3 text-base font-semibold text-ink outline-none focus:border-brand-violet focus:ring-4 focus:ring-brand-violet/15"
                />
              </div>

              {error ? (
                <p role="alert" className="rounded-2xl bg-brand-rose-soft px-4 py-3 text-sm font-bold text-brand-rose">
                  {error}
                </p>
              ) : null}

              <Button type="submit" size="lg" className="w-full" loading={loading}>
                {loading ? "One sec" : mode === "login" ? "Log in" : "Create my account"}
              </Button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
