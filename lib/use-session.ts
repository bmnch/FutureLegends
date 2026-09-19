"use client";

import { useCallback, useEffect, useState } from "react";

export type SessionUser = {
  id: string;
  email: string;
  plan?: "free" | "premium";
};

export type SessionState = {
  loading: boolean;
  user: SessionUser | null;
};

/** Tiny client-side session reader with a manual refresh. */
export function useSession(initialUser: SessionUser | null = null) {
  const [state, setState] = useState<SessionState>({
    loading: initialUser === null,
    user: initialUser,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = (await response.json()) as { authenticated?: boolean; user?: SessionUser };
      setState({ loading: false, user: data.authenticated && data.user ? data.user : null });
    } catch {
      setState({ loading: false, user: null });
    }
  }, []);

  useEffect(() => {
    if (initialUser) return;
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ authenticated?: boolean; user?: SessionUser }>)
      .then((data) => {
        if (!cancelled) setState({ loading: false, user: data.authenticated && data.user ? data.user : null });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, user: null });
      });
    return () => {
      cancelled = true;
    };
  }, [initialUser]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setState({ loading: false, user: null });
    }
  }, []);

  return { ...state, refresh, signOut, setUser: (user: SessionUser | null) => setState({ loading: false, user }) };
}
