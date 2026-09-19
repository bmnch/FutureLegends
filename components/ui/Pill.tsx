import type { ReactNode } from "react";

export type PillTone = "violet" | "coral" | "ocean" | "mint" | "sun" | "rose" | "neutral";

const TONES: Record<PillTone, string> = {
  violet: "bg-brand-violet-soft text-brand-violet-deep",
  coral: "bg-brand-coral-soft text-brand-coral-deep",
  ocean: "bg-brand-ocean-soft text-brand-ocean-deep",
  mint: "bg-brand-mint-soft text-brand-mint-deep",
  sun: "bg-brand-sun-soft text-[#8a5a00]",
  rose: "bg-brand-rose-soft text-brand-rose",
  neutral: "bg-ink/6 text-ink-soft",
};

export function Pill({
  tone = "violet",
  children,
  className = "",
  icon,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold tracking-wide ${TONES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
