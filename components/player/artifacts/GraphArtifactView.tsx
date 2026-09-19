"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { GraphArtifact } from "@/lib/artifacts";
import { compileExpression } from "@/lib/safe-math";

const COLORS = ["var(--violet)", "var(--coral)", "var(--ocean)", "var(--mint)"];
const W = 640;
const H = 360;
const PAD = { l: 44, r: 16, t: 16, b: 32 };

type Series = {
  label: string;
  expression: string;
  color: string;
  points: Array<[number, number]>;
  error: string | null;
  fn: ((x: number) => number) | null;
};

function niceTicks(min: number, max: number, count = 6): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const rough = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "n/a";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export function GraphArtifactView({ artifact }: { artifact: GraphArtifact }) {
  const reduceMotion = useReducedMotion();
  const [range, setRange] = useState<[number, number]>([artifact.xMin, artifact.xMax]);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [xMin, xMax] = range;

  const series = useMemo<Series[]>(() => {
    return artifact.functions.map((f, i) => {
      try {
        const compiled = compileExpression(f.expression);
        const fn = (x: number) => compiled.eval({ x });
        const points: Array<[number, number]> = [];
        const steps = 240;
        for (let s = 0; s <= steps; s += 1) {
          const x = xMin + ((xMax - xMin) * s) / steps;
          const y = fn(x);
          if (Number.isFinite(y)) points.push([x, y]);
        }
        return { label: f.label, expression: f.expression, color: COLORS[i % COLORS.length]!, points, error: null, fn };
      } catch (error) {
        return {
          label: f.label,
          expression: f.expression,
          color: COLORS[i % COLORS.length]!,
          points: [],
          error: error instanceof Error ? error.message : "Could not plot",
          fn: null,
        };
      }
    });
  }, [artifact.functions, xMin, xMax]);

  const [yMin, yMax] = useMemo(() => {
    const ys = series.flatMap((s) => s.points.map((p) => p[1]));
    if (ys.length === 0) return [-10, 10];
    const sorted = [...ys].sort((a, b) => a - b);
    // Trim the wildest 3% so asymptotes do not flatten everything.
    const lo = sorted[Math.floor(sorted.length * 0.03)]!;
    const hi = sorted[Math.ceil(sorted.length * 0.97) - 1]!;
    const pad = (hi - lo || 1) * 0.12;
    return [lo - pad, hi + pad];
  }, [series]);

  const sx = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - ((y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  const xTicks = niceTicks(xMin, xMax);
  const yTicks = niceTicks(yMin, yMax, 5);

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const x = xMin + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (xMax - xMin);
    setHoverX(x >= xMin && x <= xMax ? x : null);
  }

  function zoom(factor: number) {
    const mid = (xMin + xMax) / 2;
    const half = ((xMax - xMin) / 2) * factor;
    setRange([mid - half, mid + half]);
  }

  function pan(direction: -1 | 1) {
    const shift = (xMax - xMin) * 0.25 * direction;
    setRange([xMin + shift, xMax + shift]);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-2">
          {series.map((s) => (
            <li key={s.label} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-ink shadow-soft">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
              {s.error ? <span className="text-brand-rose"> (could not plot)</span> : null}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1" role="group" aria-label="Graph controls">
          {[
            ["Pan left", "←", () => pan(-1)],
            ["Zoom in", "+", () => zoom(0.6)],
            ["Zoom out", "−", () => zoom(1 / 0.6)],
            ["Pan right", "→", () => pan(1)],
            ["Reset", "↺", () => setRange([artifact.xMin, artifact.xMax])],
          ].map(([label, glyph, fn]) => (
            <button
              key={label as string}
              type="button"
              aria-label={label as string}
              onClick={fn as () => void}
              className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-extrabold text-ink-soft shadow-soft transition hover:text-ink"
            >
              {glyph as string}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none rounded-2xl bg-white"
        role="img"
        aria-label={`Graph of ${series.map((s) => s.label).join(", ")}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverX(null)}
      >
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="rgba(43,35,66,0.08)" />
            <text x={PAD.l - 8} y={sy(t) + 4} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--ink-faint)">
              {fmt(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line y1={PAD.t} y2={H - PAD.b} x1={sx(t)} x2={sx(t)} stroke="rgba(43,35,66,0.06)" />
            <text x={sx(t)} y={H - PAD.b + 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink-faint)">
              {fmt(t)}
            </text>
          </g>
        ))}
        {yMin < 0 && yMax > 0 ? (
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(0)} y2={sy(0)} stroke="rgba(43,35,66,0.35)" strokeWidth="1.5" />
        ) : null}
        {xMin < 0 && xMax > 0 ? (
          <line y1={PAD.t} y2={H - PAD.b} x1={sx(0)} x2={sx(0)} stroke="rgba(43,35,66,0.35)" strokeWidth="1.5" />
        ) : null}

        {series.map((s) => {
          if (s.points.length < 2) return null;
          let d = "";
          let prevY: number | null = null;
          for (const [x, y] of s.points) {
            const clampedY = Math.min(Math.max(y, yMin - 50), yMax + 50);
            const jump = prevY !== null && Math.abs(clampedY - prevY) > (yMax - yMin) * 2;
            d += `${d === "" || jump ? "M" : "L"}${sx(x).toFixed(1)},${sy(clampedY).toFixed(1)} `;
            prevY = clampedY;
          }
          return (
            <motion.path
              key={s.label}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          );
        })}

        {hoverX !== null ? (
          <g>
            <line x1={sx(hoverX)} x2={sx(hoverX)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink)" strokeDasharray="4 4" opacity="0.4" />
            {series.map((s) => {
              if (!s.fn) return null;
              const y = s.fn(hoverX);
              if (!Number.isFinite(y) || y < yMin || y > yMax) return null;
              return (
                <g key={s.label}>
                  <circle cx={sx(hoverX)} cy={sy(y)} r="6" fill="white" stroke={s.color} strokeWidth="3" />
                  <rect x={sx(hoverX) + 10} y={sy(y) - 22} width="110" height="20" rx="6" fill="var(--ink)" />
                  <text x={sx(hoverX) + 16} y={sy(y) - 8} fontSize="11" fontWeight="700" fill="white">
                    x {fmt(hoverX)} y {fmt(y)}
                  </text>
                </g>
              );
            })}
          </g>
        ) : null}
      </svg>
      <p className="mt-2 text-xs font-semibold text-ink-faint">Hover to read values. Use the buttons to pan and zoom.</p>
    </div>
  );
}
