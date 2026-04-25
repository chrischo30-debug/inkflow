"use client";

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface Props {
  title?: string;
  body?: string;
  children?: React.ReactNode;
}

export function HelpTooltip({ title, body, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  };

  const show = useCallback(() => {
    clearHideTimer();
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    setOpen(true);
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  const isRich = Boolean(children);

  return (
    <span className="relative inline-flex items-center shrink-0">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onClick={e => { e.preventDefault(); e.stopPropagation(); open ? setOpen(false) : show(); }}
        className="w-4 h-4 rounded-full border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-outline-variant transition-colors text-[10px] font-semibold flex items-center justify-center leading-none"
        aria-label="Help"
      >
        ?
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: Math.min(Math.max(pos.left, isRich ? 160 : 120), window.innerWidth - (isRich ? 160 : 120)),
            transform: "translateX(-50%)",
            zIndex: 9999,
            maxHeight: `calc(100vh - ${pos.top}px - 16px)`,
            overflowY: "auto",
          }}
          className={`${isRich ? "w-80" : "w-60"} rounded-xl border border-outline-variant/20 bg-surface shadow-lg p-3 text-left`}
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
        >
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-surface border-l border-t border-outline-variant/20" />
          {title && <p className="text-xs font-semibold text-on-surface mb-2">{title}</p>}
          {children ?? <p className="text-xs text-on-surface-variant leading-relaxed">{body}</p>}
        </div>,
        document.body,
      )}
    </span>
  );
}
