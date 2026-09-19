"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Mode = "login" | "register";

type Props = {
  open: boolean;
  initialMode?: Mode;
  onClose: () => void;
  onAuthenticated?: (user: { id: string; email: string }) => void;
};

export function AuthModal({
  open,
  initialMode = "login",
  onClose,
  onAuthenticated,
}: Props) {
  const titleId = useId();
  const emailId = useId();
  const passwordId = useId();
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
      return () => window.clearTimeout(timer);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const action = mode === "login" ? "login" : "register";
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const rawText = await response.text();
        console.error("[auth] non-JSON response", {
          action,
          status: response.status,
          contentType,
          body: rawText.slice(0, 1000),
        });
        throw new Error(
          `Server error (${response.status}): ${
            rawText.trim().slice(0, 200) || "empty response body"
          }`,
        );
      }

      const data = (await response.json()) as {
        error?: string;
        user?: { id: string; email: string };
      };

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? "Authentication failed.");
      }

      onAuthenticated?.(data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
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
            aria-label="Close authentication dialog"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="glass-panel relative z-10 w-full max-w-md rounded-2xl bg-white/5 p-6 shadow-[0_0_48px_rgba(34,211,238,0.12)] backdrop-blur-lg"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">
                  CiviorAI Access
                </p>
                <h2 id={titleId} className="mt-2 text-xl font-semibold text-white">
                  {mode === "login" ? "Sign in to unlock" : "Create your account"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-2 py-1 text-sm text-neutral-400 transition hover:text-white"
              >
                Esc
              </button>
            </div>

            <div
              role="tablist"
              aria-label="Authentication mode"
              className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/30 p-1"
            >
              {(
                [
                  ["login", "Sign In"],
                  ["register", "Sign Up"],
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
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                    mode === value
                      ? "bg-cyan-400 text-neutral-950"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor={emailId} className="text-sm text-neutral-300">
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
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-cyan-400/50 focus:outline-none"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor={passwordId} className="text-sm text-neutral-300">
                  Password
                </label>
                <input
                  id={passwordId}
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-cyan-400/50 focus:outline-none"
                  placeholder="At least 8 characters"
                />
              </div>

              {error ? (
                <p role="alert" className="text-sm text-rose-400">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 text-sm font-semibold text-neutral-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-60"
              >
                {loading
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
