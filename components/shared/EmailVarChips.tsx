"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link2, Calendar, ChevronDown } from "lucide-react";
import type { PaymentLink, CalendarLink, SchedulingLink } from "@/lib/pipeline-settings";

export const SIMPLE_VARIABLES = [
  { name: "{clientFirstName}", description: "Client's first name" },
  { name: "{artistName}",      description: "Your artist/studio name" },
  { name: "{appointmentDate}", description: "Confirmed appointment date (skipped if not set yet)" },
  { name: "{studioAddress}",   description: "Studio address from settings (skipped if blank)" },
];

const chipClass = "text-xs px-2.5 py-1.5 rounded-md font-mono bg-primary/8 text-primary hover:bg-primary/15 transition-colors inline-flex items-center gap-1.5";
const simpleChipClass = "text-xs px-2 py-1 rounded-md font-mono bg-primary/8 text-primary hover:bg-primary/15 transition-colors";

const DROPDOWN_WIDTH = 320;
const DROPDOWN_MARGIN = 8;

type DropdownPos = { bottom: number; left: number; maxHeight: number };

function usePortalDropdown() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos>({ bottom: 0, left: 0, maxHeight: 280 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.max(DROPDOWN_MARGIN, Math.min(r.left, vw - DROPDOWN_WIDTH - DROPDOWN_MARGIN));
      const maxHeight = Math.min(r.top - DROPDOWN_MARGIN, 280);
      setPos({ bottom: vh - r.top + 4, left, maxHeight });
    }
    setOpen(o => !o);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return { open, setOpen, pos, triggerRef, menuRef, toggle };
}

function PaymentLinkChip({ paymentLinks, onInsert }: { paymentLinks: PaymentLink[]; onInsert: (v: string) => void }) {
  const { open, setOpen, pos, triggerRef, menuRef, toggle } = usePortalDropdown();

  return (
    <>
      <button ref={triggerRef} type="button" onClick={toggle} className={chipClass}>
        <Link2 className="w-3 h-3" /> Payment link <ChevronDown className="w-3 h-3" />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="fixed z-[9999] min-w-[260px] max-w-[320px] rounded-lg border border-outline-variant/30 bg-surface shadow-lg py-1.5 overflow-y-auto" style={{ bottom: pos.bottom, left: pos.left, maxHeight: pos.maxHeight }}>
          {paymentLinks.length === 0 ? (
            <p className="px-3 py-2 text-xs text-on-surface-variant/70">
              No payment links saved yet.{" "}
              <a href="/payment-links" className="text-primary hover:underline">Add some →</a>
            </p>
          ) : paymentLinks.map(link => (
            <button key={link.label} type="button"
              onClick={() => { onInsert(`{paymentLink:${link.label}}`); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors">
              <p className="text-sm font-medium text-on-surface truncate">{link.label}</p>
              <p className="text-[10px] text-on-surface-variant/70 truncate mt-0.5">{link.url}</p>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

function SchedulingLinkChip({
  schedulingLinks,
  calendarLinks,
  onInsert,
}: {
  schedulingLinks: SchedulingLink[] | { id: string; label: string }[];
  calendarLinks: CalendarLink[];
  onInsert: (v: string) => void;
}) {
  const { open, setOpen, pos, triggerRef, menuRef, toggle } = usePortalDropdown();
  const allEmpty = schedulingLinks.length === 0 && calendarLinks.length === 0;

  return (
    <>
      <button ref={triggerRef} type="button" onClick={toggle} className={chipClass}>
        <Calendar className="w-3 h-3" /> Scheduling link <ChevronDown className="w-3 h-3" />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="fixed z-[9999] min-w-[260px] max-w-[320px] rounded-lg border border-outline-variant/30 bg-surface shadow-lg py-1.5 overflow-y-auto" style={{ bottom: pos.bottom, left: pos.left, maxHeight: pos.maxHeight }}>
          {allEmpty ? (
            <p className="px-3 py-2 text-xs text-on-surface-variant/70">
              No scheduling links yet.{" "}
              <a href="/payment-links" className="text-primary hover:underline">Add some →</a>
            </p>
          ) : (
            <>
              {schedulingLinks.length > 0 && (
                <>
                  <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/50">Native scheduling</p>
                  {schedulingLinks.map(link => (
                    <button key={link.id} type="button"
                      onClick={() => { onInsert("{schedulingLink}"); setOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors">
                      <p className="text-sm font-medium text-on-surface truncate">{link.label}</p>
                      <p className="text-[10px] text-on-surface-variant/70 mt-0.5">Per-booking scheduling URL</p>
                    </button>
                  ))}
                </>
              )}
              {calendarLinks.length > 0 && (
                <>
                  <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/50">External links</p>
                  {calendarLinks.map(link => (
                    <button key={link.label} type="button"
                      onClick={() => { onInsert(`{calendarLink:${link.label}}`); setOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors">
                      <p className="text-sm font-medium text-on-surface truncate">{link.label}</p>
                      <p className="text-[10px] text-on-surface-variant/70 truncate mt-0.5">{link.url}</p>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export function EmailVarChips({
  onInsert,
  paymentLinks = [],
  calendarLinks = [],
  schedulingLinks = [],
}: {
  onInsert: (v: string) => void;
  paymentLinks?: PaymentLink[];
  calendarLinks?: CalendarLink[];
  schedulingLinks?: SchedulingLink[] | { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {SIMPLE_VARIABLES.map(v => (
        <button key={v.name} type="button" onClick={() => onInsert(v.name)} title={v.description}
          className={simpleChipClass}>
          {v.name}
        </button>
      ))}
      <PaymentLinkChip paymentLinks={paymentLinks} onInsert={onInsert} />
      <SchedulingLinkChip schedulingLinks={schedulingLinks} calendarLinks={calendarLinks} onInsert={onInsert} />
    </div>
  );
}
