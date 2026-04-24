"use client";

import { useState } from "react";

export function HelpTooltip({ title, body }: { title?: string; body: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center shrink-0">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
        className="w-4 h-4 rounded-full border border-outline-variant/40 text-on-surface-variant/50 hover:text-on-surface-variant hover:border-outline-variant transition-colors text-[10px] font-semibold flex items-center justify-center leading-none"
        aria-label="Help"
      >
        ?
      </button>
      {open && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-60 rounded-xl border border-outline-variant/20 bg-surface shadow-lg p-3 text-left pointer-events-none">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-surface border-l border-t border-outline-variant/20" />
          {title && <p className="text-xs font-semibold text-on-surface mb-1">{title}</p>}
          <p className="text-xs text-on-surface-variant leading-relaxed">{body}</p>
        </div>
      )}
    </span>
  );
}
