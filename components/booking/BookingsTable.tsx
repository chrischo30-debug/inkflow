"use client";

import { useState, Fragment, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Booking, BookingState } from "@/lib/types";
import { formatPhone } from "@/lib/format";
import { Search } from "lucide-react";
import { StateBadge } from "./StateBadge";
import { Mail, ChevronDown, ChevronRight, DollarSign, Check, Copy, CalendarDays, Send, X, MessageSquare } from "lucide-react";
import { EmailComposeModal, type ResolvedTemplate, type InsertLink } from "./EmailComposeModal";
import { AcceptModal } from "./AcceptModal";
import { ConfirmAppointmentModal } from "./ConfirmAppointmentModal";
import { SendCalendarModal } from "./SendCalendarModal";
import { useLocalDraft } from "@/lib/use-local-draft";
import type { SchedulingLink } from "@/lib/pipeline-settings";

const STATE_TABS: { value: string; label: string }[] = [
  { value: "all",           label: "All" },
  { value: "inquiry",       label: "Submissions" },
  { value: "follow_up",     label: "Follow Ups" },
  { value: "sent_deposit",  label: "Sent Deposit" },
  { value: "sent_calendar", label: "Sent Calendar" },
  { value: "booked",        label: "Booked" },
  { value: "completed",     label: "Completed" },
  { value: "rejected",      label: "Rejected" },
  { value: "cancelled",     label: "Cancelled" },
];

const MOVE_STATES: { value: BookingState; label: string }[] = [
  { value: "inquiry",       label: "Submission" },
  { value: "follow_up",     label: "Follow Up" },
  { value: "sent_deposit",  label: "Sent Deposit" },
  { value: "sent_calendar", label: "Sent Calendar" },
  { value: "booked",        label: "Booked" },
  { value: "completed",     label: "Completed" },
  { value: "rejected",      label: "Rejected" },
  { value: "cancelled",     label: "Cancelled" },
];

const STATE_FLOW: Record<BookingState, { label: string } | null> = {
  inquiry:       { label: "Accept" },
  follow_up:     { label: "Accept" },
  accepted:      { label: "Send Calendar" }, // legacy
  sent_deposit:  { label: "Send Calendar" },
  sent_calendar: { label: "Mark Booked" },
  booked:        { label: "Complete" },
  confirmed:     { label: "Complete" },
  completed:     null,
  rejected:      null,
  cancelled:     null,
};

