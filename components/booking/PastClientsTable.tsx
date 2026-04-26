"use client";

import { useState } from "react";
import type { Booking } from "@/lib/types";
import { formatPhone } from "@/lib/format";
import { Search, ChevronRight } from "lucide-react";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATE_LABEL: Record<string, string> = {
  accepted:      "Deposit Pending", // legacy
  sent_deposit:  "Deposit Pending",
  sent_calendar: "Scheduling",
  booked:        "Scheduled",
  confirmed:     "Scheduled",
  completed:     "Completed",
};

const STATE_STYLE: Record<string, string> = {
  accepted:      "bg-amber-100 text-amber-700",
  sent_deposit:  "bg-amber-100 text-amber-700",
  sent_calendar: "bg-amber-100 text-amber-700",
  booked:        "bg-blue-100 text-blue-700",
  confirmed:     "bg-blue-100 text-blue-700",
  completed:     "bg-emerald-100 text-emerald-700",
};

type Tab = "all" | "sent_deposit" | "booked" | "completed";

const TABS: { id: Tab; label: string }[] = [
  { id: "all",          label: "All Clients" },
  { id: "sent_deposit", label: "Deposit Pending" },
  { id: "booked",       label: "Scheduled" },
  { id: "completed",    label: "Completed" },
];

export function PastClientsTable({ bookings }: { bookings: Booking[] }) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");

  const q = search.trim().toLowerCase();
  const byTab = tab === "all"
    ? bookings
    : tab === "sent_deposit"
      ? bookings.filter(b => b.state === "sent_deposit" || b.state === "accepted" || b.state === "sent_calendar")
      : tab === "booked"
        ? bookings.filter(b => b.state === "booked" || b.state === "confirmed")
        : bookings.filter(b => b.state === tab);
  const visible = q
    ? byTab.filter(b =>
        b.client_name.toLowerCase().includes(q) ||
        b.client_email.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
      )
    : byTab;

  const countFor = (t: Tab) => t === "all"
    ? bookings.length
    : t === "sent_deposit"
      ? bookings.filter(b => b.state === "sent_deposit" || b.state === "accepted" || b.state === "sent_calendar").length
      : t === "booked"
        ? bookings.filter(b => b.state === "booked" || b.state === "confirmed").length
        : bookings.filter(b => b.state === t).length;

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-outline-variant/10 shrink-0 flex gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setExpandedId(null); }}
            className={`px-3.5 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
              tab === t.id
                ? "text-primary bg-surface border border-outline-variant/20 border-b-surface -mb-px"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
              {countFor(t.id)}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-6 py-4 border-b border-outline-variant/10 shrink-0">
        <div className="relative max-w-sm">
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

      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-on-surface-variant">{q ? "No results found." : "No clients yet."}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                <th className="text-left px-6 py-4 text-sm font-medium text-on-surface-variant w-8" />
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant">Client</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden lg:table-cell">Appointment</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden lg:table-cell">Total</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(booking => {
                const expanded = expandedId === booking.id;
                return (
                  <>
                    <tr
                      key={booking.id}
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
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATE_STYLE[booking.state] ?? "bg-surface-container-high text-on-surface-variant"}`}>
                          {STATE_LABEL[booking.state] ?? booking.state}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell max-w-xs">
                        <p className="text-sm text-on-surface-variant line-clamp-2">{booking.description}</p>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <p className="text-sm text-on-surface-variant">
                          {booking.appointment_date ? fmtDate(booking.appointment_date) : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        {typeof booking.total_amount === "number" ? (
                          <p className="text-sm text-on-surface">
                            ${booking.total_amount}
                            {typeof booking.tip_amount === "number" && booking.tip_amount > 0 && (
                              <span className="text-on-surface-variant/60"> + ${booking.tip_amount} tip</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-sm text-on-surface-variant/40">—</p>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${booking.id}-detail`} className="border-b border-outline-variant/10 bg-surface-container-low/20">
                        <td />
                        <td colSpan={5} className="px-4 pb-5 pt-2">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
                            {booking.client_phone && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">Phone</p><p className="text-on-surface">{formatPhone(booking.client_phone)}</p></div>
                            )}
                            {booking.appointment_date && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">Appointment</p><p className="text-on-surface">{fmtDate(booking.appointment_date)}</p></div>
                            )}
                            {typeof booking.total_amount === "number" && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">Total</p><p className="text-on-surface">${booking.total_amount}</p></div>
                            )}
                            {typeof booking.tip_amount === "number" && booking.tip_amount > 0 && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">Tip</p><p className="text-on-surface">${booking.tip_amount}</p></div>
                            )}
                            {booking.size && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">Size</p><p className="text-on-surface">{booking.size}</p></div>
                            )}
                            {booking.placement && (
                              <div><p className="font-medium text-on-surface-variant mb-0.5">Placement</p><p className="text-on-surface">{booking.placement}</p></div>
                            )}
                            {booking.completion_notes && (
                              <div className="col-span-full">
                                <p className="font-medium text-on-surface-variant mb-0.5">Notes</p>
                                <p className="text-on-surface">{booking.completion_notes}</p>
                              </div>
                            )}
                            <div className="col-span-full">
                              <p className="font-medium text-on-surface-variant mb-0.5">Description</p>
                              <p className="text-on-surface">{booking.description}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
