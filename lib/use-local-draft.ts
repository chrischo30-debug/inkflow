"use client";

import { useEffect, useRef } from "react";

// Lightweight draft persistence to localStorage / sessionStorage.
// Restores once on mount via setter callbacks; debounce-saves on value change;
// clears via the returned function (call on Send / Save / dismiss-with-reset).
//
// Keep it small on purpose — this isn't a sync engine, it's "don't lose what
// the user just typed when they refresh the iPad."

type Storage = "local" | "session";

function getStorage(kind: Storage): globalThis.Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function useLocalDraft<T>(opts: {
  key: string | null | undefined;
  storage?: Storage;
  value: T;
  onRestore: (saved: T) => void;
  debounceMs?: number;
}): { clear: () => void } {
  const { key, storage = "local", value, onRestore, debounceMs = 400 } = opts;
  const restored = useRef(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Restore on mount (or whenever the key changes)
  useEffect(() => {
    if (!key) return;
    const s = getStorage(storage);
    if (!s) return;
    const raw = s.getItem(key);
    if (raw) {
      try { onRestoreRef.current(JSON.parse(raw) as T); } catch { /* malformed — ignore */ }
    }
    restored.current = true;
  }, [key, storage]);

  // Debounced save when value changes
  useEffect(() => {
    if (!key || !restored.current) return;
    const s = getStorage(storage);
    if (!s) return;
    const t = setTimeout(() => {
      try { s.setItem(key, JSON.stringify(value)); } catch { /* quota / disabled — drop */ }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [key, storage, value, debounceMs]);

  return {
    clear: () => {
      if (!key) return;
      const s = getStorage(storage);
      s?.removeItem(key);
    },
  };
}