const NEXT_STATE: Partial<Record<BookingState, BookingState>> = {
  inquiry:       "sent_deposit",
  follow_up:     "sent_deposit",
  accepted:      "sent_calendar", // legacy
  sent_deposit:  "sent_calendar",
  sent_calendar: "booked",
  booked:        "completed",
  confirmed:     "completed",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function isStale(iso: string, thresholdDays = 3): boolean {
  return Date.now() - new Date(iso).getTime() > thresholdDays * 86400000;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

type EmailCompose = {
  bookingId: string;
  subject: string;
  body: string;
  templates: ResolvedTemplate[];
  defaultTemplateState?: string | null;
  afterSendState?: BookingState;
  paymentLinks?: InsertLink[];
  calendarLinks?: InsertLink[];
  schedulingLinks?: { id: string; label: string }[];
  previewVars?: Record<string, string>;
};

type CompletionModal = { bookingId: string; images: File[] };

function resolveEmailLabel(label: string, booking: { client_name?: string; appointment_date?: string | null }, artistName: string): string {
  const firstName = (booking.client_name ?? "").split(" ")[0] || booking.client_name || "";
  const apptDate = booking.appointment_date
    ? new Date(booking.appointment_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";
  return label
    .replace(/\{clientFirstName\}/g, firstName)
    .replace(/\{clientName\}/g, booking.client_name ?? "")
    .replace(/\{artistName\}/g, artistName)
    .replace(/\{appointmentDate\}/g, apptDate)
    .replace(/\{[^}]+\}/g, ""); // strip any remaining unknowns
}

function InlineCopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      title="Copy"
      className={`shrink-0 p-1 rounded text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors ${className ?? ""}`}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function BookingsTable({
  bookings: initialBookings,
  fieldLabelMap,
  initialState,
  initialExpandId = null,
  calendarSyncEnabled = false,
  paymentsConnected = false,
  paymentProvider = null,
  artistName = "",
  artistId = "",
  schedulingLinks = [],
}: {
  bookings: Booking[];
  fieldLabelMap: Record<string, string>;
  initialState: string;
  initialExpandId?: string | null;
  calendarSyncEnabled?: boolean;
  paymentsConnected?: boolean;
  paymentProvider?: "stripe" | "square" | null;
  artistName?: string;
  artistId?: string;
  schedulingLinks?: SchedulingLink[];
}) {
  const providerLabel = paymentProvider === "square" ? "Square" : "Stripe";
  const [bookings, setBookings] = useState(initialBookings);
  const [activeTab, setActiveTab] = useState(initialState);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandId);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const setRowRef = useCallback((id: string) => (el: HTMLTableRowElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  // Auto-scroll to initially expanded row
  useEffect(() => {
    if (!initialExpandId) return;
    const timer = setTimeout(() => {
      const el = rowRefs.current.get(initialExpandId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(timer);
  }, [initialExpandId]);
  const [emailCompose, setEmailCompose] = useState<EmailCompose | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  const [emailLoadingId, setEmailLoadingId] = useState<string | null>(null);
  const [completionModal, setCompletionModal] = useState<CompletionModal | null>(null);
  const [completionData, setCompletionData] = useState({ total_amount: "", tip_amount: "", notes: "" });
  const [completionUploading, setCompletionUploading] = useState(false);

  // Draft-persist completion form (text fields only — File queue can't survive
  // a page refresh anyway). Keyed by booking id while the modal is open.
  const completionDraftKey = completionModal ? `fb:completion-draft:${completionModal.bookingId}` : null;
  const completionDraft = useLocalDraft({
    key: completionDraftKey,
    value: completionData,
    onRestore: saved => {
      if (saved && typeof saved === "object") {
        setCompletionData({
          total_amount: typeof saved.total_amount === "string" ? saved.total_amount : "",
          tip_amount: typeof saved.tip_amount === "string" ? saved.tip_amount : "",
          notes: typeof saved.notes === "string" ? saved.notes : "",
        });
      }
    },
  });
  const [acceptModal, setAcceptModal] = useState<{ bookingId: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ bookingId: string; initialAppointmentDate?: string } | null>(null);
  const [sendCalendarModal, setSendCalendarModal] = useState<{ bookingId: string } | null>(null);
  const [depositModal, setDepositModal] = useState<{ bookingId: string; amount: string } | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const generateDepositLink = async () => {
    if (!depositModal) return;
    const cents = Math.round(parseFloat(depositModal.amount) * 100);
    if (!cents || cents < 100) { setDepositError("Enter a valid amount (minimum $1)"); return; }
    setDepositLoading(true);
    setDepositError("");
    try {
      const res = await fetch(`/api/bookings/${depositModal.bookingId}/deposit-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: cents }),
      });
      const data = await res.json();
      if (!res.ok) { setDepositError(data.error ?? "Failed to generate link"); setDepositLoading(false); return; }
      setBookings(prev => prev.map(b => b.id === depositModal.bookingId ? { ...b, deposit_link_url: data.url, stripe_payment_link_url: data.url } : b));
      setDepositModal(null);
      navigator.clipboard.writeText(data.url).then(() => {
        setCopiedLink(depositModal.bookingId);
        setTimeout(() => setCopiedLink(null), 2000);
      });
    } catch {
      setDepositError("Network error");
    } finally {
      setDepositLoading(false);
    }
  };

  const q = search.trim().toLowerCase();
  const tabFiltered = activeTab === "all"
    ? bookings
    : activeTab === "booked"
      ? bookings.filter(b => b.state === "booked" || b.state === "confirmed")
      : activeTab === "sent_deposit"
        ? bookings.filter(b => b.state === "sent_deposit" || b.state === "accepted")
        : bookings.filter(b => b.state === activeTab);
  const visible = q
    ? tabFiltered.filter(b =>
        b.client_name.toLowerCase().includes(q) ||
        b.client_email.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
      )
    : tabFiltered;

  // For the Booked tab, group by appointment date
  const confirmedGroups = useMemo(() => {
    if (activeTab !== "booked") return null;
    const sorted = [...visible].sort((a, b) => {
      if (!a.appointment_date && !b.appointment_date) return 0;
      if (!a.appointment_date) return 1;
      if (!b.appointment_date) return -1;
      return a.appointment_date.localeCompare(b.appointment_date);
    });
    const groups: { dateLabel: string; bookings: Booking[] }[] = [];
    for (const booking of sorted) {
      const label = booking.appointment_date
        ? new Date(booking.appointment_date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
        : "No date set";
      const last = groups[groups.length - 1];
      if (last && last.dateLabel === label) {
        last.bookings.push(booking);
      } else {
        groups.push({ dateLabel: label, bookings: [booking] });
      }
    }
    return groups;
  }, [activeTab, visible]);

  const counts = Object.fromEntries(
    STATE_TABS.map(t => [
      t.value,
      t.value === "all"
        ? bookings.length
        : t.value === "booked"
          ? bookings.filter(b => b.state === "booked" || b.state === "confirmed").length
          : t.value === "sent_deposit"
            ? bookings.filter(b => b.state === "sent_deposit" || b.state === "accepted").length
            : bookings.filter(b => b.state === t.value).length,
    ])
  );

  const moveTo = async (id: string, targetState: BookingState) => {
    if (targetState === "follow_up") {
      setOpenDropdown(null);
      await openFollowUpCompose(id);
      return;
    }
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", target_state: targetState }),
    });
    if (!res.ok) return;
    setBookings(prev => prev.map(b => b.id === id ? { ...b, state: targetState } : b));
    setOpenDropdown(null);
  };

  // Mirror the dashboard's handleAdvanceState — each "next action" pops the
  // appropriate modal instead of silently advancing the booking. Keeps the
  // bookings view's button behavior consistent with the pipeline cards.
  const advance = async (id: string, currentState: BookingState) => {
    if (currentState === "sent_deposit") { setSendCalendarModal({ bookingId: id }); return; }
    if (currentState === "sent_calendar") { setConfirmModal({ bookingId: id }); return; }
    if (currentState === "booked" || currentState === "confirmed") {
      setCompletionData({ total_amount: "", tip_amount: "", notes: "" });
      setCompletionModal({ bookingId: id, images: [] });
      return;
    }

    // Fallback: if any state slips through, fall back to the legacy
    // server-side advance path so nothing is silently broken.
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    if (!res.ok) return;
    const { newState } = await res.json();
    setBookings(prev => prev.map(b => b.id === id ? { ...b, state: newState } : b));
  };

  const handleCalendarSent = (bookingId: string) => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? { ...b, state: "sent_calendar" as BookingState, last_email_sent_at: new Date().toISOString() }
        : b,
    ));
    setSendCalendarModal(null);
  };

  const handleAcceptSent = (bookingId: string, targetState: BookingState = "sent_deposit") => {
    const nowIso = new Date().toISOString();
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? {
            ...b,
            state: targetState,
            last_email_sent_at: nowIso,
            sent_emails: [...(b.sent_emails ?? []), { label: "Save your spot — deposit to book", sent_at: nowIso }],
          }
        : b
    ));
    setAcceptModal(null);
  };

  const handleAppointmentConfirmed = (bookingId: string, appointmentDate: string, googleEventId?: string) => {
    const isReschedule = !!confirmModal?.initialAppointmentDate;
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? {
            ...b,
            ...(isReschedule ? {} : { state: "booked" as BookingState }),
            appointment_date: appointmentDate,
            ...(googleEventId ? { google_event_id: googleEventId } : {}),
          }
        : b
    ));
    setConfirmModal(null);
  };

  const handleComplete = async () => {
    if (!completionModal) return;
    const { bookingId, images } = completionModal;
    const booking = bookings.find(b => b.id === bookingId);
    const sessionCount = booking?.session_count ?? 1;
    const done = booking?.completed_session_count ?? 0;
    const isMultiIntermediate = sessionCount > 1 && done < sessionCount - 1;
    const totalAmount = completionData.total_amount ? parseFloat(completionData.total_amount) : null;
    const tipAmount = completionData.tip_amount ? parseFloat(completionData.tip_amount) : null;
    const notes = completionData.notes || null;

    if (isMultiIntermediate) {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_session",
          total_amount: totalAmount,
          tip_amount: tipAmount,
          notes,
        }),
      });
      if (!res.ok) return;
      setBookings(prev => prev.map(b => {
        if (b.id !== bookingId) return b;
        const idx = b.completed_session_count ?? 0;
        const apps = [...(b.session_appointments ?? [])];
        while (apps.length <= idx) apps.push({});
        apps[idx] = {
          ...apps[idx],
          completed_at: new Date().toISOString(),
          ...(totalAmount != null ? { total_amount: totalAmount } : {}),
          ...(tipAmount != null ? { tip_amount: tipAmount } : {}),
          ...(notes ? { notes } : {}),
        };
        return { ...b, session_appointments: apps, completed_session_count: idx + 1 };
      }));
      completionDraft.clear();
      setCompletionModal(null);
      return;
    }

    setCompletionUploading(true);
    let uploadedUrls: string[] = [];
    for (const img of images.slice(0, 2)) {
      const fd = new FormData();
      fd.append("file", img);
      const r = await fetch(`/api/bookings/${bookingId}/upload-completion-image`, { method: "POST", body: fd });
      if (r.ok) {
        const d = await r.json();
        uploadedUrls = d.urls ?? uploadedUrls;
      }
    }
    setCompletionUploading(false);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        total_amount: totalAmount,
        tip_amount: tipAmount,
        completion_notes: notes,
      }),
    });
    if (!res.ok) return;
    setBookings(prev => prev.map(b => b.id === bookingId ? {
      ...b,
      state: "completed",
      total_amount: totalAmount ?? undefined,
      tip_amount: tipAmount ?? undefined,
      completion_notes: notes ?? undefined,
      completion_image_urls: uploadedUrls.length > 0 ? uploadedUrls : b.completion_image_urls,
    } : b));
    completionDraft.clear();
    setCompletionModal(null);
  };

  const openEmailCompose = async (id: string, defaultState?: string, blank?: boolean) => {
    setEmailLoadingId(id);
    try {
      const res = await fetch(`/api/bookings/${id}/send-email`);
      if (!res.ok) return;
      const data = await res.json();

      let subject = blank ? "" : data.subject;
      let body = blank ? "" : data.body;
      if (!blank && defaultState && data.templates) {
        const t = data.templates.find((t: ResolvedTemplate) => t.state === defaultState);
        if (t) { subject = t.subject; body = t.body; }
      }

      setEmailCompose({
        bookingId: id,
        subject,
        body,
        templates: data.templates ?? [],
        defaultTemplateState: blank ? null : (defaultState ?? data.defaultTemplateState),
        paymentLinks: data.paymentLinks ?? [],
        calendarLinks: data.calendarLinks ?? [],
        schedulingLinks: data.schedulingLinks ?? [],
        previewVars: data.previewVars,
      });
    } finally {
      setEmailLoadingId(null);
    }
  };

  const openRejectCompose = async (id: string) => {
    await openEmailCompose(id, "rejected");
    setEmailCompose(prev => prev ? { ...prev, afterSendState: "rejected" } : null);
  };

  const openFollowUpCompose = async (id: string) => {
    await openEmailCompose(id, "follow_up");
    setEmailCompose(prev => prev ? { ...prev, afterSendState: "follow_up" } : null);
  };

  const sendEmail = async (subject: string, body: string) => {
    if (!emailCompose) return;
    const { bookingId, afterSendState } = emailCompose;
    const res = await fetch(`/api/bookings/${bookingId}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const nowIso = new Date().toISOString();
    const newEntry = { label: data.sentEmailLabel ?? subject.slice(0, 60), sent_at: nowIso };
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? {
            ...b,
            last_email_sent_at: nowIso,
            sent_emails: [...(b.sent_emails ?? []), newEntry],
          }
        : b
    ));
    setEmailCompose(null);

    if (afterSendState) {
      await moveTo(bookingId, afterSendState);
    }
  };

  const renderRow = (booking: Booking) => {
    const expanded = expandedId === booking.id;
    const nextAction = STATE_FLOW[booking.state];
    const isInquiry = booking.state === "inquiry";
    const customEntries = Object.entries(booking.custom_answers ?? {}).filter(([, v]) => {
      if (Array.isArray(v)) return v.length > 0;
      return v !== null && String(v).trim() !== "";
    });
    const appointmentToday = booking.appointment_date && isToday(booking.appointment_date) &&
      (booking.state === "confirmed" || booking.state === "completed");

    return (
      <Fragment key={booking.id}>
        <tr
          ref={setRowRef(booking.id)}
          className={`border-b border-outline-variant/10 hover:bg-surface-container-low/40 transition-colors cursor-pointer ${expanded ? "bg-surface-container-low/60" : ""}`}
          onClick={() => setExpandedId(expanded ? null : booking.id)}
        >
          <td className="pl-3 pr-1 sm:px-6 py-4">
            <ChevronRight className={`w-4 h-4 text-on-surface-variant transition-transform ${expanded ? "rotate-90" : ""}`} />
          </td>
          <td className="px-2 sm:px-4 py-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-on-surface">{booking.client_name}</p>
              {(booking.session_count ?? 1) > 1 && (
                <span className="text-xs font-medium text-tertiary bg-tertiary/10 border border-tertiary/20 px-1.5 py-0.5 rounded-md shrink-0">
                  {(booking.session_count ?? 1)} sessions
                  {typeof booking.completed_session_count === "number" && booking.completed_session_count > 0
                    ? ` · ${booking.completed_session_count}/${booking.session_count} done`
                    : ""}
                </span>
              )}
              {booking.deposit_paid && (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md shrink-0">Deposit paid</span>
              )}
              {appointmentToday && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md shrink-0">Today</span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant mt-0.5">{booking.client_email}</p>
          </td>
          <td className="px-4 py-4 hidden md:table-cell max-w-xs">
            <p className="text-sm text-on-surface-variant line-clamp-2">{booking.description}</p>
          </td>
          <td className="px-4 py-4 hidden lg:table-cell">
            {booking.appointment_date ? (
              <p className="text-sm font-medium text-on-surface whitespace-nowrap">
                {fmtDateTime(booking.appointment_date)}
              </p>
            ) : (
              <p className="text-sm text-on-surface-variant whitespace-nowrap">
                Submitted {timeAgo(booking.created_at)}
              </p>
            )}
            {booking.last_email_sent_at && (
              <p className="text-sm text-on-surface-variant/60 mt-0.5 whitespace-nowrap">
                Emailed {timeAgo(booking.last_email_sent_at)}
              </p>
            )}
          </td>
          <td className="px-2 sm:px-4 py-4">
            <StateBadge state={booking.state} />
          </td>
          <td className="px-2 sm:px-6 py-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
              {/* Deposit link — shown for accepted/confirmed when a payment provider is connected. Hidden on mobile; reachable from the expanded row. */}
              {paymentsConnected && (booking.state === "sent_deposit" || booking.state === "accepted" || booking.state === "confirmed") && !booking.deposit_paid && (
                (booking.deposit_link_url || booking.stripe_payment_link_url) ? (
                  <button
                    type="button"
                    title="Copy deposit link"
                    onClick={() => {
                      const url = booking.deposit_link_url ?? booking.stripe_payment_link_url ?? "";
                      navigator.clipboard.writeText(url).then(() => {
                        setCopiedLink(booking.id);
                        setTimeout(() => setCopiedLink(null), 2000);
                      });
                    }}
                    className="hidden sm:flex p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                  >
                    {copiedLink === booking.id ? <Check className="w-4 h-4 text-emerald-500" /> : <DollarSign className="w-4 h-4" />}
                  </button>
                ) : (
                  <button
                    type="button"
                    title="Generate deposit link"
                    onClick={() => setDepositModal({ bookingId: booking.id, amount: booking.budget ? String(booking.budget) : "" })}
                    className="hidden sm:flex p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                  >
                    <DollarSign className="w-4 h-4" />
                  </button>
                )
              )}
              {isInquiry ? (
                <>
                  <button type="button" title="Reject" onClick={() => openRejectCompose(booking.id)} className="text-sm font-medium p-2 sm:px-3 sm:py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/5 transition-colors whitespace-nowrap">
                    <X className="w-4 h-4 sm:hidden" />
                    <span className="hidden sm:inline">Reject</span>
                  </button>
                  <button type="button" title="Follow up" onClick={() => openFollowUpCompose(booking.id)} className="text-sm font-medium p-2 sm:px-3 sm:py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high transition-colors whitespace-nowrap">
                    <MessageSquare className="w-4 h-4 sm:hidden" />
                    <span className="hidden sm:inline">Follow Up</span>
                  </button>
                  <button type="button" title="Accept" onClick={() => setAcceptModal({ bookingId: booking.id })} className="text-sm font-medium p-2 sm:px-3 sm:py-2 rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity whitespace-nowrap">
                    <Check className="w-4 h-4 sm:hidden" />
                    <span className="hidden sm:inline">Accept</span>
                  </button>
                </>
              ) : (
                nextAction && (
                  <button type="button" onClick={() => advance(booking.id, booking.state)} className="text-sm font-medium px-2.5 sm:px-3 py-2 rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity whitespace-nowrap">
                    {nextAction.label}
                  </button>
                )
              )}
              <div className="relative" ref={openDropdown === booking.id ? dropdownRef : undefined}>
                <button type="button" onClick={() => setOpenDropdown(openDropdown === booking.id ? null : booking.id)} className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Move to status">
                  <ChevronDown className="w-4 h-4" />
                </button>
                {openDropdown === booking.id && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-outline-variant/30 rounded-xl shadow-lg py-1 min-w-[180px]">
                    {MOVE_STATES.filter(s => s.value !== booking.state).map(s => (
                      <button key={s.value} type="button" className="w-full text-left px-4 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" onClick={() => {
                        // Guardrail: "booked" requires a date — open the picker
                        // first so the API doesn't reject the move.
                        if ((s.value === "booked" || s.value === "confirmed") && !booking.appointment_date) {
                          setOpenDropdown(null);
                          setConfirmModal({ bookingId: booking.id });
                          return;
                        }
                        moveTo(booking.id, s.value);
                      }}>
                        Move to {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => openEmailCompose(booking.id, undefined, true)} title="Send email" disabled={emailLoadingId === booking.id} className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors disabled:opacity-40">
                <Mail className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
        {expanded && (
          <tr key={`${booking.id}-detail`} className="border-b border-outline-variant/15 bg-surface-container-low/30">
            <td colSpan={6} className="px-3 sm:px-6 pb-5 pt-3">
              <div className="border border-outline-variant/25 rounded-xl bg-surface shadow-sm overflow-hidden text-sm">

                {/* Contact header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-low/50 border-b border-outline-variant/10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base font-medium text-on-surface">{booking.client_name}</span>
                      <span className="text-on-surface-variant/60">·</span>
                      <span className="text-sm text-on-surface-variant">{booking.client_email}</span>
                      <InlineCopyButton value={booking.client_email} />
                      {booking.client_phone && (
                        <>
                          <span className="text-on-surface-variant/60">·</span>
                          <span className="text-sm text-on-surface-variant">{formatPhone(booking.client_phone)}</span>
                          <InlineCopyButton value={booking.client_phone} />
                        </>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">Submitted {fmtDate(booking.created_at)} ({timeAgo(booking.created_at)})</p>
                  </div>
                  {/* Inline appointment edit */}
                  {(booking.state === "booked" || booking.state === "confirmed") && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setConfirmModal({ bookingId: booking.id, initialAppointmentDate: booking.appointment_date ?? undefined }); }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      {booking.appointment_date ? "Reschedule" : "Set date"}
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-4">

                  {/* Per-session breakdown for multi-session bookings */}
                  {(booking.session_count ?? 1) > 1 && (
                    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                          {(booking.session_count ?? 1)}-session booking
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {booking.completed_session_count ?? 0}/{booking.session_count} done
                        </p>
                      </div>
                      <div className="space-y-2">
                        {Array.from({ length: booking.session_count ?? 1 }).map((_, idx) => {
                          const s = (booking.session_appointments ?? [])[idx];
                          const done = !!s?.completed_at;
                          const hasDetails = done && (s?.total_amount != null || s?.tip_amount != null || s?.notes || s?.payment_source);
                          return (
                            <div key={idx} className="rounded-md bg-surface px-2.5 py-2 border border-outline-variant/10">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`font-medium ${done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>Session {idx + 1}</span>
                                  <span className="text-on-surface-variant truncate">
                                    {s?.appointment_date
                                      ? new Date(s.appointment_date).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                                      : "Not booked yet"}
                                  </span>
                                </div>
                                {done && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </div>
                              {hasDetails && (
                                <div className="mt-1.5 pt-1.5 border-t border-outline-variant/10 space-y-0.5 text-xs text-on-surface-variant">
                                  {(s?.total_amount != null || s?.tip_amount != null) && (
                                    <p>
                                      {s?.total_amount != null && <>Total: <span className="text-on-surface font-medium">${s.total_amount}</span></>}
                                      {s?.tip_amount != null && <> · Tip: <span className="text-on-surface font-medium">${s.tip_amount}</span></>}
                                      {s?.payment_source && <> · {s.payment_source}</>}
                                    </p>
                                  )}
                                  {s?.notes && <p className="text-on-surface whitespace-pre-wrap">{s.notes}</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {booking.description && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-1">Description</p>
                      <p className="text-on-surface leading-relaxed">{booking.description}</p>
                    </div>
                  )}

                  {/* Key tattoo details */}
                  {(booking.size || booking.placement || typeof booking.budget === "number" || booking.appointment_date || typeof booking.total_amount === "number" || booking.deposit_paid) && (
                    <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-outline-variant/10 pt-4">
                      {booking.size && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-0.5">{fieldLabelMap.size ?? "Size"}</p>
                          <p className="text-on-surface font-medium">{booking.size}</p>
                        </div>
                      )}
                      {booking.placement && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-0.5">{fieldLabelMap.placement ?? "Placement"}</p>
                          <p className="text-on-surface font-medium">{booking.placement}</p>
                        </div>
                      )}
                      {typeof booking.budget === "number" && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-0.5">{fieldLabelMap.budget ?? "Budget"}</p>
                          <p className="text-on-surface font-medium">${booking.budget}</p>
                        </div>
                      )}
                      {booking.appointment_date && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-0.5">Appointment</p>
                          <p className="text-on-surface font-medium">{fmtDateTime(booking.appointment_date)}</p>
                        </div>
                      )}
                      {typeof booking.total_amount === "number" && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-0.5">Total paid</p>
                          <p className="text-on-surface font-medium">
                            ${booking.total_amount}
                            {typeof booking.tip_amount === "number" && <span className="text-on-surface-variant font-normal"> + ${booking.tip_amount} tip</span>}
                          </p>
                        </div>
                      )}
                      {booking.deposit_paid && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-0.5">Deposit</p>
                          <p className="text-emerald-600 font-medium">Paid ✓</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom answers */}
                  {customEntries.length > 0 && (
                    <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-outline-variant/10 pt-4">
                      {customEntries.map(([key, value]) => (
                        <div key={key}>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-0.5">{fieldLabelMap[key] ?? key}</p>
                          {Array.isArray(value)
                            ? <div className="space-y-0.5">{value.map(v => <p key={String(v)} className="text-on-surface">{String(v)}</p>)}</div>
                            : <p className="text-on-surface">{typeof value === "boolean" ? (value ? "Yes" : "No") : looksLikeUrl(String(value)) ? <a href={String(value)} target="_blank" rel="noreferrer" className="text-primary underline">{String(value)}</a> : String(value)}</p>
                          }
                        </div>
                      ))}
                    </div>
                  )}

                  {/* References */}
                  {(booking.reference_urls ?? []).length > 0 && (
                    <div className="border-t border-outline-variant/10 pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-2">{fieldLabelMap.reference_images ?? "References"}</p>
                      <div className="space-y-1">{(booking.reference_urls ?? []).map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="block text-primary underline break-all">{url}</a>)}</div>
                    </div>
                  )}

                  {/* Completion notes */}
                  {booking.completion_notes && (
                    <div className="border-t border-outline-variant/10 pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-1">Session notes</p>
                      <p className="text-on-surface">{booking.completion_notes}</p>
                    </div>
                  )}

                  {/* Final photos */}
                  {(booking.completion_image_urls ?? []).length > 0 && (
                    <div className="border-t border-outline-variant/10 pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-2">Final photos</p>
                      <div className="flex gap-3">
                        {(booking.completion_image_urls ?? []).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt={`Final photo ${i + 1}`} className="w-28 h-28 object-cover rounded-lg border border-outline-variant/20 hover:opacity-80 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email history */}
                  {(booking.sent_emails ?? []).length > 0 ? (
                    <div className="border-t border-outline-variant/10 pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-2">Emails sent</p>
                      <div className="space-y-1.5">
                        {(booking.sent_emails ?? []).map((email, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-on-surface truncate">{resolveEmailLabel(email.label, booking, artistName)}</span>
                            <span className="text-xs text-on-surface-variant shrink-0">{fmtDate(email.sent_at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : booking.last_email_sent_at ? (
                    <div className="border-t border-outline-variant/10 pt-4 text-xs text-on-surface-variant">
                      Last emailed {fmtDate(booking.last_email_sent_at)}
                    </div>
                  ) : null}

                </div>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* State filter tabs */}
      <div className="flex items-center gap-1.5 px-3 sm:px-6 pt-4 pb-0 border-b border-outline-variant/10 overflow-x-auto shrink-0">
        {STATE_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`shrink-0 flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
            {counts[tab.value] > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === tab.value ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant"
              }`}>
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="px-3 sm:px-6 py-3 border-b border-outline-variant/10 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm text-on-surface bg-surface-container-low border border-outline-variant/20 rounded-lg focus:outline-none focus:border-primary placeholder:text-on-surface-variant/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-on-surface-variant">{q ? "No results found." : "No bookings in this state."}</p>
          </div>
        ) : confirmedGroups ? (
          // Confirmed tab — date-grouped
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                <th className="text-left pl-3 pr-1 sm:px-6 py-4 text-sm font-medium text-on-surface-variant w-8" />
                <th className="text-left px-2 sm:px-4 py-4 text-sm font-medium text-on-surface-variant">Client</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden lg:table-cell">Appointment</th>
                <th className="text-left px-2 sm:px-4 py-4 text-sm font-medium text-on-surface-variant">Status</th>
                <th className="text-right px-2 sm:px-6 py-4 text-sm font-medium text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody>
              {confirmedGroups.map(group => (
                <Fragment key={group.dateLabel}>
                  <tr className="bg-surface-container-low/60 border-b border-outline-variant/10">
                    <td colSpan={6} className="px-3 sm:px-6 py-2">
                      <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">{group.dateLabel}</span>
                    </td>
                  </tr>
                  {group.bookings.map(booking => renderRow(booking))}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                <th className="text-left pl-3 pr-1 sm:px-6 py-4 text-sm font-medium text-on-surface-variant w-8" />
                <th className="text-left px-2 sm:px-4 py-4 text-sm font-medium text-on-surface-variant">Client</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden lg:table-cell">Date</th>
                <th className="text-left px-2 sm:px-4 py-4 text-sm font-medium text-on-surface-variant">Status</th>
                <th className="text-right px-2 sm:px-6 py-4 text-sm font-medium text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody>{visible.map(renderRow)}</tbody>
          </table>
        )}
      </div>

      {/* Completion modal */}
      {completionModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-surface border border-outline-variant/20 rounded-t-2xl sm:rounded-2xl shadow-xl p-6 w-full max-w-sm mx-0 sm:mx-4">
            <h2 className="text-base font-semibold text-on-surface mb-1">Complete booking</h2>
            <p className="text-sm text-on-surface-variant mb-5">Optionally record the final details for this appointment.</p>
            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Total amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 350"
                  value={completionData.total_amount}
                  onChange={e => setCompletionData(d => ({ ...d, total_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Tip ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 50"
                  value={completionData.tip_amount}
                  onChange={e => setCompletionData(d => ({ ...d, tip_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Notes</label>
                <textarea
                  placeholder="Any notes about this client or session…"
                  rows={2}
                  value={completionData.notes}
                  onChange={e => setCompletionData(d => ({ ...d, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Final photos (up to 2)
                </label>
                {completionModal.images.length > 0 ? (
                  <div className="flex gap-2 mb-2">
                    {completionModal.images.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={URL.createObjectURL(img)} alt="" className="w-20 h-20 object-cover rounded-lg border border-outline-variant/20" />
                        <button
                          type="button"
                          onClick={() => setCompletionModal(m => m ? { ...m, images: m.images.filter((_, j) => j !== i) } : m)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-on-surface text-surface text-xs flex items-center justify-center hover:opacity-80"
                        >×</button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {completionModal.images.length < 2 && (
                  <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-outline-variant/40 rounded-lg cursor-pointer hover:bg-surface-container-low transition-colors">
                    <span className="text-sm text-on-surface-variant">
                      {completionModal.images.length === 0 ? "Add photos…" : "Add another…"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setCompletionModal(m => m ? { ...m, images: [...m.images, file].slice(0, 2) } : m);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={async () => { await moveTo(completionModal.bookingId, "completed"); completionDraft.clear(); setCompletionModal(null); }}
                className="text-sm text-on-surface-variant hover:text-on-surface-variant transition-colors underline underline-offset-2"
              >
                skip
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCompletionModal(null)}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={completionUploading}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {completionUploading ? "Uploading…" : "Mark Complete"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {acceptModal && (
        <AcceptModal
          bookingId={acceptModal.bookingId}
          clientName={bookings.find(b => b.id === acceptModal.bookingId)?.client_name}
          paymentsConnected={paymentsConnected}
          paymentProvider={paymentProvider}
          schedulingLinks={schedulingLinks}
          artistId={artistId}
          isCalendarConnected={calendarSyncEnabled}
          onSent={(_threadId, targetState) => handleAcceptSent(acceptModal.bookingId, targetState)}
          onClose={() => setAcceptModal(null)}
        />
      )}

      {confirmModal && (
        <ConfirmAppointmentModal
          bookingId={confirmModal.bookingId}
          calendarSyncEnabled={calendarSyncEnabled}
          initialAppointmentDate={confirmModal.initialAppointmentDate}
          existingAppointments={bookings
            .filter(b => b.state === "confirmed" && b.appointment_date && b.id !== confirmModal.bookingId)
            .map(b => ({ appointment_date: b.appointment_date!, client_name: b.client_name }))}
          onConfirmed={(date, eventId) => handleAppointmentConfirmed(confirmModal.bookingId, date, eventId)}
          onSkip={confirmModal.initialAppointmentDate ? undefined : async () => {
            await moveTo(confirmModal.bookingId, "booked");
            setConfirmModal(null);
          }}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {sendCalendarModal && (
        <SendCalendarModal
          bookingId={sendCalendarModal.bookingId}
          clientName={bookings.find(b => b.id === sendCalendarModal.bookingId)?.client_name ?? ""}
          schedulingLinks={schedulingLinks}
          artistId={artistId}
          onSent={() => handleCalendarSent(sendCalendarModal.bookingId)}
          onClose={() => setSendCalendarModal(null)}
        />
      )}

      {emailCompose && (
        <EmailComposeModal
          templates={emailCompose.templates}
          initialSubject={emailCompose.subject}
          initialBody={emailCompose.body}
          defaultTemplateState={emailCompose.defaultTemplateState}
          paymentLinks={emailCompose.paymentLinks}
          calendarLinks={emailCompose.calendarLinks}
          schedulingLinks={emailCompose.schedulingLinks}
          previewVars={emailCompose.previewVars}
          draftKey={`fb:email-draft:${emailCompose.bookingId}:${emailCompose.afterSendState ?? "manual"}`}
          onSend={sendEmail}
          onSkip={emailCompose.afterSendState ? async () => {
            const { bookingId, afterSendState } = emailCompose;
            setEmailCompose(null);
            if (afterSendState) await moveTo(bookingId, afterSendState);
          } : undefined}
          onClose={() => setEmailCompose(null)}
        />
      )}

      {/* Deposit link modal */}
      {depositModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-xl p-6 w-80 space-y-4">
            <div>
              <p className="text-base font-medium text-on-surface">Generate deposit link</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Creates a {providerLabel} payment link for {bookings.find(b => b.id === depositModal.bookingId)?.client_name}.
              </p>
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
                  value={depositModal.amount}
                  onChange={e => setDepositModal(m => m ? { ...m, amount: e.target.value } : m)}
                  onKeyDown={e => e.key === "Enter" && generateDepositLink()}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50"
                />
              </div>
              {depositError && <p className="text-xs text-destructive">{depositError}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDepositModal(null)} className="flex-1 h-9 text-sm rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
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
