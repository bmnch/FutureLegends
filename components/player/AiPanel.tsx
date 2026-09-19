"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { artifactLabel, type Artifact } from "@/lib/artifacts";
import type { ChatTurn } from "@/lib/types";
import { ArtifactRenderer } from "./artifacts/ArtifactRenderer";
import { MarkdownContent } from "./MarkdownContent";

type Source = { blockId: string; title: string; type: string; score: number };

type Message = ChatTurn & {
  id: string;
  sources?: Source[];
  artifactIndex?: number;
  pending?: boolean;
  error?: boolean;
};

export type TutorSeed = { nonce: number; question: string };

type Props = {
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  seed: TutorSeed;
  /** Rendered as a sheet on small screens, so it needs a close button. */
  onClose?: () => void;
  className?: string;
};

const SUGGESTIONS = [
  { label: "Show me the steps", question: "Walk me through this as clear numbered steps." },
  { label: "Make me a checklist", question: "Turn the key things from this module into a checklist I can tick off." },
  { label: "What should I do first?", question: "What is the very first thing I should do today, based on this module?" },
  { label: "Quiz me", question: "Give me three quick flashcards for the most important terms here." },
];

const ARTIFACT_EMOJI: Record<Artifact["type"], string> = {
  code: "💻",
  graph: "📈",
  chart: "📊",
  checklist: "✅",
  steps: "🪜",
  table: "🗂️",
  flashcards: "🃏",
  mockup: "📱",
  calculator: "🧮",
};

