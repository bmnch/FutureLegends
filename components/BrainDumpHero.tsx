"use client";

import { useId, useState, type FormEvent } from "react";
import type { SyllabusOutline } from "@/lib/types";
import { SyllabusOutlineView } from "@/components/SyllabusOutlineView";
import { SkeletonLoader } from "@/components/SkeletonLoader";

const PLACEHOLDER =
  "e.g., I am an engineering student at TMU starting a hospitality job downtown. I need to know how to navigate transit, set up my bank for payroll, and understand my workplace rights.";

export function BrainDumpHero() {
  const textareaId = useId();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syllabus, setSyllabus] = useState<SyllabusOutline | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Please describe your situation before generating a syllabus.");
      return;
    }

    setLoading(true);
    setError(null);
    setSyllabus(null);

    try {
      const response = await fetch("/api/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brainDump: trimmed }),
      });

      const data = (await response.json()) as {
        syllabus?: SyllabusOutline;
        error?: string;
      };

      if (!response.ok || !data.syllabus) {
        throw new Error(data.error ?? "Failed to generate syllabus.");
      }

      setSyllabus({ ...data.syllabus, rawBrainDump: trimmed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function startCheckout() {
    if (!syllabus) return;
    setCheckoutLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus }),
      });

      const data = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setCheckoutLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="brain-dump-heading"
      className="relative grid-atmosphere min-h-[100svh] w-full"
    >
      <div className="mx-auto flex min-h-[100svh] w-full max-w-4xl flex-col justify-center px-6 py-16 sm:px-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-neon">
          CiviorAI
        </p>
        <h1
          id="brain-dump-heading"
          className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl"
        >
          Brain dump today. Walk into tomorrow prepared.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Spill the context — school, job, city, constraints. We turn it into a
          highly specific, localized syllabus you can unlock and narrate.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-10 flex flex-col gap-5"
          aria-busy={loading}
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor={textareaId}
              className="text-sm font-medium text-foreground"
            >
              Describe your situation and what you need to learn today.
            </label>
            <textarea
              id={textareaId}
              name="brainDump"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              disabled={loading}
              aria-required="true"
              aria-invalid={Boolean(error) && !text.trim()}
              aria-describedby={error ? "brain-dump-error" : "brain-dump-hint"}
              className="w-full resize-y rounded-md border border-border bg-surface px-4 py-4 text-base leading-relaxed text-foreground placeholder:text-zinc-600 neon-glow focus:border-neon disabled:opacity-60"
            />
            <p id="brain-dump-hint" className="font-mono text-xs text-muted">
              Tip: include city, institution, workplace, and deadlines.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-neon px-6 text-sm font-semibold tracking-wide text-black transition hover:bg-neon-hot focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Generating…" : "Generate Custom Syllabus"}
          </button>
        </form>

        {error ? (
          <p
            id="brain-dump-error"
            role="alert"
            className="mt-4 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        {loading ? <SkeletonLoader /> : null}

        {syllabus && !loading ? (
          <div className="mt-12 space-y-8">
            <SyllabusOutlineView syllabus={syllabus} />
            <div className="border-t border-border pt-6">
              <button
                type="button"
                onClick={startCheckout}
                disabled={checkoutLoading}
                aria-label="Unlock and narrate full course for four dollars and ninety-nine cents"
                className="inline-flex h-12 w-full items-center justify-center rounded-md border border-neon bg-transparent px-6 text-sm font-semibold tracking-wide text-neon transition hover:bg-neon hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {checkoutLoading
                  ? "Redirecting to checkout…"
                  : "Unlock & Narrate Full Course - $4.99"}
              </button>
              <p className="mt-3 text-xs text-muted">
                Checkout unlocks the full intensive expansion and AI voice
                narration.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
