"use client";

import { useState, Fragment, useMemo } from "react";
import { createPortal } from "react-dom";
import type { Booking, BookingState } from "@/lib/types";
import { Search } from "lucide-react";
import { StateBadge } from "./StateBadge";
import { Mail, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { gmailThreadUrl } from "@/lib/gmail";
import { EmailComposeModal, type ResolvedTemplate, type InsertLink } from "./EmailComposeModal";

const STATE_TABS: { value: string; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "inquiry",   label: "Submissions" },
  { value: "follow_up", label: "Follow Ups" },
  { value: "accepted",  label: "Accepted" },
  { value: "confirmed", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "rejected",  label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const MOVE_STATES: { value: BookingState; label: string }[] = [
  { value: "inquiry",   label: "Submission" },
  { value: "follow_up", label: "Follow Ups" },
  { value: "accepted",  label: "Accepted" },
  { value: "confirmed", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "rejected",  label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const STATE_FLOW: Record<BookingState, { label: string } | null> = {
  inquiry:   { label: "Accept" },
  follow_up: { label: "Accept" },
  accepted:  { label: "Confirm Appointment" },
  confirmed: { label: "Complete" },
  completed: null,
  rejected:  null,
  cancelled: null,
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
  previewVars?: Record<string, string>;
};

type CompletionModal = { bookingId: string };

export function BookingsTable({
  bookings: initialBookings,
  fieldLabelMap,
  initialState,
}: {
  bookings: Booking[];
  fieldLabelMap: Record<string, string>;
  initialState: string;
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [activeTab, setActiveTab] = useState(initialState);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [emailCompose, setEmailCompose] = useState<EmailCompose | null>(null);
  const [emailLoadingId, setEmailLoadingId] = useState<string | null>(null);
  const [completionModal, setCompletionModal] = useState<CompletionModal | null>(null);
  const [completionData, setCompletionData] = useState({ total_amount: "", tip_amount: "", notes: "" });

  const q = search.trim().toLowerCase();
  const tabFiltered = activeTab === "all" ? bookings : bookings.filter(b => b.state === activeTab);
  const visible = q
    ? tabFiltered.filter(b =>
        b.client_name.toLowerCase().includes(q) ||
        b.client_email.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
      )
    : tabFiltered;

  // For the Confirmed tab, group by appointment date
  const confirmedGroups = useMemo(() => {
    if (activeTab !== "confirmed") return null;
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
    STATE_TABS.map(t => [t.value, t.value === "all" ? bookings.length : bookings.filter(b => b.state === t.value).length])
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

  const advance = async (id: string, currentState: BookingState) => {
    if (currentState === "confirmed") {
      setCompletionData({ total_amount: "", tip_amount: "", notes: "" });
      setCompletionModal({ bookingId: id });
      return;
    }
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    if (!res.ok) return;
    const { newState } = await res.json();
    setBookings(prev => prev.map(b => b.id === id ? { ...b, state: newState } : b));

    if (newState === "paid_calendar_link_sent") {
      await openEmailCompose(id, "paid_calendar_link_sent");
    }
  };

  const handleComplete = async () => {
    if (!completionModal) return;
    const { bookingId } = completionModal;
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        total_amount: completionData.total_amount ? parseFloat(completionData.total_amount) : null,
        tip_amount: completionData.tip_amount ? parseFloat(completionData.tip_amount) : null,
        completion_notes: completionData.notes || null,
      }),
    });
    if (!res.ok) return;
    setBookings(prev => prev.map(b => b.id === bookingId ? {
      ...b,
      state: "completed",
      total_amount: completionData.total_amount ? parseFloat(completionData.total_amount) : undefined,
      tip_amount: completionData.tip_amount ? parseFloat(completionData.tip_amount) : undefined,
      completion_notes: completionData.notes || undefined,
    } : b));
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
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? { ...b, last_email_sent_at: new Date().toISOString(), ...(data.threadId ? { gmail_thread_id: data.threadId } : {}) }
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

    return (
      <Fragment key={booking.id}>
        <tr
          className={`border-b border-outline-variant/10 hover:bg-surface-container-low/40 transition-colors cursor-pointer ${expanded ? "bg-surface-container-low/40" : ""}`}
          onClick={() => setExpandedId(expanded ? null : booking.id)}
        >
          <td className="px-6 py-4">
            <ChevronRight className={`w-4 h-4 text-on-surface-variant transition-transform ${expanded ? "rotate-90" : ""}`} />
          </td>
          <td className="px-4 py-4">
            <p className="text-sm font-medium text-on-surface">{booking.client_name}</p>
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
          <td className="px-4 py-4">
            <StateBadge state={booking.state} />
          </td>
          <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-2">
              {isInquiry ? (
                <>
                  <button type="button" onClick={() => openRejectCompose(booking.id)} className="text-sm font-medium px-3 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/5 transition-colors whitespace-nowrap">Reject</button>
                  <button type="button" onClick={() => openFollowUpCompose(booking.id)} className="text-sm font-medium px-3 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high transition-colors whitespace-nowrap">Follow Up</button>
                  <button type="button" onClick={() => moveTo(booking.id, "accepted")} className="text-sm font-medium px-3 py-2 rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity whitespace-nowrap">Accept</button>
                </>
              ) : (
                nextAction && (
                  <button type="button" onClick={() => advance(booking.id, booking.state)} className="text-sm font-medium px-3 py-2 rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity whitespace-nowrap">
                    {nextAction.label}
                  </button>
                )
              )}
              <div className="relative">
                <button type="button" onClick={() => setOpenDropdown(openDropdown === booking.id ? null : booking.id)} className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Move to status">
                  <ChevronDown className="w-4 h-4" />
                </button>
                {openDropdown === booking.id && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-outline-variant/30 rounded-xl shadow-lg py-1 min-w-[180px]">
                    {MOVE_STATES.filter(s => s.value !== booking.state).map(s => (
                      <button key={s.value} type="button" className="w-full text-left px-4 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" onClick={() => moveTo(booking.id, s.value)}>
                        Move to {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {booking.state !== "completed" && booking.state !== "cancelled" && booking.state !== "rejected" && (
                <button type="button" onClick={() => openEmailCompose(booking.id, undefined, true)} title="Send email" disabled={emailLoadingId === booking.id} className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors disabled:opacity-40">
                  <Mail className="w-4 h-4" />
                </button>
              )}
              {booking.gmail_thread_id && (
                <a href={gmailThreadUrl(booking.gmail_thread_id)} target="_blank" rel="noreferrer" title="View in Gmail" className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </td>
        </tr>
        {expanded && (
          <tr key={`${booking.id}-detail`} className="border-b border-outline-variant/10 bg-surface-container-low/20">
            <td />
            <td colSpan={5} className="px-4 pb-5 pt-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
                {booking.client_phone && <div><p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.phone ?? "Phone"}</p><p className="text-on-surface">{booking.client_phone}</p></div>}
                {booking.size && <div><p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.size ?? "Size"}</p><p className="text-on-surface">{booking.size}</p></div>}
                {booking.placement && <div><p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.placement ?? "Placement"}</p><p className="text-on-surface">{booking.placement}</p></div>}
                {typeof booking.budget === "number" && <div><p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.budget ?? "Budget"}</p><p className="text-on-surface">${booking.budget}</p></div>}
                {(booking.reference_urls ?? []).length > 0 && (
                  <div className="col-span-2">
                    <p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.reference_images ?? "References"}</p>
                    <div className="space-y-0.5">{(booking.reference_urls ?? []).map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="block text-primary underline break-all">{url}</a>)}</div>
                  </div>
                )}
                {customEntries.map(([key, value]) => (
                  <div key={key}>
                    <p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap[key] ?? key}</p>
                    {Array.isArray(value)
                      ? value.map(v => <p key={v} className="text-on-surface">{String(v)}</p>)
                      : <p className="text-on-surface">{typeof value === "boolean" ? (value ? "Yes" : "No") : looksLikeUrl(String(value)) ? <a href={String(value)} target="_blank" rel="noreferrer" className="text-primary underline">{String(value)}</a> : String(value)}</p>
                    }
                  </div>
                ))}
                {booking.appointment_date && <div><p className="font-medium text-on-surface-variant mb-0.5">Appointment</p><p className="text-on-surface">{fmtDate(booking.appointment_date)}</p></div>}
                {typeof booking.total_amount === "number" && (
                  <div><p className="font-medium text-on-surface-variant mb-0.5">Total</p><p className="text-on-surface">${booking.total_amount}{typeof booking.tip_amount === "number" ? ` + $${booking.tip_amount} tip` : ""}</p></div>
                )}
                {booking.completion_notes && <div className="col-span-full"><p className="font-medium text-on-surface-variant mb-0.5">Notes</p><p className="text-on-surface">{booking.completion_notes}</p></div>}
                {booking.last_email_sent_at && <div><p className="font-medium text-on-surface-variant mb-0.5">Last Email</p><p className="text-on-surface">{fmtDate(booking.last_email_sent_at)} <span className="text-on-surface-variant/60">({timeAgo(booking.last_email_sent_at)})</span></p></div>}
                <div><p className="font-medium text-on-surface-variant mb-0.5">Submitted</p><p className="text-on-surface">{fmtDate(booking.created_at)} <span className="text-on-surface-variant/60">({timeAgo(booking.created_at)})</span></p></div>
                <div className="col-span-full"><p className="font-medium text-on-surface-variant mb-0.5">Description</p><p className="text-on-surface">{booking.description}</p></div>
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
      <div className="flex items-center gap-1.5 px-6 pt-4 pb-0 border-b border-outline-variant/10 overflow-x-auto shrink-0">
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
      <div className="px-6 py-3 border-b border-outline-variant/10 shrink-0">
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
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-on-surface-variant">{q ? "No results found." : "No bookings in this state."}</p>
          </div>
        ) : confirmedGroups ? (
          // Confirmed tab — date-grouped
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                <th className="text-left px-6 py-4 text-sm font-medium text-on-surface-variant w-8" />
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant">Client</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden lg:table-cell">Appointment</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant">Status</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody>
              {confirmedGroups.map(group => (
                <Fragment key={group.dateLabel}>
                  <tr className="bg-surface-container-low/60 border-b border-outline-variant/10">
                    <td colSpan={6} className="px-6 py-2">
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
                <th className="text-left px-6 py-4 text-sm font-medium text-on-surface-variant w-8" />
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant">Client</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden lg:table-cell">Date</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant">Status</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody>{visible.map(renderRow)}</tbody>
          </table>
        )}
      </div>

      {/* Completion modal */}
      {completionModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setCompletionModal(null)}>
          <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
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
                  rows={3}
                  value={completionData.notes}
                  onChange={e => setCompletionData(d => ({ ...d, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={async () => { await moveTo(completionModal.bookingId, "completed"); setCompletionModal(null); }}
                className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors underline underline-offset-2"
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
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {emailCompose && (
        <EmailComposeModal
          templates={emailCompose.templates}
          initialSubject={emailCompose.subject}
          initialBody={emailCompose.body}
          defaultTemplateState={emailCompose.defaultTemplateState}
          paymentLinks={emailCompose.paymentLinks}
          calendarLinks={emailCompose.calendarLinks}
          previewVars={emailCompose.previewVars}
          onSend={sendEmail}
          onSkip={emailCompose.afterSendState ? async () => {
            const { bookingId, afterSendState } = emailCompose;
            setEmailCompose(null);
            if (afterSendState) await moveTo(bookingId, afterSendState);
          } : undefined}
          onClose={() => setEmailCompose(null)}
        />
      )}
    </div>
  );
}
