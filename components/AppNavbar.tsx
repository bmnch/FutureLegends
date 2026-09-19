"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Pill } from "@/components/ui/Pill";
import type { SessionUser } from "@/lib/use-session";

type Props = {
  user: SessionUser | null;
  loading?: boolean;
  onSignIn?: () => void;
  onSignUp?: () => void;
  onSignOut?: () => Promise<void> | void;
  /** Floats over the hero on the landing page. */
  transparent?: boolean;
};

export function AppNavbar({
  user,
  loading = false,
  onSignIn,
  onSignUp,
  onSignOut,
  transparent = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const onDashboard = pathname?.startsWith("/dashboard");

  async function handleSignOut() {
    await onSignOut?.();
    router.push("/");
    router.refresh();
  }

  return (
    <motion.header
      initial={reduceMotion ? false : { y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`sticky top-0 z-40 w-full ${
        transparent ? "bg-transparent" : "glass border-x-0 border-t-0 rounded-none"
      }`}
    >
      <nav
        aria-label="Primary"
        className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10"
      >
        <Logo />

        <div className="flex items-center gap-2 sm:gap-3">
          {loading ? (
            <span className="h-9 w-24 rounded-xl skeleton" aria-hidden="true" />
          ) : user ? (
            <>
              {user.plan === "premium" ? <Pill tone="sun">Premium</Pill> : null}
              {!onDashboard ? (
                <ButtonLink href="/dashboard" variant="secondary" size="sm">
                  My courses
                </ButtonLink>
              ) : null}
              <span className="hidden max-w-[12rem] truncate text-sm font-semibold text-ink-soft md:inline-block">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              {onSignIn ? (
                <Button variant="ghost" size="sm" onClick={onSignIn}>
                  Log in
                </Button>
              ) : (
                <Link
                  href="/?auth=required"
                  className="rounded-xl px-3 py-2 text-sm font-bold text-ink-soft hover:text-ink"
                >
                  Log in
                </Link>
              )}
              {onSignUp ? (
                <Button variant="primary" size="sm" onClick={onSignUp}>
                  Get started
                </Button>
              ) : (
                <ButtonLink href="/" variant="primary" size="sm">
                  Get started
                </ButtonLink>
              )}
            </>
          )}
        </div>
      </nav>
    </motion.header>
  );
}
