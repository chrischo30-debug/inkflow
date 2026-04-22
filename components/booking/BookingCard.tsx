"use client";

import { Booking, BookingState } from "@/lib/types";
import { StateBadge } from "./StateBadge";
import { Button } from "@/components/ui/button";
import { Check, Copy, MoreHorizontal, CalendarDays } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ALL_BOOKING_STATES } from "@/lib/pipeline-settings";

const STATE_LABELS: Record<BookingState, string> = {
  inquiry:   "Submission",
  follow_up: "Follow Ups",
  accepted:  "Accepted",
  confirmed: "Booked",
  completed: "Completed",
  rejected:  "Rejected",
  cancelled: "Cancelled",
};

interface BookingCardProps {
  booking: Booking;
  fieldLabelMap?: Record<string, string>;
  nextActionLabel?: string | null;
  onAdvanceState?: (bookingId: string, currentState: BookingState) => void;
  onAcceptInquiry?: (bookingId: string) => void;
  onRejectInquiry?: (bookingId: string) => void;
  onFollowUpInquiry?: (bookingId: string) => void;
  onConfirmAppointment?: (bookingId: string) => void;
  onOpenEmail?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => Promise<void>;
  onMoveState?: (bookingId: string, targetState: BookingState) => Promise<void>;
  onEditAppointment?: (bookingId: string) => void;
  dragging?: boolean;
  onDragStart?: (bookingId: string) => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className="shrink-0 p-1 rounded text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function toReadableKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}


function CardOverflowMenu({
  current,
  onMove,
  onCancel,
  onEmail,
}: {
  current: BookingState;
  onMove?: (s: BookingState) => void;
  onCancel?: () => void;
  onEmail?: () => void;
}) {
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = menuRect !== null;
  const close = useCallback(() => setMenuRect(null), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (open) { close(); return; }
    setMenuRect(e.currentTarget.getBoundingClientRect());
  };

  const canCancel = onCancel && current !== "completed" && current !== "cancelled" && current !== "rejected";
  const canEmail = onEmail && current !== "completed" && current !== "cancelled" && current !== "rejected";

  const menuStyle = menuRect ? {
    position: "fixed" as const,
    bottom: window.innerHeight - menuRect.top + 4,
    right: window.innerWidth - menuRect.right,
  } : {};

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="More actions"
        className="p-1.5 rounded-lg flex items-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={menuStyle} className="z-[9999] w-48 bg-surface-container-lowest border border-primary/20 rounded-xl shadow-lg py-1 overflow-hidden">
          {canEmail && (
            <>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-on-surface transition-colors"
                onClick={() => { onEmail(); close(); }}
              >
                Send email
              </button>
              <div className="my-1 border-t border-outline-variant/20" />
            </>
          )}
          {onMove && ALL_BOOKING_STATES.filter(s => s !== current).map(s => (
            <button
              key={s}
              type="button"
              className="w-full text-left px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-on-surface transition-colors"
              onClick={() => { onMove(s); close(); }}
            >
              Move to {STATE_LABELS[s]}
            </button>
          ))}
          {canCancel && (
            <>
              <div className="my-1 border-t border-outline-variant/20" />
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm font-medium text-destructive hover:bg-surface-container-high transition-colors"
                onClick={() => { onCancel(); close(); }}
              >
                Cancel booking
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export function BookingCard({
  booking,
  fieldLabelMap = {},
  nextActionLabel,
  onAdvanceState,
  onAcceptInquiry,
  onRejectInquiry,
  onFollowUpInquiry,
  onConfirmAppointment,
  onOpenEmail,
  onCancel,
  onMoveState,
  onEditAppointment,
  dragging,
  onDragStart,
}: BookingCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const customEntries = Object.entries(booking.custom_answers ?? {}).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && String(value).trim() !== "";
  });

  const isInquiry = booking.state === "inquiry" || booking.state === "follow_up";
  const isAccepted = booking.state === "accepted";

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={e => { onDragStart?.(booking.id); e.dataTransfer.effectAllowed = "move"; }}
      className={`bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden group hover:shadow-sm hover:border-outline-variant/40 transition-all duration-200 ${onDragStart ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-40 scale-[0.98]" : ""}`}
    >
      {/* Main content area */}
      <div className="p-4 flex flex-col gap-2.5">
        {/* Header: name + state badge */}
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-semibold text-base text-on-surface line-clamp-1 min-w-0">{booking.client_name}</h4>
          <StateBadge state={booking.state} />
        </div>

        {/* Always-visible: email + phone with copy buttons */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-sm text-on-surface-variant truncate min-w-0">{booking.client_email}</p>
            <CopyButton value={booking.client_email} />
          </div>
          {booking.client_phone && (
            <div className="flex items-center gap-1">
              <p className="text-sm text-on-surface-variant">{booking.client_phone}</p>
              <CopyButton value={booking.client_phone} />
            </div>
          )}
        </div>

        {/* Appointment date — prominent on confirmed, subtle otherwise */}
        {booking.appointment_date && (
          booking.state === "confirmed" ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onEditAppointment?.(booking.id); }}
              title="Edit appointment"
              className="flex items-center gap-1.5 w-full rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-2 hover:bg-primary/10 transition-colors text-left"
            >
              <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-medium text-primary truncate">{fmtDateTime(booking.appointment_date)}</span>
            </button>
          ) : (
            <p className="text-xs text-on-surface-variant/70">{fmtShort(booking.appointment_date)}</p>
          )
        )}

