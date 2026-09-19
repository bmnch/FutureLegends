"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type {
  Artifact,
  ChartArtifact,
  ChecklistArtifact,
  CodeArtifact,
  FlashcardsArtifact,
  MockupArtifact,
  StepsArtifact,
  TableArtifact,
} from "@/lib/artifacts";
import { CalculatorArtifactView } from "./CalculatorArtifactView";
import { GraphArtifactView } from "./GraphArtifactView";

/* ----------------------------------------------------------------------------
   Code
---------------------------------------------------------------------------- */

function CodeView({ artifact }: { artifact: CodeArtifact }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(artifact.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard blocked, nothing to do
    }
  }
  const lines = artifact.code.split("\n");
  return (
    <div className="overflow-hidden rounded-2xl bg-ink text-[#f4f1ff] shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-coral" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand-sun" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand-mint" />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-white/60">{artifact.language}</span>
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-extrabold text-white transition hover:bg-white/20"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scroll-slim overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>
          {lines.map((line, i) => (
            <span key={i} className="block">
              <span className="mr-4 inline-block w-6 select-none text-right text-white/30">{i + 1}</span>
              {line}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Chart
---------------------------------------------------------------------------- */

function ChartView({ artifact }: { artifact: ChartArtifact }) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(...artifact.data.map((d) => d.value), 0) || 1;
  const min = Math.min(...artifact.data.map((d) => d.value), 0);
  const colors = ["var(--violet)", "var(--coral)", "var(--ocean)", "var(--mint)", "var(--sun)"];

  if (artifact.kind === "line") {
    const W = 600;
    const H = 240;
    const pad = 28;
    const n = artifact.data.length;
    const px = (i: number) => pad + (i / Math.max(n - 1, 1)) * (W - pad * 2);
    const py = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
    const d = artifact.data.map((p, i) => `${i === 0 ? "M" : "L"}${px(i)},${py(p.value)}`).join(" ");
    return (
      <div className="rounded-2xl bg-white p-3 shadow-soft">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={artifact.title}>
          <motion.path
            d={d}
            fill="none"
            stroke="var(--violet)"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9 }}
          />
          {artifact.data.map((p, i) => (
            <g key={p.label}>
              <circle cx={px(i)} cy={py(p.value)} r="6" fill="white" stroke="var(--coral)" strokeWidth="3" />
              <text x={px(i)} y={py(p.value) - 12} textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--ink)">
                {p.value}
                {artifact.unit ?? ""}
              </text>
              <text x={px(i)} y={H - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink-faint)">
                {p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5 rounded-2xl bg-white p-4 shadow-soft">
      {artifact.data.map((d, i) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate font-extrabold text-ink" title={d.label}>
            {d.label}
          </span>
          <span className="h-4 overflow-hidden rounded-full bg-ink/6">
            <motion.span
              className="block h-full rounded-full"
              style={{ background: colors[i % colors.length] }}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${Math.max((d.value / max) * 100, 2)}%` }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
          <span className="font-mono text-xs font-bold text-ink-soft">
            {d.value.toLocaleString()}
            {artifact.unit ? ` ${artifact.unit}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------------------
   Checklist
---------------------------------------------------------------------------- */

function ChecklistView({ artifact }: { artifact: ChecklistArtifact }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const all = done.size === artifact.items.length;
  return (
    <div className="rounded-2xl bg-white p-2 shadow-soft">
      <ul className="divide-y divide-line">
        {artifact.items.map((item, i) => {
          const checked = done.has(i);
          return (
            <li key={i}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-brand-violet-soft/40">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setDone((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                  className="mt-1 h-5 w-5 rounded-md accent-[var(--violet)]"
                />
                <span className="min-w-0">
                  <span className={`block text-sm font-extrabold ${checked ? "text-ink-faint line-through" : "text-ink"}`}>
                    {item.text}
                  </span>
                  {item.detail ? <span className="mt-0.5 block text-sm font-semibold text-ink-soft">{item.detail}</span> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <AnimatePresence>
        {all ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="m-2 rounded-xl bg-brand-mint-soft px-3 py-2 text-sm font-extrabold text-brand-mint-deep"
          >
            All checked. You are ready. 🎉
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Steps
---------------------------------------------------------------------------- */

function StepsView({ artifact }: { artifact: StepsArtifact }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const step = artifact.steps[index]!;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft">
      <ol className="mb-4 flex flex-wrap gap-1.5" aria-label="Steps">
        {artifact.steps.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${s.title}`}
              className={`grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold transition ${
                i === index
                  ? "bg-brand-gradient text-white shadow-pop"
                  : i < index
                    ? "bg-brand-mint-soft text-brand-mint-deep"
                    : "bg-ink/6 text-ink-soft hover:bg-ink/10"
              }`}
            >
              {i < index ? "✓" : i + 1}
            </button>
          </li>
        ))}
      </ol>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={reduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-xs font-extrabold uppercase tracking-wider text-brand-coral-deep">
            Step {index + 1} of {artifact.steps.length}
          </p>
          <h4 className="mt-1 font-display text-xl font-bold text-ink">{step.title}</h4>
          {step.detail ? <p className="mt-2 text-sm font-semibold leading-relaxed text-ink-soft">{step.detail}</p> : null}
        </motion.div>
      </AnimatePresence>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="rounded-xl px-3 py-2 text-sm font-extrabold text-ink-soft transition hover:text-ink disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          disabled={index === artifact.steps.length - 1}
          onClick={() => setIndex((i) => Math.min(artifact.steps.length - 1, i + 1))}
          className="rounded-xl bg-brand-violet px-4 py-2 text-sm font-extrabold text-white shadow-pop transition hover:bg-brand-violet-deep disabled:opacity-40 disabled:shadow-none"
        >
          Next step
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Table
---------------------------------------------------------------------------- */

function TableView({ artifact }: { artifact: TableArtifact }) {
  return (
    <div className="scroll-slim overflow-x-auto rounded-2xl bg-white shadow-soft">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {artifact.columns.map((c) => (
              <th key={c} className="bg-brand-violet-soft px-3.5 py-2.5 text-left font-extrabold text-ink">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {artifact.rows.map((row, r) => (
            <tr key={r} className="odd:bg-white even:bg-brand-violet-soft/25">
              {artifact.columns.map((_, c) => (
                <td key={c} className="px-3.5 py-2.5 align-top font-semibold text-ink-soft">
                  {row[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Flashcards
---------------------------------------------------------------------------- */

function FlashcardsView({ artifact }: { artifact: FlashcardsArtifact }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = artifact.cards[index]!;
  function go(delta: number) {
    setFlipped(false);
    setIndex((i) => (i + delta + artifact.cards.length) % artifact.cards.length);
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show term" : "Show meaning"}
        className="relative h-44 w-full [perspective:1000px]"
      >
        <motion.div
          className="relative h-full w-full [transform-style:preserve-3d]"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
        >
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-brand-gradient p-6 text-center text-white shadow-pop [backface-visibility:hidden]">
            <span>
              <span className="block text-xs font-extrabold uppercase tracking-wider text-white/75">Term</span>
              <span className="mt-2 block font-display text-2xl font-bold">{card.front}</span>
              <span className="mt-3 block text-xs font-bold text-white/75">Tap to flip</span>
            </span>
          </div>
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white p-6 text-center shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span>
              <span className="block text-xs font-extrabold uppercase tracking-wider text-brand-coral-deep">Meaning</span>
              <span className="mt-2 block text-base font-bold leading-relaxed text-ink">{card.back}</span>
            </span>
          </div>
        </motion.div>
      </button>
      <div className="mt-3 flex items-center justify-between text-sm font-extrabold text-ink-soft">
        <button type="button" onClick={() => go(-1)} className="rounded-xl px-3 py-2 hover:text-ink">
          ← Previous
        </button>
        <span>
          {index + 1} / {artifact.cards.length}
        </span>
        <button type="button" onClick={() => go(1)} className="rounded-xl px-3 py-2 hover:text-ink">
          Next →
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Mockup (simulated UI screen)
---------------------------------------------------------------------------- */

function MockupView({ artifact }: { artifact: MockupArtifact }) {
  const [values, setValues] = useState<Record<number, string | boolean>>({});
  const [submitted, setSubmitted] = useState<string | null>(null);
  const { screen } = artifact;
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border-[6px] border-ink bg-white shadow-lift">
      <div className="flex items-center justify-between bg-ink px-4 py-1.5 text-[10px] font-extrabold text-white/80">
        <span>9:41</span>
        <span className="h-3 w-16 rounded-full bg-black" aria-hidden="true" />
        <span>●●●</span>
      </div>
      <div className="bg-brand-gradient-soft px-5 py-4">
        <p className="text-xs font-extrabold uppercase tracking-wider text-brand-violet-deep">Simulated screen</p>
        <h4 className="mt-1 font-display text-xl font-bold text-ink">{screen.heading}</h4>
        {screen.subheading ? <p className="text-sm font-semibold text-ink-soft">{screen.subheading}</p> : null}
      </div>
      <div className="space-y-3 px-5 py-4">
        {screen.fields.map((f, i) => {
          const v = values[i];
          if (f.kind === "toggle") {
            const on = typeof v === "boolean" ? v : f.value === "on" || f.value === "true";
            return (
              <label key={i} className="flex items-center justify-between gap-3 text-sm font-extrabold text-ink">
                {f.label}
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => setValues((prev) => ({ ...prev, [i]: !on }))}
                  className={`relative h-7 w-12 rounded-full transition ${on ? "bg-brand-mint" : "bg-ink/15"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
                </button>
              </label>
            );
          }
          if (f.kind === "select") {
            return (
              <label key={i} className="block text-sm font-extrabold text-ink">
                {f.label}
                <select
                  value={typeof v === "string" ? v : f.value ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [i]: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-line-strong bg-white px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-violet"
                >
                  {(f.options?.length ? f.options : [f.value ?? "Option"]).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <label key={i} className="block text-sm font-extrabold text-ink">
              {f.label}
              <input
                type={f.kind === "number" ? "number" : "text"}
                value={typeof v === "string" ? v : f.value ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setValues((prev) => ({ ...prev, [i]: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-line-strong bg-white px-3 py-2.5 text-sm font-semibold text-ink outline-none placeholder:text-ink-faint focus:border-brand-violet"
              />
            </label>
          );
        })}
        <div className="flex flex-col gap-2 pt-1">
          {screen.actions.map((a, i) => (
            <button
              key={a}
              type="button"
              onClick={() => setSubmitted(a)}
              className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${
                i === 0 ? "bg-brand-violet text-white shadow-pop hover:bg-brand-violet-deep" : "bg-ink/6 text-ink hover:bg-ink/10"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {submitted ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-brand-mint-soft px-3 py-2 text-xs font-extrabold text-brand-mint-deep"
            >
              Tapped &ldquo;{submitted}&rdquo;. In the real app this is where you would confirm.
            </motion.p>
          ) : null}
        </AnimatePresence>
        {screen.note ? <p className="text-xs font-semibold text-ink-faint">{screen.note}</p> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Renderer
---------------------------------------------------------------------------- */

export function ArtifactRenderer({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case "code":
      return <CodeView artifact={artifact} />;
    case "graph":
      return <GraphArtifactView artifact={artifact} />;
    case "chart":
      return <ChartView artifact={artifact} />;
    case "checklist":
      return <ChecklistView artifact={artifact} />;
    case "steps":
      return <StepsView artifact={artifact} />;
    case "table":
      return <TableView artifact={artifact} />;
    case "flashcards":
      return <FlashcardsView artifact={artifact} />;
    case "mockup":
      return <MockupView artifact={artifact} />;
    case "calculator":
      return <CalculatorArtifactView artifact={artifact} />;
    default:
      return null;
  }
}
