/**
 * Soft, slowly drifting colour blobs. Pure CSS so it costs nothing on the
 * main thread and respects prefers-reduced-motion.
 */
export function BackgroundBlobs({ intensity = 1 }: { intensity?: number }) {
  const o = Math.min(Math.max(intensity, 0), 1);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="blob blob-a -left-24 -top-24 h-[34rem] w-[34rem]"
        style={{ background: "var(--violet)", opacity: 0.28 * o }}
      />
      <div
        className="blob blob-b -right-32 top-16 h-[30rem] w-[30rem]"
        style={{ background: "var(--coral)", opacity: 0.26 * o }}
      />
      <div
        className="blob blob-a bottom-[-8rem] left-[30%] h-[28rem] w-[28rem]"
        style={{ background: "var(--ocean)", opacity: 0.22 * o, animationDelay: "-8s" }}
      />
      <div
        className="blob blob-b bottom-10 right-[20%] h-[18rem] w-[18rem]"
        style={{ background: "var(--sun)", opacity: 0.22 * o, animationDelay: "-14s" }}
      />
    </div>
  );
}
