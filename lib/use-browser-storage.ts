"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * Sentinel returned during SSR / hydration so callers can distinguish
 * "not read yet" from "nothing stored".
 */
export const NOT_HYDRATED = Symbol("not-hydrated");
export type NotHydrated = typeof NOT_HYDRATED;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readRaw(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Read a JSON value from session/local storage without a setState-in-effect.
 * The parsed value is cached by raw string so `getSnapshot` stays referentially
 * stable, which `useSyncExternalStore` requires.
 *
 * Returns `NOT_HYDRATED` on the server and during hydration, then the parsed
 * value (or `null` when nothing is stored).
 */
export function useStoredJson<T>(key: string): T | null | NotHydrated {
  const cache = useRef<{ raw: string | null; value: T | null }>({ raw: null, value: null });

  const getSnapshot = useCallback((): T | null => {
    const raw = readRaw(key);
    if (raw !== cache.current.raw) {
      let value: T | null = null;
      if (raw) {
        try {
          value = JSON.parse(raw) as T;
        } catch {
          value = null;
        }
      }
      cache.current = { raw, value };
    }
    return cache.current.value;
  }, [key]);

  return useSyncExternalStore<T | null | NotHydrated>(
    subscribe,
    getSnapshot,
    () => NOT_HYDRATED,
  );
}

/**
 * Read several JSON keys at once (for example progress for every course on the
 * dashboard). Returns `NOT_HYDRATED` on the server, then a map of key to value.
 */
export function useStoredJsonMap<T>(keys: readonly string[]): Record<string, T | null> | NotHydrated {
  const cache = useRef<{ raw: string; value: Record<string, T | null> }>({ raw: "", value: {} });
  const keyList = keys.join("\u0000");

  const getSnapshot = useCallback((): Record<string, T | null> => {
    const raws = keyList ? keyList.split("\u0000").map((k) => [k, readRaw(k)] as const) : [];
    const signature = JSON.stringify(raws);
    if (signature !== cache.current.raw) {
      const value: Record<string, T | null> = {};
      for (const [k, raw] of raws) {
        let parsed: T | null = null;
        if (raw) {
          try {
            parsed = JSON.parse(raw) as T;
          } catch {
            parsed = null;
          }
        }
        value[k] = parsed;
      }
      cache.current = { raw: signature, value };
    }
    return cache.current.value;
  }, [keyList]);

  return useSyncExternalStore<Record<string, T | null> | NotHydrated>(
    subscribe,
    getSnapshot,
    () => NOT_HYDRATED,
  );
}

/** Feature-detect a browser API without an effect. */
export function useBrowserFeature(test: () => boolean): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return test();
      } catch {
        return false;
      }
    },
    () => true,
  );
}