        {/* Expand toggle */}
        <button
          type="button"
          className="text-xs font-medium text-on-surface-variant/60 hover:text-on-surface-variant underline self-start transition-colors"
          onClick={() => setShowDetails(v => !v)}
        >
          {showDetails ? "Hide details" : "Show details"}
        </button>

        {/* Expanded details */}
        {showDetails && (
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 space-y-2 text-sm">
            {booking.description && (
              <p className="text-on-surface-variant">{booking.description}</p>
            )}
            {(booking.description && (booking.size || booking.placement || typeof booking.budget === "number")) && (
              <div className="border-t border-outline-variant/10 pt-2" />
            )}
            {booking.size && <p className="text-on-surface"><span className="font-medium">{fieldLabelMap.size ?? "Size"}:</span> {booking.size}</p>}
            {booking.placement && <p className="text-on-surface"><span className="font-medium">{fieldLabelMap.placement ?? "Placement"}:</span> {booking.placement}</p>}
            {typeof booking.budget === "number" && <p className="text-on-surface"><span className="font-medium">{fieldLabelMap.budget ?? "Budget"}:</span> ${booking.budget}</p>}
            {(booking.reference_urls ?? []).length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-on-surface">{fieldLabelMap.reference_images ?? "References"}:</p>
                {(booking.reference_urls ?? []).map(url => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="block text-primary underline break-all">{url}</a>
                ))}
              </div>
            )}
            {customEntries.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-outline-variant/10">
                {customEntries.map(([key, value]) => (
                  <div key={key}>
                    <p className="font-medium text-on-surface">{fieldLabelMap[key] ?? toReadableKey(key)}</p>
                    {Array.isArray(value) ? (
                      value.map(item => looksLikeUrl(item)
                        ? <a key={item} href={item} target="_blank" rel="noreferrer" className="block text-primary underline break-all">{item}</a>
                        : <span key={item} className="block text-on-surface-variant">{item}</span>)
                    ) : typeof value === "boolean" ? (
                      <p className="text-on-surface-variant">{value ? "Yes" : "No"}</p>
                    ) : looksLikeUrl(String(value)) ? (
                      <a href={String(value)} target="_blank" rel="noreferrer" className="text-primary underline break-all">{String(value)}</a>
                    ) : (
                      <p className="text-on-surface-variant">{String(value)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {booking.completion_notes && (
              <div className="pt-1 border-t border-outline-variant/10">
                <p className="font-medium text-on-surface">Notes:</p>
                <p className="text-on-surface-variant">{booking.completion_notes}</p>
              </div>
            )}
            {(typeof booking.total_amount === "number" || typeof booking.tip_amount === "number") && (
              <div className="pt-1 border-t border-outline-variant/10 flex gap-4">
                {typeof booking.total_amount === "number" && <p className="text-on-surface"><span className="font-medium">Total:</span> ${booking.total_amount}</p>}
                {typeof booking.tip_amount === "number" && <p className="text-on-surface"><span className="font-medium">Tip:</span> ${booking.tip_amount}</p>}
              </div>
            )}
            <div className="pt-1 border-t border-outline-variant/10 text-xs text-on-surface-variant/60">
              Submitted {fmtShort(booking.created_at)}
            </div>
          </div>
        )}
      </div>

      {/* Footer — sits inside the rounded card, separated by border */}
      <div className="px-3 py-2.5 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-end gap-1.5">
        {isInquiry ? (
          <>
            {onRejectInquiry && (
              <button type="button" onClick={() => onRejectInquiry(booking.id)} className="h-8 text-xs px-2.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/5 transition-colors whitespace-nowrap">
                Reject
              </button>
            )}
            {onFollowUpInquiry && booking.state === "inquiry" && (
              <button type="button" onClick={() => onFollowUpInquiry(booking.id)} className="h-8 text-xs px-2.5 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high transition-colors whitespace-nowrap">
                Follow Up
              </button>
            )}
            {onAcceptInquiry && (
              <Button size="sm" className="h-8 text-xs px-2.5 bg-on-surface text-surface hover:opacity-80" onClick={() => onAcceptInquiry(booking.id)}>
                Accept
              </Button>
            )}
          </>
        ) : isAccepted ? (
          onConfirmAppointment && (
            <Button size="sm" className="h-8 text-xs px-2.5 bg-on-surface text-surface hover:opacity-80 whitespace-nowrap" onClick={() => onConfirmAppointment(booking.id)}>
              Confirm Appt
            </Button>
          )
        ) : (
          nextActionLabel && onAdvanceState && (
            <Button size="sm" className="h-8 text-xs px-2.5 bg-on-surface text-surface hover:opacity-80 whitespace-nowrap" onClick={() => onAdvanceState(booking.id, booking.state)}>
              {nextActionLabel}
            </Button>
          )
        )}
        {(onMoveState || onCancel || onOpenEmail) && (
          <CardOverflowMenu
            current={booking.state}
            onMove={onMoveState ? (s) => onMoveState(booking.id, s) : undefined}
            onCancel={onCancel ? () => onCancel(booking.id) : undefined}
            onEmail={onOpenEmail ? () => onOpenEmail(booking.id) : undefined}
          />
        )}
      </div>
    </div>
  );
}
