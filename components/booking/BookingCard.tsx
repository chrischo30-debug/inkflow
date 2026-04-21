import { Booking, BookingState } from "@/lib/types";
import { StateBadge } from "./StateBadge";
import { Button } from "@/components/ui/button";
import { Mail, Check, ExternalLink, MoreHorizontal } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { gmailThreadUrl } from "@/lib/gmail";
import { NextAction } from "@/lib/pipeline-settings";

const ALL_STATES: { value: BookingState; label: string }[] = [
  { value: "inquiry",      label: "Inquiry" },
  { value: "reviewed",     label: "Reviewed" },
  { value: "deposit_sent", label: "Deposit Sent" },
  { value: "deposit_paid", label: "Deposit Paid" },
  { value: "confirmed",    label: "Confirmed" },
  { value: "completed",    label: "Completed" },
  { value: "cancelled",    label: "Cancelled" },
];

interface BookingCardProps {
  booking: Booking;
  fieldLabelMap?: Record<string, string>;
  cardFields?: string[];
  nextAction?: NextAction;
  onAdvanceState?: (bookingId: string, currentState: BookingState) => void;
  onSendEmail?: (bookingId: string) => Promise<void>;
  onCancel?: (bookingId: string) => Promise<void>;
  onMoveState?: (bookingId: string, targetState: BookingState) => Promise<void>;
  dragging?: boolean;
  onDragStart?: (bookingId: string) => void;
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function CardOverflowMenu({
  current,
  onMove,
  onCancel,
}: {
  current: BookingState;
  onMove?: (s: BookingState) => void;
  onCancel?: () => void;
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

  const canCancel = onCancel && current !== "completed" && current !== "cancelled";

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
        <div ref={menuRef} style={menuStyle} className="z-[9999] w-44 bg-surface-container-lowest border border-primary/20 rounded-xl shadow-lg py-1 overflow-hidden">
          {onMove && ALL_STATES.filter(s => s.value !== current).map(s => (
            <button
              key={s.value}
              type="button"
              className="w-full text-left px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-on-surface transition-colors"
              onClick={() => { onMove(s.value); close(); }}
            >
              Move to {s.label}
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

const DEFAULT_CARD_FIELDS = ["description", "size", "placement", "budget"];

export function BookingCard({ booking, fieldLabelMap = {}, cardFields = DEFAULT_CARD_FIELDS, nextAction, onAdvanceState, onSendEmail, onCancel, onMoveState, dragging, onDragStart }: BookingCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSendEmail = async () => {
    if (!onSendEmail || sendingEmail) return;
    setSendingEmail(true);
    await onSendEmail(booking.id);
    setSendingEmail(false);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  const customEntries = Object.entries(booking.custom_answers ?? {}).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && String(value).trim() !== "";
  });

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={e => {
        onDragStart?.(booking.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-5 flex flex-col gap-3 group hover:shadow-sm hover:border-outline-variant/40 transition-all duration-200 ${onDragStart ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-40 scale-[0.98]" : ""}`}
    >
      <div className="flex justify-between items-start mb-1">
        <h4 className="font-semibold text-base text-on-surface line-clamp-1">{booking.client_name}</h4>
        <StateBadge state={booking.state} />
      </div>

      {cardFields.includes("description") && (
        <p className="text-sm text-on-surface-variant line-clamp-2">{booking.description}</p>
      )}

      {/* Inline field pills for size/placement/budget */}
      {(cardFields.includes("size") || cardFields.includes("placement") || cardFields.includes("budget")) && (
        <div className="flex flex-wrap gap-1.5">
          {cardFields.includes("size") && booking.size && (
            <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-sm text-on-surface-variant">
              {fieldLabelMap.size ?? "Size"}: {booking.size}
            </span>
          )}
          {cardFields.includes("placement") && booking.placement && (
            <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-sm text-on-surface-variant">
              {fieldLabelMap.placement ?? "Placement"}: {booking.placement}
            </span>
          )}
          {cardFields.includes("budget") && typeof booking.budget === "number" && (
            <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-sm text-on-surface-variant">
              ${booking.budget}
            </span>
          )}
          {cardFields.includes("phone") && booking.client_phone && (
            <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-sm text-on-surface-variant">
              {booking.client_phone}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-on-surface-variant/70 flex-wrap">
        <span>{fmtShort(booking.created_at)}</span>
        {booking.last_email_sent_at && (
          <span>· Emailed {timeAgo(booking.last_email_sent_at)}</span>
        )}
      </div>

      <button
        type="button"
        className="text-sm font-medium text-primary underline self-start"
        onClick={() => setShowDetails(v => !v)}
      >
        {showDetails ? "Hide details" : "View details"}
      </button>

      {showDetails && (
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 space-y-2 text-sm">
          <p className="text-on-surface"><span className="font-semibold">Email:</span> {booking.client_email}</p>
          {booking.client_phone && <p className="text-on-surface"><span className="font-semibold">{fieldLabelMap.phone ?? "Phone"}:</span> {booking.client_phone}</p>}
          {booking.size && <p className="text-on-surface"><span className="font-semibold">{fieldLabelMap.size ?? "Size"}:</span> {booking.size}</p>}
          {booking.placement && <p className="text-on-surface"><span className="font-semibold">{fieldLabelMap.placement ?? "Placement"}:</span> {booking.placement}</p>}
          {typeof booking.budget === "number" && <p className="text-on-surface"><span className="font-semibold">{fieldLabelMap.budget ?? "Budget"}:</span> ${booking.budget}</p>}
          {(booking.reference_urls ?? []).length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-on-surface">{fieldLabelMap.reference_images ?? "References"}:</p>
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
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-outline-variant/20 flex items-center justify-between gap-3">
        {/* Left: email + gmail actions */}
        <div className="flex items-center gap-1">
          {onSendEmail && booking.state !== "completed" && booking.state !== "cancelled" && (
            <button type="button" onClick={handleSendEmail} disabled={sendingEmail} title="Send email" className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors disabled:opacity-50">
              {emailSent ? <Check className="w-4 h-4 text-emerald-600" /> : <Mail className="w-4 h-4" />}
            </button>
          )}
          {booking.gmail_thread_id && (
            <a href={gmailThreadUrl(booking.gmail_thread_id)} target="_blank" rel="noreferrer" title="View in Gmail" className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {booking.appointment_date && (
            <span className="text-xs text-on-surface-variant ml-1">{fmtShort(booking.appointment_date)}</span>
          )}
        </div>

        {/* Right: primary action + overflow menu */}
        <div className="flex items-center gap-2 shrink-0">
          {nextAction && onAdvanceState && (
            <Button size="sm" className="h-9 text-sm px-3 bg-on-surface text-surface hover:opacity-80" onClick={() => onAdvanceState(booking.id, booking.state)}>
              {nextAction.label}
            </Button>
          )}
          {(onMoveState || onCancel) && (
            <CardOverflowMenu
              current={booking.state}
              onMove={onMoveState ? (s) => onMoveState(booking.id, s) : undefined}
              onCancel={onCancel ? () => onCancel(booking.id) : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
