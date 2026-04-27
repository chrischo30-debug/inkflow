"use client";

import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  title?: string;
  body?: string;
  children?: React.ReactNode;
}

const MARGIN = 8;       // gap between button and panel
const EDGE = 12;        // min distance from viewport edge

export function HelpTooltip({ title, body, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom";
    arrowLeft: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  };

  const show = useCallback(() => {
    clearHideTimer();
    setOpen(true);
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  const isRich = Boolean(children);

  // Measure after the panel mounts so flip / clamp use real height & width.
  useLayoutEffect(() => {
    if (!open) return;
    const compute = () => {
      const btn = btnRef.current;
      const panel = panelRef.current;
      if (!btn || !panel) return;
      const r = btn.getBoundingClientRect();
      const pw = panel.offsetWidth;
      const ph = panel.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - r.bottom - MARGIN - EDGE;
      const spaceAbove = r.top - MARGIN - EDGE;
      // Prefer below; flip above only if it doesn't fit AND above has more room.
      const placement: "top" | "bottom" =
        ph > spaceBelow && spaceAbove > spaceBelow ? "top" : "bottom";

      const rawTop = placement === "top" ? r.top - ph - MARGIN : r.bottom + MARGIN;
      const top = Math.max(EDGE, Math.min(rawTop, vh - ph - EDGE));
      const btnCenter = r.left + r.width / 2;
      let left = btnCenter - pw / 2;
      left = Math.max(EDGE, Math.min(left, vw - pw - EDGE));
      // Arrow stays under the button regardless of horizontal clamp.
      const arrowLeft = Math.max(12, Math.min(btnCenter - left, pw - 12));
      setPos({ top, left, placement, arrowLeft });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  return (
    <span className="relative inline-flex items-center shrink-0">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onClick={e => { e.preventDefault(); e.stopPropagation(); open ? setOpen(false) : show(); }}
        className="w-5 h-5 rounded-full border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-outline-variant transition-colors text-xs font-semibold flex items-center justify-center leading-none"
        aria-label="Help"
      >
        ?
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            zIndex: 9999,
            maxHeight: `calc(100vh - ${EDGE * 2}px)`,
            overflowY: "auto",
            visibility: pos ? "visible" : "hidden",
          }}
          className={`${isRich ? "w-80" : "w-60"} rounded-xl border border-outline-variant/20 bg-surface shadow-lg p-3 text-left`}
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
        >
          {pos && (
            <div
              className="absolute w-3 h-3 rotate-45 bg-surface border-outline-variant/20"
              style={{
                left: pos.arrowLeft,
                transform: "translateX(-50%)",
                ...(pos.placement === "bottom"
                  ? { top: -6, borderLeftWidth: 1, borderTopWidth: 1 }
                  : { bottom: -6, borderRightWidth: 1, borderBottomWidth: 1 }),
              }}
            />
          )}
          {title && <p className="text-xs font-semibold text-on-surface mb-2">{title}</p>}
          {children ?? <p className="text-xs text-on-surface-variant leading-relaxed">{body}</p>}
        </div>,
        document.body,
      )}
    </span>
  );
}
