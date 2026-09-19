import Link from "next/link";

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center rounded-2xl bg-brand-gradient text-white shadow-pop ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
        <path
          d="M4 7.5C4 6.1 5.1 5 6.5 5H12l2.5 2.5H19c.6 0 1 .4 1 1V17c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V7.5z"
          fill="currentColor"
          opacity="0.35"
        />
        <path
          d="M7.5 12.5l2.5 2.5 6-6"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 rounded-2xl focus-visible:outline focus-visible:outline-3 focus-visible:outline-brand-violet/60"
      aria-label="CiviorAI home"
    >
      <LogoMark className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      {!compact ? (
        <span className="font-display text-xl font-bold tracking-tight text-ink">
          Civior<span className="text-gradient">AI</span>
        </span>
      ) : null}
    </Link>
  );
}
