"use client";

import { Booking, BookingState, SentEmailEntry } from "@/lib/types";
import { StateBadge } from "./StateBadge";
import { Button } from "@/components/ui/button";
import { Check, Copy, MoreHorizontal, CalendarDays, DollarSign, ExternalLink } from "lucide-react";
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
  onDepositPaid?: (bookingId: string) => void;
  dragging?: boolean;
  onDragStart?: (bookingId: string) => void;
  hasStripe?: boolean;
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

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}


function CardOverflowMenu({
  current,
  bookingId,
  clientName,
  onMove,
  onCancel,
  onEmail,
}: {
  current: BookingState;
  bookingId: string;
  clientName: string;
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
          <a
            href={`/bookings?expand=${encodeURIComponent(bookingId)}`}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-on-surface transition-colors"
            onClick={() => close()}
          >
            <ExternalLink className="w-3.5 h-3.5" /> View all details
          </a>
          <div className="my-1 border-t border-outline-variant/20" />
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
  onDepositPaid,
  dragging,
  onDragStart,
  hasStripe = false,
}: BookingCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [depositModal, setDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [depositLinkUrl, setDepositLinkUrl] = useState(booking.stripe_payment_link_url ?? "");
  const [depositCopied, setDepositCopied] = useState(false);
  const [depositPaid, setDepositPaid] = useState(booking.deposit_paid ?? false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const customEntries = Object.entries(booking.custom_answers ?? {}).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && String(value).trim() !== "";
  });

  const isInquiry = booking.state === "inquiry" || booking.state === "follow_up";
  const isAccepted = booking.state === "accepted";
  const showDepositActions = hasStripe && (isAccepted || booking.state === "confirmed");
  const showDepositBadge = !hasStripe && booking.state === "confirmed";

  const appointmentToday = booking.appointment_date && isToday(booking.appointment_date) &&
    (booking.state === "confirmed" || booking.state === "completed");

  const generateDepositLink = async () => {
    const cents = Math.round(parseFloat(depositAmount) * 100);
    if (!cents || cents < 100) { setDepositError("Enter a valid amount (minimum $1)"); return; }
    setDepositLoading(true);
    setDepositError("");
    try {
      const res = await fetch(`/api/bookings/${booking.id}/stripe-payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: cents }),
      });
      const data = await res.json();
      if (!res.ok) { setDepositError(data.error ?? "Failed to generate link"); return; }
      setDepositLinkUrl(data.url);
      setDepositModal(false);
      navigator.clipboard.writeText(data.url).then(() => {
        setDepositCopied(true);
        setTimeout(() => setDepositCopied(false), 2000);
      });
    } catch {
      setDepositError("Network error");
    } finally {
      setDepositLoading(false);
    }
  };

  const copyDepositLink = () => {
    navigator.clipboard.writeText(depositLinkUrl).then(() => {
      setDepositCopied(true);
      setTimeout(() => setDepositCopied(false), 2000);
    });
  };

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={e => { onDragStart?.(booking.id); e.dataTransfer.effectAllowed = "move"; }}
      className={`bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden group hover:shadow-sm hover:border-outline-variant/40 transition-all duration-200 ${onDragStart ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-40 scale-[0.98]" : ""}`}
    >
      {/* Main content area */}
      <div className="p-4 flex flex-col gap-2.5">
        {/* Header: name + notification dot + state badge */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="font-semibold text-base text-on-surface line-clamp-1 min-w-0">{booking.client_name}</h4>
          </div>
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
              className={`flex items-start gap-1.5 w-full rounded-lg px-2.5 py-2 transition-colors text-left border ${appointmentToday ? "bg-amber-50/60 border-amber-200/60 hover:bg-amber-50" : "bg-primary/5 border-primary/15 hover:bg-primary/10"}`}
            >
              <CalendarDays className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${appointmentToday ? "text-amber-600" : "text-primary"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold leading-tight ${appointmentToday ? "text-amber-700" : "text-primary"}`}>
                  {new Date(booking.appointment_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  {appointmentToday && <span className="ml-1.5 font-bold">· Today</span>}
                </p>
                <p className={`text-xs leading-tight mt-0.5 ${appointmentToday ? "text-amber-600" : "text-primary/70"}`}>
                  {new Date(booking.appointment_date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </button>
          ) : booking.state === "completed" ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-container-low border border-outline-variant/20 px-2.5 py-2">
              <CalendarDays className="w-3.5 h-3.5 text-on-surface-variant/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-variant/70">{fmtShort(booking.appointment_date)}</p>
                <p className="text-xs text-on-surface-variant/50">{new Date(booking.appointment_date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
              </div>
              {appointmentToday && <span className="ml-auto text-xs font-medium text-on-surface-variant/50 shrink-0">Today</span>}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3 text-on-surface-variant/50 shrink-0" />
              <p className="text-xs text-on-surface-variant/70">{fmtDateTime(booking.appointment_date)}</p>
            </div>
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
            {/* Emails sent history */}
            {(booking.sent_emails ?? []).length > 0 && (
              <div className="pt-1 border-t border-outline-variant/10 space-y-1">
                <p className="font-medium text-on-surface text-xs uppercase tracking-wide text-on-surface-variant">Emails sent</p>
                {(booking.sent_emails as SentEmailEntry[]).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-on-surface truncate">{entry.label}</p>
                    <p className="text-xs text-on-surface-variant/60 whitespace-nowrap shrink-0">{fmtShort(entry.sent_at)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-1 border-t border-outline-variant/10 text-xs text-on-surface-variant/60">
              Submitted {fmtShort(booking.created_at)}
            </div>
          </div>
        )}
      </div>

      {/* Footer — sits inside the rounded card, separated by border */}
      <div className="px-3 py-2.5 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between gap-1.5">
        {/* Left: deposit + cal.com automation icons */}
        <div className="flex items-center gap-1">
          {showDepositBadge && (
            depositPaid ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200/60 rounded-full px-2 py-0.5">
                <Check className="w-3 h-3" /> Deposit paid
              </span>
            ) : (
              <button
                type="button"
                disabled={markingPaid}
                onClick={async () => {
                  setMarkingPaid(true);
                  await fetch(`/api/bookings/${booking.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "mark_deposit_paid" }),
                  });
                  setDepositPaid(true);
                  setMarkingPaid(false);
                  onDepositPaid?.(booking.id);
                }}
                className="flex items-center gap-1 h-7 px-2.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Check className="w-3 h-3" /> {markingPaid ? "Saving…" : "Mark paid"}
              </button>
            )
          )}
          {showDepositActions && (
            booking.deposit_paid ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200/60 rounded-full px-2 py-0.5">
                <Check className="w-3 h-3" /> Deposit paid
              </span>
            ) : depositLinkUrl ? (
              <button
                type="button"
                onClick={copyDepositLink}
                title="Copy deposit link"
                className="flex items-center gap-1 h-7 px-2 text-xs rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
              >
                {depositCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <DollarSign className="w-3 h-3" />}
                {depositCopied ? "Copied" : "Deposit link"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDepositAmount(booking.budget ? String(booking.budget) : "");
                  setDepositError("");
                  setDepositModal(true);
                }}
                title="Generate deposit link"
                className="flex items-center gap-1 h-7 px-2 text-xs rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              >
                <DollarSign className="w-3 h-3" /> Deposit link
              </button>
            )
          )}
        </div>

        {/* Right: primary action + overflow */}
        <div className="flex items-center gap-1.5">
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
          <CardOverflowMenu
            current={booking.state}
            bookingId={booking.id}
            clientName={booking.client_name}
            onMove={onMoveState ? (s) => onMoveState(booking.id, s) : undefined}
            onCancel={onCancel ? () => onCancel(booking.id) : undefined}
            onEmail={onOpenEmail ? () => onOpenEmail(booking.id) : undefined}
          />
        </div>
      </div>

      {/* Deposit link modal */}
      {depositModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setDepositModal(false)}>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-sm font-semibold text-on-surface">Generate deposit link</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Creates a Stripe payment link for {booking.client_name}.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-on-surface-variant">Deposit amount (USD)</label>
              <div className="flex items-center gap-1 rounded-lg border border-outline-variant/30 bg-surface-container-high/40 px-3 py-2 focus-within:border-primary transition-colors">
                <span className="text-sm text-on-surface-variant">$</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  step="0.01"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && generateDepositLink()}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50"
                />
              </div>
              {depositError && <p className="text-xs text-destructive">{depositError}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDepositModal(false)} className="flex-1 h-9 text-sm rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
                Cancel
              </button>
              <button type="button" onClick={generateDepositLink} disabled={depositLoading} className="flex-1 h-9 text-sm rounded-lg bg-on-surface text-surface hover:opacity-80 disabled:opacity-50 transition-opacity">
                {depositLoading ? "Creating…" : "Generate & copy"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
