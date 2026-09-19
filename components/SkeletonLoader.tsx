export function SkeletonLoader() {
  return (
    <div
      className="mt-12 space-y-4"
      role="status"
      aria-live="polite"
      aria-label="Generating your custom syllabus"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-neon animate-[pulse-neon_1.6s_ease-in-out_infinite]">
        Parsing brain dump…
      </p>
      <div className="skeleton h-8 w-2/3 rounded-md" />
      <div className="skeleton h-4 w-1/2 rounded-md" />
      <div className="space-y-3 pt-2">
        <div className="skeleton h-20 w-full rounded-md" />
        <div className="skeleton h-20 w-full rounded-md" />
        <div className="skeleton h-20 w-full rounded-md" />
      </div>
      <span className="sr-only">Loading syllabus outline</span>
    </div>
  );
}