export function AiPanel({ courseId, moduleId, moduleTitle, seed, onClose, className = "" }: Props) {
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Adopt a new seed (for example "explain this wrong quiz answer") while rendering.
  const [seenSeed, setSeenSeed] = useState(seed.nonce);
  if (seed.nonce !== seenSeed) {
    setSeenSeed(seed.nonce);
    if (seed.question) setInput(seed.question);
  }

  useEffect(() => {
    if (seed.nonce > 0) inputRef.current?.focus();
  }, [seed.nonce]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, reduceMotion]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || sending) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: q };
    const pendingId = crypto.randomUUID();
    const history: ChatTurn[] = messages
      .filter((m) => !m.pending && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, { id: pendingId, role: "assistant", content: "", pending: true }]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/module-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, moduleId, question: q, history }),
      });
      const data = (await response.json()) as {
        answer?: string;
        artifact?: Artifact | null;
        sources?: Source[];
        error?: string;
      };
      if (!response.ok || !data.answer) {
        throw new Error(data.error ?? "The tutor could not answer right now.");
      }

      let artifactIndex: number | undefined;
      if (data.artifact) {
        const nextIndex = artifacts.length;
        artifactIndex = nextIndex;
        setArtifacts((prev) => [...prev, data.artifact!]);
        setActiveArtifact(nextIndex);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: data.answer!, sources: data.sources, artifactIndex, pending: false }
            : m,
        ),
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, pending: false, error: true, content: error instanceof Error ? error.message : "Something went wrong." }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void ask(input);
  }

  const current = activeArtifact !== null ? artifacts[activeArtifact] ?? null : null;

  return (
    <section
      aria-labelledby={headingId}
      className={`glass-strong flex h-full min-h-0 flex-col overflow-hidden rounded-4xl ${className}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-lg text-white shadow-pop" aria-hidden="true">
            🤖
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="truncate font-display text-lg font-bold text-ink">
              Your tutor
            </h2>
            <p className="truncate text-xs font-semibold text-ink-soft">Knows this module inside out: {moduleTitle}</p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutor"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink-soft shadow-soft transition hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </header>

      {/* Artifact window */}
      <div
        className={`relative flex flex-col border-b border-line bg-brand-gradient-soft/70 transition-[flex-basis] duration-300 ${
          expanded ? "flex-[1_1_70%]" : current ? "flex-[0_0_auto] max-h-[46%]" : "flex-[0_0_auto]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-violet-deep">Artifact window</p>
          {current ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg bg-white/80 px-2.5 py-1 text-xs font-extrabold text-ink-soft shadow-soft transition hover:text-ink"
            >
              {expanded ? "Shrink" : "Expand"}
            </button>
          ) : null}
        </div>

        {artifacts.length > 1 ? (
          <div className="scroll-slim flex gap-1.5 overflow-x-auto px-4 pt-2" role="tablist" aria-label="Artifacts">
            {artifacts.map((a, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === activeArtifact}
                onClick={() => setActiveArtifact(i)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold transition ${
                  i === activeArtifact ? "bg-ink text-white" : "bg-white/80 text-ink-soft hover:text-ink"
                }`}
              >
                {ARTIFACT_EMOJI[a.type]} {a.title.length > 22 ? `${a.title.slice(0, 21)}…` : a.title}
              </button>
            ))}
          </div>
        ) : null}

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={`${activeArtifact}-${current.type}`}
                initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span aria-hidden="true">{ARTIFACT_EMOJI[current.type]}</span>
                  <h3 className="font-display text-base font-bold text-ink">{current.title}</h3>
                  <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-faint">
                    {artifactLabel(current)}
                  </span>
                </div>
                <ArtifactRenderer artifact={current} />
                {current.caption ? <p className="mt-2 text-xs font-semibold text-ink-soft">{current.caption}</p> : null}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3"
              >
                <motion.span
                  aria-hidden="true"
                  className="text-2xl"
                  animate={reduceMotion ? undefined : { rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2 }}
                >
                  🎨
                </motion.span>
                <p className="text-sm font-semibold text-ink-soft">
                  Ask for steps, a checklist, a comparison or a quick calculator and it will show up here.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chat */}
      <div ref={listRef} className="scroll-slim min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink-soft">Stuck on something? Ask away. Or try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <motion.button
                  key={s.label}
                  type="button"
                  onClick={() => void ask(s.question)}
                  whileHover={reduceMotion ? undefined : { y: -2 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  className="rounded-full bg-white px-3.5 py-2 text-sm font-extrabold text-brand-violet-deep shadow-soft transition hover:bg-brand-violet-soft"
                >
                  {s.label}
                </motion.button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-3xl px-4 py-3 text-sm font-semibold leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-lg bg-brand-gradient text-white shadow-pop"
                  : m.error
                    ? "rounded-bl-lg bg-brand-rose-soft text-brand-rose"
                    : "rounded-bl-lg bg-white text-ink shadow-soft"
              }`}
            >
              {m.pending ? (
                <span className="flex items-center gap-1.5 py-1" aria-label="Tutor is thinking">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-2 w-2 rounded-full bg-brand-violet"
                      animate={reduceMotion ? undefined : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </span>
              ) : m.role === "assistant" && !m.error ? (
                <>
                  <MarkdownContent markdown={m.content} className="prose-compact" />
                  {typeof m.artifactIndex === "number" ? (
                    <button
                      type="button"
                      onClick={() => setActiveArtifact(m.artifactIndex!)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-violet-soft px-3 py-1 text-xs font-extrabold text-brand-violet-deep transition hover:bg-brand-violet hover:text-white"
                    >
                      {ARTIFACT_EMOJI[artifacts[m.artifactIndex]!.type]} Open artifact
                    </button>
                  ) : null}
                  {m.sources && m.sources.length > 0 ? (
                    <p className="mt-2 border-t border-line pt-2 text-[11px] font-bold text-ink-faint">
                      From: {m.sources.map((s) => s.title).join(", ")}
                    </p>
                  ) : null}
                </>
              ) : (
                m.content
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="border-t border-line p-3">
        <label htmlFor={`${headingId}-input`} className="sr-only">
          Your question
        </label>
        <div className="flex items-end gap-2 rounded-3xl bg-white p-2 shadow-soft focus-within:ring-4 focus-within:ring-brand-violet/15">
          <textarea
            ref={inputRef}
            id={`${headingId}-input`}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            placeholder="Ask about this module"
            className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2 text-sm font-semibold text-ink outline-none placeholder:text-ink-faint"
          />
          <motion.button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-pop transition disabled:opacity-40 disabled:shadow-none"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M3 10h13M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        </div>
        <p className="mt-1.5 px-2 text-[11px] font-semibold text-ink-faint">Enter to send. Shift + Enter for a new line.</p>
      </form>
    </section>
  );
}
