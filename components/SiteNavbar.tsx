"use client";

type Props = {
  onSignIn: () => void;
  onSignUp: () => void;
  authenticated?: boolean;
};

export function SiteNavbar({ onSignIn, onSignUp, authenticated = false }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-white/5 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6"
      >
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300 transition hover:text-cyan-200"
        >
          CiviorAI
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          {authenticated ? (
            <span className="hidden text-xs text-neutral-400 sm:inline">
              Signed in
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={onSignIn}
                className="rounded-lg border border-transparent px-3 py-2 text-sm text-neutral-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={onSignUp}
                className="rounded-lg border border-cyan-500 bg-cyan-500/20 px-3.5 py-2 text-sm font-semibold text-cyan-400 transition-all hover:bg-cyan-500 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
