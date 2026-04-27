"use client";

import { useEffect, useState, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Lightbulb } from "lucide-react";

const STORAGE_KEY = "fb_coachmarks";
const CHANGE_EVENT = "fb_coachmarks_changed";

type Stored = { disabled: boolean; seen: string[] };

function readStore(): Stored {
  if (typeof window === "undefined") return { disabled: false, seen: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { disabled: false, seen: [] };
    const parsed = JSON.parse(raw);
    return {
      disabled: !!parsed.disabled,
      seen: Array.isArray(parsed.seen) ? parsed.seen : [],
    };
  } catch {
    return { disabled: false, seen: [] };
  }
}

function writeStore(s: Stored) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useCoachmarks() {
  // Initialize with the SSR-safe default; read localStorage post-mount via the
  // effect below. Reading storage in the useState initializer caused server
  // (empty default) vs client (real saved state) to diverge → React #418.
  const [store, setStore] = useState<Stored>({ disabled: false, seen: [] });
  useEffect(() => {
    const refresh = () => setStore(readStore());
    refresh(); // pull saved state on mount
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return {
    disabled: store.disabled,
    hasSeen: useCallback((id: string) => store.disabled || store.seen.includes(id), [store]),
    markSeen: useCallback((id: string) => {
      const cur = readStore();
      if (cur.seen.includes(id)) return;
      writeStore({ ...cur, seen: [...cur.seen, id] });
    }, []),
    disableAll: useCallback(() => writeStore({ ...readStore(), disabled: true }), []),
    reset: useCallback(() => writeStore({ disabled: false, seen: [] }), []),
  };
}

// ── Single coachmark ─────────────────────────────────────────────────────────

export function Coachmark({
  id,
  anchorSelector,
  title,
  body,
  onDismiss,
}: {
  id: string;
  anchorSelector: string;
  title: string;
  body: React.ReactNode;
  onDismiss: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const { markSeen, disableAll } = useCoachmarks();

  // Poll for the anchor element until found (handles late-rendering targets)
  useEffect(() => {
    let cancelled = false;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(anchorSelector) as HTMLElement | null;
      if (el) setAnchorEl(el);
      else setTimeout(find, 200);
    };
    find();
    return () => { cancelled = true; };
  }, [anchorSelector]);

  // Compute position when anchor or layout changes
  useLayoutEffect(() => {
    if (!anchorEl) return;
    const compute = () => {
      const rect = anchorEl.getBoundingClientRect();
      const cardHeight = cardRef.current?.offsetHeight ?? 160;
      const cardWidth = cardRef.current?.offsetWidth ?? 320;
      const margin = 14;
      const placement: "top" | "bottom" =
        rect.top >= cardHeight + margin ? "top" : "bottom";
      let left = rect.left + rect.width / 2 - cardWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - cardWidth - 12));
      const rawTop = placement === "top" ? rect.top - cardHeight - margin : rect.bottom + margin;
      const top = Math.max(12, Math.min(rawTop, window.innerHeight - cardHeight - 12));
      setPos({ top, left, placement });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [anchorEl]);

  // Spotlight ring on the anchor
  useEffect(() => {
    if (!anchorEl) return;
    const prevShadow = anchorEl.style.boxShadow;
    const prevTransition = anchorEl.style.transition;
    const prevZ = anchorEl.style.zIndex;
    const prevPos = anchorEl.style.position;
    anchorEl.style.boxShadow = "0 0 0 4px rgb(59 130 246 / 0.55), 0 0 0 8px rgb(59 130 246 / 0.18)";
    anchorEl.style.transition = "box-shadow 200ms ease";
    if (!anchorEl.style.position || anchorEl.style.position === "static") {
      anchorEl.style.position = "relative";
    }
    anchorEl.style.zIndex = "10001";
    return () => {
      anchorEl.style.boxShadow = prevShadow;
      anchorEl.style.transition = prevTransition;
      anchorEl.style.zIndex = prevZ;
      anchorEl.style.position = prevPos;
    };
  }, [anchorEl]);

  const handleDismiss = useCallback(() => {
    markSeen(id);
    onDismiss();
  }, [id, markSeen, onDismiss]);

  // Dismiss on Escape or click outside (clicking the anchor itself is fine —
  // we treat that as the user trying out the thing the tip points at)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleDismiss(); };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (cardRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) { handleDismiss(); return; }
      handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [anchorEl, handleDismiss]);

  if (typeof document === "undefined" || !pos) return null;

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={title}
      className="fixed z-[10002] w-96 max-w-[calc(100vw-24px)] max-h-[80vh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-gray-200 p-5"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-start gap-2.5 mb-3">
        <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-base font-semibold text-gray-900 leading-snug">{title}</p>
      </div>
      <div className="text-sm text-gray-700 leading-relaxed pl-7 space-y-2.5">{body}</div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => { disableAll(); onDismiss(); }}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          Don&apos;t show tips
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ── Sequence: shows the next unseen tip from a list, advances on dismiss ─────

export interface Tip {
  id: string;
  anchorSelector: string;
  title: string;
  body: React.ReactNode;
}

export function CoachmarkSequence({ tips }: { tips: Tip[] }) {
  const { hasSeen, disabled } = useCoachmarks();
  const [tick, setTick] = useState(0);
  if (disabled) return null;
  const next = tips.find(t => !hasSeen(t.id));
  if (!next) return null;
  return (
    <Coachmark
      key={`${next.id}:${tick}`}
      id={next.id}
      anchorSelector={next.anchorSelector}
      title={next.title}
      body={next.body}
      onDismiss={() => setTick(v => v + 1)}
    />
  );
}
