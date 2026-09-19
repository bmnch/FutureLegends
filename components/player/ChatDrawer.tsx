"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ChatTurn } from "@/lib/types";
import { MarkdownContent } from "./MarkdownContent";

type Source = { blockId: string; title: string; type: string; score: number };

type Message = ChatTurn & {
  id: string;
  sources?: Source[];
  model?: string;
  pending?: boolean;
  error?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  /**
   * Pre-filled question (e.g. from a failed quiz attempt). The parent keys
   * this component so a new seed remounts it with the input pre-populated.
   */
  initialInput?: string;
};

const SUGGESTIONS = [
  "Summarise this module in 3 bullet points.",
  "What should I do first, today?",
  "Which of these facts should I double-check locally?",
];

export function ChatDrawer({
  open,
  onClose,
  courseId,
  moduleId,
  moduleTitle,
  initialInput = "",
}: Props) {
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialInput);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || sending) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: q };
    const pendingId = crypto.randomUUID();
    const history: ChatTurn[] = messages
      .filter((m) => !m.pending && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: "assistant", content: "", pending: true },
    ]);
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
        sources?: Source[];
        model?: string;
        error?: string;
      };
      if (!response.ok || !data.answer) {
        throw new Error(data.error ?? "The tutor could not answer right now.");
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: data.answer!, sources: data.sources, model: data.model, pending: false }
            : m,
        ),
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                error: true,
                content: error instanceof Error ? error.message : "Something went wrong.",
              }
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

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="scrim"
            type="button"
            aria-label="Close tutor"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:bg-black/30"
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="glass-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col rounded-l-3xl border-l border-white/10 bg-neutral-950/85 backdrop-blur-2xl sm:max-w-lg"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">
                  Chat with module
                </p>
                <h2 id={headingId} className="mt-1 truncate text-base font-semibold text-white">
                  {moduleTitle}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Answers come strictly from this module&apos;s material.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-neutral-300 transition hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div ref={listRef} className="scroll-slim flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-300">
                    Ask anything about what you just read. Try:
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void ask(s)}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-neutral-200 transition hover:border-cyan-300/40 hover:bg-white/[0.06]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-lg bg-gradient-to-br from-cyan-400 to-violet-400 text-neutral-950"
                        : m.error
                          ? "rounded-bl-lg border border-rose-400/40 bg-rose-500/10 text-rose-100"
                          : "rounded-bl-lg border border-white/10 bg-white/[0.04] text-neutral-100"
                    }`}
                  >
                    {m.pending ? (
                      <span className="flex items-center gap-1.5 py-1" aria-label="Tutor is thinking">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-cyan-300"
                            animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                          />
                        ))}
                      </span>
                    ) : m.role === "assistant" && !m.error ? (
                      <>
                        <MarkdownContent markdown={m.content} className="!max-w-none !text-sm" />
                        {m.sources && m.sources.length > 0 ? (
                          <p className="mt-2.5 border-t border-white/10 pt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                            Sources: {m.sources.map((s) => s.title).join(" · ")}
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

            <form onSubmit={onSubmit} className="border-t border-white/10 p-4">
              <label htmlFor={`${headingId}-input`} className="sr-only">
                Your question
              </label>
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/40 p-2 focus-within:border-cyan-300/50">
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
                  placeholder="Ask about this module…"
                  className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label="Send question"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-neutral-950 transition hover:bg-cyan-300 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path d="M3 10h13M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">
                Enter to send · Shift+Enter for a new line · Esc to close
              </p>
            </form>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function AskQuestionFab({ onClick, hidden }: { onClick: () => void; hidden?: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {!hidden ? (
        <motion.button
          key="fab"
          type="button"
          onClick={onClick}
          initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          whileHover={reduceMotion ? undefined : { scale: 1.04 }}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          className="btn-pulse-cyan fixed bottom-28 right-5 z-30 flex h-14 items-center gap-2.5 rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 px-5 text-sm font-bold text-neutral-950 shadow-[0_10px_40px_rgba(34,211,238,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:bottom-32 lg:right-8"
          aria-label="Ask a question about this module"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path
              d="M12 3C7 3 3 6.6 3 11c0 2.3 1.1 4.3 2.9 5.7L5 21l4.3-2.1c.9.2 1.8.3 2.7.3 5 0 9-3.6 9-8s-4-8-9-8z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 1.8-2.5 3.5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Ask a Question
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
