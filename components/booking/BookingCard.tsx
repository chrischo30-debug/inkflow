"use client";

import { Booking, BookingState, SentEmailEntry } from "@/lib/types";
import { formatPhone } from "@/lib/format";
import { StateBadge } from "./StateBadge";
import { Button } from "@/components/ui/button";
import { Check, Copy, MoreHorizontal, CalendarDays, ExternalLink, Send, X } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ALL_BOOKING_STATES } from "@/lib/pipeline-settings";
import type { SchedulingLink } from "@/lib/pipeline-settings";

const STATE_LABELS: Record<BookingState, string> = {
  inquiry:       "Submission",
  follow_up:     "Follow Up",
  accepted:      "Deposit Pending",
  sent_deposit:  "Sent Deposit",
  sent_calendar: "Sent Calendar",
  booked:        "Booked",
  confirmed:     "Booked",
  completed:     "Completed",
  rejected:      "Rejected",
  cancelled:     "Cancelled",
};

interface BookingCardProps {
  booking: Booking;
  fieldLabelMap?: Record<string, string>;
  nextActionLabel?: string | null;
  onAdvanceState?: (bookingId: string, currentState: BookingState) => void;
  onAcceptInquiry?: (bookingId: string) => void;
  onRejectInquiry?: (bookingId: string) => void;
  onFollowUpInquiry?: (bookingId: string) => void;
  onOpenEmail?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => Promise<void>;
  onMoveState?: (bookingId: string, targetState: BookingState) => Promise<void>;
  onEditAppointment?: (bookingId: string) => void;
  onDepositPaid?: (bookingId: string) => void;
  onDepositUnpaid?: (bookingId: string) => void;
  onCompleteSession?: (bookingId: string) => void;
  dragging?: boolean;
  paymentsConnected?: boolean;
  artistId?: string;
  schedulingLinks?: SchedulingLink[];
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
    <button type="button" onClick={copy} title="Copy"
      className="shrink-0 p-2 rounded-lg text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function looksLikeUrl(value: string) { return /^https?:\/\//i.test(value.trim()); }
function toReadableKey(key: string) { return key.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase()); }
function fmtShort(iso: string) { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function fmtDateTime(iso: string) { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }
function isToday(iso: string) {
  const d = new Date(iso), t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function CardOverflowMenu({
  current, bookingId, clientName, onMove, onCancel, onEmail, artistId, schedulingLinks = [],
}: {
  current: BookingState; bookingId: string; clientName: string;
  onMove?: (s: BookingState) => void; onCancel?: () => void; onEmail?: () => void;
  artistId?: string; schedulingLinks?: SchedulingLink[];
}) {
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = menuRect !== null;
  const close = useCallback(() => setMenuRect(null), []);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const copySchedulingLink = (linkId: string) => {
    if (!artistId) return;
    const url = `${window.location.origin}/schedule/${artistId}/${linkId}?bid=${bookingId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(linkId);
      setTimeout(() => setCopiedLinkId(null), 2000);
    });
    close();
  };

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
  const canEmail = Boolean(onEmail);

  const menuStyle = menuRect ? {
    position: "fixed" as const,
    bottom: window.innerHeight - menuRect.top + 4,
    right: window.innerWidth - menuRect.right,
  } : {};

  // Move-to options: exclude terminal states + current + legacy confirmed
  const moveTargets = ALL_BOOKING_STATES.filter(s => s !== current && s !== "confirmed");

  return (
    <>
      <button type="button" onClick={handleOpen} title="More actions"
        className="p-2.5 rounded-lg flex items-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={menuStyle} className="z-[9999] w-52 bg-surface-container-lowest border border-primary/20 rounded-xl shadow-lg py-1 overflow-hidden">
          <a href={`/bookings?expand=${encodeURIComponent(bookingId)}`}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-on-surface transition-colors"
            onClick={() => close()}>
            <ExternalLink className="w-3.5 h-3.5" /> View all details
          </a>
          <div className="my-1 border-t border-outline-variant/20" />
          {canEmail && onEmail && (
            <>
              <button type="button"
                className="w-full text-left px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-on-surface transition-colors"
                onClick={() => { onEmail(); close(); }}>
                Send email
              </button>
              <div className="my-1 border-t border-outline-variant/20" />
            </>
          )}
          {artistId && schedulingLinks.length > 0 && (
            <>
              {schedulingLinks.map(link => (
                <button key={link.id} type="button"
                  className="w-full text-left px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-on-surface transition-colors"
                  onClick={() => copySchedulingLink(link.id)}>
                  {copiedLinkId === link.id ? "✓ Copied" : `Copy scheduling link${schedulingLinks.length > 1 ? ` · ${link.label}` : ""}`}
                </button>
              ))}
              <div className="my-1 border-t border-outline-variant/20" />
            </>
          )}
          {onMove && moveTargets.map(s => (
            <button key={s} type="button"
              className="w-full text-left px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-on-surface transition-colors"
              onClick={() => { onMove(s); close(); }}>
              Move to {STATE_LABELS[s]}
            </button>
          ))}
          {canCancel && (
            <>
              <div className="my-1 border-t border-outline-variant/20" />
              <button type="button"
                className="w-full text-left px-3 py-2 text-sm font-medium text-destructive hover:bg-surface-container-high transition-colors"
                onClick={() => { onCancel(); close(); }}>
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
  booking, fieldLabelMap = {}, nextActionLabel,
  onAdvanceState, onAcceptInquiry, onRejectInquiry, onFollowUpInquiry,
  onOpenEmail, onCancel, onMoveState, onEditAppointment, onDepositPaid, onDepositUnpaid, onCompleteSession,
  dragging,
  paymentsConnected = false, artistId, schedulingLinks = [],
}: BookingCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [depositPaid, setDepositPaid] = useState(booking.deposit_paid ?? false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const customEntries = Object.entries(booking.custom_answers ?? {}).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && String(value).trim() !== "";
  });

  const isInquiry = booking.state === "inquiry" || booking.state === "follow_up";
  const isBooked = booking.state === "booked" || booking.state === "confirmed";

  // For multi-session bookings, the prominent date should reflect the NEXT
  // upcoming session — not session 1, which may already be completed. Falls
  // back to the booking's primary appointment_date for single-session.
  const sessionTotal = booking.session_count ?? 1;
  const sessionDoneCount = booking.completed_session_count ?? 0;
  const nextSessionDate = sessionTotal > 1
    ? (booking.session_appointments ?? [])[sessionDoneCount]?.appointment_date
    : undefined;
  const displayAppointmentDate = nextSessionDate || booking.appointment_date;
  const appointmentToday = displayAppointmentDate && isToday(displayAppointmentDate) && (isBooked || booking.state === "completed");

  return (
    <div
      data-coachmark="booking-card"
      className={`bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden group hover:shadow-sm hover:border-outline-variant/40 transition-all duration-200 cursor-grab active:cursor-grabbing ${dragging ? "opacity-40 scale-[0.98]" : ""}`}
    >
      <div className="p-4 flex flex-col gap-2.5">
        {/* Header */}
        <div className="flex justify-between items-start gap-2">
          <h4 className={`font-semibold text-base text-on-surface min-w-0 ${showDetails ? "break-words" : "line-clamp-1"}`}>{booking.client_name}</h4>
          <StateBadge state={booking.state} />
        </div>

        {/* Multi-session indicator */}
        {(booking.session_count ?? 1) > 1 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-tertiary bg-tertiary/10 border border-tertiary/20 rounded-md px-2 py-1 self-start">
            <span>
              {(booking.session_count ?? 1)}-session booking
              {typeof booking.completed_session_count === "number" && booking.completed_session_count > 0
                ? ` · ${booking.completed_session_count}/${booking.session_count} done`
                : ""}
            </span>
          </div>
        )}

        {/* Contact */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-sm text-on-surface-variant truncate min-w-0">{booking.client_email}</p>
            <CopyButton value={booking.client_email} />
          </div>
          {booking.client_phone && (
            <div className="flex items-center gap-1">
              <p className="text-sm text-on-surface-variant">{formatPhone(booking.client_phone)}</p>
              <CopyButton value={booking.client_phone} />
            </div>
          )}
        </div>

        {/* Per-session date list (multi-session bookings only) — shown above
            the primary appointment date so the artist can see every session at
            a glance. The next-up session has a "Mark done" affordance. */}
        {(booking.session_count ?? 1) > 1 && (
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low/50 px-2.5 py-2 space-y-1.5">
            {Array.from({ length: booking.session_count ?? 1 }).map((_, idx) => {
              const s = (booking.session_appointments ?? [])[idx];
              const done = !!s?.completed_at;
              return (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-medium ${done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>Session {idx + 1}</span>
                    <span className="text-on-surface-variant truncate">
                      {s?.appointment_date
                        ? new Date(s.appointment_date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : "Not booked yet"}
                    </span>
                  </div>
                  {done && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Guardrail: a booking in "booked" without a date is invalid — prompt
            the artist to set one. Clicking opens the date picker. */}
        {isBooked && !booking.appointment_date && (
          <button type="button"
            onClick={e => { e.stopPropagation(); onEditAppointment?.(booking.id); }}
            className="flex items-center gap-1.5 w-full rounded-lg px-2.5 py-2 transition-colors text-left border border-amber-300 bg-amber-50 hover:bg-amber-100">
            <CalendarDays className="w-3.5 h-3.5 shrink-0 text-amber-700" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">Date needed</p>
              <p className="text-xs text-amber-700">Click to set the appointment time</p>
            </div>
          </button>
        )}

        {/* Appointment date — prominent on booked/confirmed, subtle otherwise.
            For multi-session bookings, this reflects the NEXT upcoming session
            so the artist always sees what's coming up next. */}
        {displayAppointmentDate && (
          isBooked ? (
            <button type="button"
              onClick={e => { e.stopPropagation(); onEditAppointment?.(booking.id); }}
              title="Edit appointment"
              className={`flex items-start gap-1.5 w-full rounded-lg px-2.5 py-2 transition-colors text-left border ${appointmentToday ? "bg-amber-50/60 border-amber-200/60 hover:bg-amber-50" : "bg-primary/5 border-primary/15 hover:bg-primary/10"}`}>
              <CalendarDays className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${appointmentToday ? "text-amber-600" : "text-primary"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold leading-tight ${appointmentToday ? "text-amber-700" : "text-primary"}`}>
                  {sessionTotal > 1 && <span className="font-normal opacity-80">Next up · Session {sessionDoneCount + 1} · </span>}
                  {new Date(displayAppointmentDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  {appointmentToday && <span className="ml-1.5 font-bold">· Today</span>}
                </p>
                <p className={`text-xs leading-tight mt-0.5 ${appointmentToday ? "text-amber-600" : "text-primary/70"}`}>
                  {new Date(displayAppointmentDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </button>
          ) : booking.state === "completed" ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-container-low border border-outline-variant/20 px-2.5 py-2">
              <CalendarDays className="w-3.5 h-3.5 text-on-surface-variant/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface-variant">{fmtShort(displayAppointmentDate)}</p>
                <p className="text-sm text-on-surface-variant">{new Date(displayAppointmentDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3 text-on-surface-variant/50 shrink-0" />
              <p className="text-sm text-on-surface-variant">{fmtDateTime(displayAppointmentDate)}</p>
            </div>
          )
        )}

        {/* Deposit paid badge on sent_deposit/sent_calendar — clicking undoes. */}
        {(booking.state === "sent_deposit" || booking.state === "sent_calendar") && (depositPaid || booking.deposit_paid) && (
          <button
            type="button"
            title="Click to undo deposit paid"
            onClick={async () => {
              if (!window.confirm("Mark this deposit as unpaid?")) return;
              await fetch(`/api/bookings/${booking.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "unmark_deposit_paid" }),
              });
              setDepositPaid(false);
              onDepositUnpaid?.(booking.id);
            }}
            className="group/deposit inline-flex items-center gap-1 text-xs font-semibold text-white bg-emerald-600 border border-emerald-700/20 rounded-full px-2 py-0.5 self-start hover:bg-emerald-700 transition-colors"
          >
            <Check className="w-3 h-3 group-hover/deposit:hidden" />
            <X className="w-3 h-3 hidden group-hover/deposit:block" />
            <span className="group-hover/deposit:hidden">Deposit paid</span>
            <span className="hidden group-hover/deposit:inline">Undo deposit paid</span>
          </button>
        )}

        {/* Auto-confirm email failed on submission — artist may need to follow up manually */}
        {booking.state === "inquiry" && booking.inquiry_email_failed && (
          <span
            title="The automatic confirmation email to the client (or your new-submission notification) didn't go through. Reach out manually to confirm the inquiry was received."
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/60 rounded-full px-2 py-0.5 self-start"
          >
            ⚠ Email didn't send
          </span>
        )}

        <button type="button"
          className="text-xs font-medium text-on-surface-variant/60 hover:text-on-surface-variant underline self-start transition-colors"
          onClick={() => setShowDetails(v => !v)}>
          {showDetails ? "Hide details" : "Show details"}
        </button>

        {showDetails && (
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 space-y-2 text-sm">
            {booking.description && <p className="text-on-surface-variant">{booking.description}</p>}
            {(booking.description && (booking.size || booking.placement || typeof booking.budget === "number")) && <div className="border-t border-outline-variant/10 pt-2" />}
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
              <div className="pt-1 border-t border-outline-variant/10 space-y-1">
                <div className="flex gap-4 flex-wrap">
                  {typeof booking.total_amount === "number" && <p className="text-on-surface"><span className="font-medium">Total:</span> ${booking.total_amount}</p>}
                  {typeof booking.tip_amount === "number" && <p className="text-on-surface"><span className="font-medium">Tip:</span> ${booking.tip_amount}</p>}
                  {booking.payment_source && <p className="text-on-surface"><span className="font-medium">Paid via:</span> {booking.payment_source}</p>}
                </div>
                {typeof booking.total_amount === "number" && typeof booking.tip_amount === "number" && (
                  <p className="text-on-surface font-semibold">Final: ${booking.total_amount + booking.tip_amount}</p>
                )}
              </div>
            )}
            {(booking.sent_emails ?? []).length > 0 && (
              <div className="pt-1 border-t border-outline-variant/10 space-y-1">
                <p className="font-medium text-on-surface text-xs uppercase tracking-wide text-on-surface-variant">Emails sent</p>
                {(booking.sent_emails as SentEmailEntry[]).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-on-surface truncate">{entry.label}</p>
                    <p className="text-sm text-on-surface-variant whitespace-nowrap shrink-0">{fmtShort(entry.sent_at)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-1 border-t border-outline-variant/10 text-sm text-on-surface-variant">
              Submitted {fmtShort(booking.created_at)}
            </div>
            <div className="pt-1 border-t border-outline-variant/10 flex gap-3">
              <a href={`/bookings?expand=${encodeURIComponent(booking.id)}`}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> View booking
              </a>
              {booking.client_email && (
                <a href={`/past-clients?client=${encodeURIComponent(booking.client_email)}`}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View client
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-outline-variant/20 bg-surface-container-lowest">
        {/* Action row: when sent_deposit + unpaid, show the Mark-paid action /
            auto-advance hint on the left. When paid, the body-level "Deposit
            paid" badge above already conveys status, so we leave the slot empty
            here to avoid showing the same tag twice. */}
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          {(booking.state === "sent_deposit" || booking.state === "sent_calendar") && !(depositPaid || booking.deposit_paid) && (
            <div className="mr-auto flex items-center">
              {!paymentsConnected ? (
                <button type="button" disabled={markingPaid}
                  onClick={async () => {
                    setMarkingPaid(true);
                    await fetch(`/api/bookings/${booking.id}`, {
                      method: "PATCH", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "mark_deposit_paid" }),
                    });
                    setDepositPaid(true);
                    setMarkingPaid(false);
                    onDepositPaid?.(booking.id);
                  }}
                  className="flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-lg border border-emerald-300 bg-surface text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50">
                  <Check className="w-3 h-3" /> {markingPaid ? "Saving…" : "Mark deposit paid"}
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary/70 bg-primary/5 border border-primary/15 rounded-lg px-2 py-1">
                  <Send className="w-3 h-3 shrink-0" />
                  Auto-advances when paid
                </span>
              )}
            </div>
          )}
          {isInquiry ? (
            <>
              {onRejectInquiry && (
                <button type="button" onClick={() => onRejectInquiry(booking.id)}
                  className="h-8 text-xs px-2.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/5 transition-colors whitespace-nowrap">
                  Reject
                </button>
              )}
              {onFollowUpInquiry && booking.state === "inquiry" && (
                <button type="button" onClick={() => onFollowUpInquiry(booking.id)}
                  className="h-8 text-xs px-2.5 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high transition-colors whitespace-nowrap">
                  Follow Up
                </button>
              )}
              {onAcceptInquiry && (
                <Button size="sm" className="h-8 text-xs px-2.5 bg-on-surface text-surface hover:opacity-80"
                  onClick={() => onAcceptInquiry(booking.id)}>
                  Accept
                </Button>
              )}
            </>
          ) : (
            nextActionLabel && onAdvanceState && (
              <Button size="sm" className="h-8 text-xs px-2.5 bg-on-surface text-surface hover:opacity-80 whitespace-nowrap"
                onClick={() => onAdvanceState(booking.id, booking.state)}>
                {nextActionLabel}
              </Button>
            )
          )}
          <CardOverflowMenu
            current={booking.state}
            bookingId={booking.id}
            clientName={booking.client_name}
            onMove={onMoveState ? s => onMoveState(booking.id, s) : undefined}
            onCancel={onCancel ? () => onCancel(booking.id) : undefined}
            onEmail={onOpenEmail ? () => onOpenEmail(booking.id) : undefined}
            artistId={artistId}
            schedulingLinks={schedulingLinks}
          />
        </div>
      </div>
    </div>
  );
}
