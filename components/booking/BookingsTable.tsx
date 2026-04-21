"use client";

import { useState, Fragment } from "react";
import type { Booking, BookingState } from "@/lib/types";
import { StateBadge } from "./StateBadge";
import { Mail, Check, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { gmailThreadUrl } from "@/lib/gmail";
import { EmailComposeModal, type ResolvedTemplate } from "./EmailComposeModal";

const STATE_TABS: { value: string; label: string }[] = [
  { value: "all",          label: "All" },
  { value: "inquiry",      label: "New" },
  { value: "reviewed",     label: "Reviewed" },
  { value: "deposit_sent", label: "Deposit Sent" },
  { value: "deposit_paid", label: "Deposit Paid" },
  { value: "confirmed",    label: "Confirmed" },
  { value: "completed",    label: "Completed" },
  { value: "cancelled",    label: "Cancelled" },
];

const MOVE_STATES: { value: BookingState; label: string }[] = [
  { value: "inquiry",      label: "Inquiry" },
  { value: "reviewed",     label: "Reviewed" },
  { value: "deposit_sent", label: "Deposit Sent" },
  { value: "deposit_paid", label: "Deposit Paid" },
  { value: "confirmed",    label: "Confirmed" },
  { value: "completed",    label: "Completed" },
  { value: "cancelled",    label: "Cancelled" },
];

const STATE_FLOW: Record<BookingState, { label: string; action: string } | null> = {
  inquiry:      { label: "Review",       action: "advance" },
  reviewed:     { label: "Send Deposit", action: "advance" },
  deposit_sent: { label: "Mark Paid",    action: "advance" },
  deposit_paid: { label: "Confirm",      action: "advance" },
  confirmed:    { label: "Complete",     action: "advance" },
  completed:    null,
  cancelled:    null,
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

function isStale(iso: string, thresholdDays = 3): boolean {
  return Date.now() - new Date(iso).getTime() > thresholdDays * 86400000;
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

type ConfirmAction = { id: string; label: string };
type EmailCompose = { bookingId: string; subject: string; body: string; templates: ResolvedTemplate[]; defaultTemplateState?: string | null };

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<Record<string, boolean>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [emailCompose, setEmailCompose] = useState<EmailCompose | null>(null);
  const [emailLoadingId, setEmailLoadingId] = useState<string | null>(null);

  const visible = activeTab === "all"
    ? bookings
    : bookings.filter(b => b.state === activeTab);

  const counts = Object.fromEntries(
    STATE_TABS.map(t => [t.value, t.value === "all" ? bookings.length : bookings.filter(b => b.state === t.value).length])
  );

  const advance = async (id: string) => {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    if (!res.ok) return;
    const { newState } = await res.json();
    setBookings(prev => prev.map(b => b.id === id ? { ...b, state: newState } : b));
    setConfirmAction(null);
  };

  const moveTo = async (id: string, targetState: BookingState) => {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", target_state: targetState }),
    });
    if (!res.ok) return;
    setBookings(prev => prev.map(b => b.id === id ? { ...b, state: targetState } : b));
    setOpenDropdown(null);
  };

  const openEmailCompose = async (id: string) => {
    setEmailLoadingId(id);
    try {
      const res = await fetch(`/api/bookings/${id}/send-email`);
      if (!res.ok) return;
      const data = await res.json();
      setEmailCompose({ bookingId: id, subject: data.subject, body: data.body, templates: data.templates ?? [], defaultTemplateState: data.defaultTemplateState });
    } finally {
      setEmailLoadingId(null);
    }
  };

  const sendEmail = async (subject: string, body: string) => {
    if (!emailCompose) return;
    const res = await fetch(`/api/bookings/${emailCompose.bookingId}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) return;
    setEmailSent(prev => ({ ...prev, [emailCompose.bookingId]: true }));
    setTimeout(() => setEmailSent(prev => ({ ...prev, [emailCompose.bookingId]: false })), 3000);
    setEmailCompose(null);
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

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-on-surface-variant">No bookings in this state.</p>
          </div>
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
            <tbody>
              {visible.map(booking => {
                const expanded = expandedId === booking.id;
                const nextAction = STATE_FLOW[booking.state];
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
                        <p className="text-sm text-on-surface-variant whitespace-nowrap">
                          Submitted {timeAgo(booking.created_at)}
                        </p>
                        {booking.updated_at !== booking.created_at && (
                          <p className={`text-sm mt-0.5 whitespace-nowrap ${isStale(booking.updated_at) ? "text-amber-600" : "text-on-surface-variant/60"}`}>
                            Updated {timeAgo(booking.updated_at)}
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
                        <div className="flex items-center justify-end gap-3">
                          {/* Primary action */}
                          {nextAction && (
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ id: booking.id, label: nextAction.label })}
                              className="text-sm font-medium px-3 py-2 rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity whitespace-nowrap"
                            >
                              {nextAction.label}
                            </button>
                          )}

                          {/* Move to dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenDropdown(openDropdown === booking.id ? null : booking.id)}
                              className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                              title="Move to status"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {openDropdown === booking.id && (
                              <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-outline-variant/30 rounded-xl shadow-lg py-1 min-w-[160px]">
                                {MOVE_STATES.filter(s => s.value !== booking.state).map(s => (
                                  <button
                                    key={s.value}
                                    type="button"
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                                    onClick={() => moveTo(booking.id, s.value)}
                                  >
                                    Move to {s.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Send email */}
                          {booking.state !== "completed" && booking.state !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => openEmailCompose(booking.id)}
                              title="Send email"
                              disabled={emailLoadingId === booking.id}
                              className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors disabled:opacity-40"
                            >
                              {emailSent[booking.id]
                                ? <Check className="w-4 h-4 text-emerald-600" />
                                : <Mail className="w-4 h-4" />}
                            </button>
                          )}

                          {/* Gmail thread */}
                          {booking.gmail_thread_id && (
                            <a
                              href={gmailThreadUrl(booking.gmail_thread_id)}
                              target="_blank"
                              rel="noreferrer"
                              title="View in Gmail"
                              className="p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expanded && (
                      <tr key={`${booking.id}-detail`} className="border-b border-outline-variant/10 bg-surface-container-low/20">
                        <td />
                        <td colSpan={5} className="px-4 pb-5 pt-2">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
                            {booking.client_phone && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.phone ?? "Phone"}</p><p className="text-on-surface">{booking.client_phone}</p></div>
                            )}
                            {booking.size && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.size ?? "Size"}</p><p className="text-on-surface">{booking.size}</p></div>
                            )}
                            {booking.placement && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.placement ?? "Placement"}</p><p className="text-on-surface">{booking.placement}</p></div>
                            )}
                            {typeof booking.budget === "number" && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.budget ?? "Budget"}</p><p className="text-on-surface">${booking.budget}</p></div>
                            )}
                            {(booking.reference_urls ?? []).length > 0 && (
                              <div className="col-span-2">
                                <p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap.reference_images ?? "References"}</p>
                                <div className="space-y-0.5">
                                  {(booking.reference_urls ?? []).map(url => (
                                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block text-primary underline break-all">{url}</a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {customEntries.map(([key, value]) => (
                              <div key={key}>
                                <p className="font-medium text-on-surface-variant mb-0.5">{fieldLabelMap[key] ?? key}</p>
                                {Array.isArray(value)
                                  ? value.map(v => <p key={v} className="text-on-surface">{String(v)}</p>)
                                  : <p className="text-on-surface">{typeof value === "boolean" ? (value ? "Yes" : "No") : looksLikeUrl(String(value))
                                      ? <a href={String(value)} target="_blank" rel="noreferrer" className="text-primary underline">{String(value)}</a>
                                      : String(value)}</p>
                                }
                              </div>
                            ))}
                            {booking.appointment_date && (
                              <div>
                                <p className="font-medium text-on-surface-variant mb-0.5">Appointment</p>
                                <p className="text-on-surface">{fmtDate(booking.appointment_date)}</p>
                              </div>
                            )}
                            {booking.last_email_sent_at && (
                              <div>
                                <p className="font-medium text-on-surface-variant mb-0.5">Last Email</p>
                                <p className="text-on-surface">{fmtDate(booking.last_email_sent_at)} <span className="text-on-surface-variant/60">({timeAgo(booking.last_email_sent_at)})</span></p>
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-on-surface-variant mb-0.5">Submitted</p>
                              <p className="text-on-surface">{fmtDate(booking.created_at)} <span className="text-on-surface-variant/60">({timeAgo(booking.created_at)})</span></p>
                            </div>
                            <div className="col-span-full">
                              <p className="font-medium text-on-surface-variant mb-0.5">Description</p>
                              <p className="text-on-surface">{booking.description}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm action modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-on-surface mb-1">{confirmAction.label}?</h2>
            <p className="text-sm text-on-surface-variant mb-5">This will move the booking to the next stage. Continue?</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => advance(confirmAction.id)}
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
              >
                Yes, {confirmAction.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {emailCompose && (
        <EmailComposeModal
          templates={emailCompose.templates}
          initialSubject={emailCompose.subject}
          initialBody={emailCompose.body}
          defaultTemplateState={emailCompose.defaultTemplateState}
          onSend={sendEmail}
          onClose={() => setEmailCompose(null)}
        />
      )}
    </div>
  );
}
