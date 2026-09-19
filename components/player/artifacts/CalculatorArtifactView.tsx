"use client";

import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { CalculatorArtifact } from "@/lib/artifacts";
import { tryEvaluate } from "@/lib/safe-math";

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "?";
  const abs = Math.abs(n);
  if (abs >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 10) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function CalculatorArtifactView({ artifact }: { artifact: CalculatorArtifact }) {
  const baseId = useId();
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(artifact.inputs.map((i) => [i.id, i.default])),
  );

  const outputs = useMemo(
    () => artifact.outputs.map((o) => ({ ...o, value: tryEvaluate(o.expression, values) })),
    [artifact.outputs, values],
  );

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        {artifact.inputs.map((input) => {
          const id = `${baseId}-${input.id}`;
          const value = values[input.id] ?? input.default;
          const min = input.min ?? Math.min(0, input.default * 0.5);
          const max = input.max ?? Math.max(input.default * 2, min + 10);
          const step = input.step ?? (max - min > 100 ? 1 : max - min > 10 ? 0.5 : 0.1);
          return (
            <div key={input.id}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-sm font-extrabold text-ink">
                  {input.label}
                </label>
                <span className="flex items-center gap-1 text-sm font-bold text-ink-soft">
                  <input
                    type="number"
                    aria-label={`${input.label} value`}
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(e) => setValues((v) => ({ ...v, [input.id]: Number(e.target.value) }))}
                    className="w-24 rounded-lg border border-line-strong bg-white px-2 py-1 text-right text-sm font-extrabold text-ink outline-none focus:border-brand-violet"
                  />
                  {input.unit}
                </span>
              </div>
              <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => setValues((v) => ({ ...v, [input.id]: Number(e.target.value) }))}
                style={{ "--seek-progress": `${((value - min) / (max - min || 1)) * 100}%` } as React.CSSProperties}
                className="seek-range mt-2 w-full"
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 md:min-w-[14rem]">
        {outputs.map((o) => (
          <motion.div
            key={o.label}
            layout
            className="rounded-2xl bg-brand-gradient p-4 text-white shadow-pop"
          >
            <p className="text-xs font-extrabold uppercase tracking-wider text-white/80">{o.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">
              {o.unit === "$" || o.unit === "CAD" ? "$" : ""}
              {fmt(o.value)}
              {o.unit && o.unit !== "$" && o.unit !== "CAD" ? <span className="ml-1 text-base font-bold text-white/85">{o.unit}</span> : null}
            </p>
            <p className="mt-1 truncate font-mono text-[10px] text-white/70" title={o.expression}>
              {o.expression}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
