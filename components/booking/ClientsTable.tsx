"use client";

import React, { useState, useEffect, useRef } from "react";
import { formatPhone } from "@/lib/format";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Search, ChevronRight, Plus, Pencil, Trash2, X, Mail, Copy, Check, ExternalLink, Send } from "lucide-react";
import type { Booking } from "@/lib/types";
import { BookingFormModal } from "./AddBookingModal";
import { EmailComposeModal, type ResolvedTemplate, type InsertLink } from "./EmailComposeModal";

// ─── Client type (derived from bookings) ─────────────────────────────────────
type Client = {
  email: string;
  name: string;
  phone?: string;
  sessions: Booking[];
};

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVE_STATES = new Set(["inquiry", "follow_up", "sent_deposit", "accepted", "sent_calendar", "booked", "confirmed"]);

const STATE_LABEL: Record<string, string> = {
  inquiry:       "Submission",
  follow_up:     "Follow Up",
  accepted:      "Deposit Pending", // legacy
  sent_deposit:  "Sent Deposit",
  sent_calendar: "Sent Calendar",
  booked:        "Booked",
  confirmed:     "Booked",
  completed:     "Completed",
  rejected:      "Rejected",
  cancelled:     "Cancelled",
};

const STATE_STYLE: Record<string, string> = {
  inquiry:   "bg-surface-container-high text-on-surface-variant",
  follow_up: "bg-purple-100 text-purple-700",
  accepted:  "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  rejected:  "bg-red-100 text-red-700",
  cancelled: "bg-surface-container-high text-on-surface-variant/60",
};

// ─── Copy on click ────────────────────────────────────────────────────────────
function CopyText({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className={`inline-flex items-center gap-1 hover:text-on-surface transition-colors ${className ?? ""}`}
    >
      {text}
      {copied
        ? <Check className="w-3 h-3 text-emerald-600 shrink-0" />
        : <Copy className="w-3 h-3 opacity-40 shrink-0" />}
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function groupByClient(bookings: Booking[]): Client[] {
  const map = new Map<string, Client>();
  for (const b of bookings) {
    const key = b.client_email.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { email: b.client_email, name: b.client_name, sessions: [] });
    }
    const c = map.get(key)!;
    c.name = b.client_name;
    if (b.client_phone) c.phone = b.client_phone;
    c.sessions.push(b);
  }
  for (const c of map.values()) {
    c.sessions.sort((a, b) => {
      const da = a.appointment_date ?? a.created_at;
      const db = b.appointment_date ?? b.created_at;
      return new Date(db).getTime() - new Date(da).getTime();
    });
  }
  return Array.from(map.values());
}

function isActive(c: Client) {
  return c.sessions.some(s => ACTIVE_STATES.has(s.state));
}

function mostRecentDate(c: Client): string | null {
  const dates = c.sessions
    .map(s => s.appointment_date ?? s.created_at)
    .filter(Boolean)
    .sort()
    .reverse();
  return dates[0] ?? null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Shared Field input ───────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, type = "text", multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; multiline?: boolean;
}) {
  const cls = "w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]";
  return (
    <div>
      <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${cls} resize-none`} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  );
}

// ─── Edit Client Modal ────────────────────────────────────────────────────────
function EditClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: (updated: { name: string; email: string; phone: string }) => void;
}) {
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email);
  const [phone, setPhone] = useState(client.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/artist/client", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_email: client.email,
          new_name: name.trim(),
          new_email: email.trim(),
          new_phone: phone.trim(),
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return; }
      onSaved({ name: name.trim(), email: email.trim(), phone: phone.trim() });
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <h2 className="text-base font-semibold text-on-surface">Edit client</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label="Name *" value={name} onChange={setName} placeholder="Client name" />
          <Field label="Email *" value={email} onChange={setEmail} placeholder="client@email.com" type="email" />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="(555) 000-0000" />
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({
  client,
  onClose,
  onDeleted,
}: {
  client: Client;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/artist/client", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: client.email }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to delete"); return; }
      onDeleted();
    } finally { setDeleting(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-base font-semibold text-on-surface mb-2">Delete client?</h2>
          <p className="text-sm text-on-surface-variant">
            This will permanently delete{" "}
            <span className="font-medium text-on-surface">{client.name}</span> and all{" "}
            {client.sessions.length} session{client.sessions.length !== 1 ? "s" : ""}. This cannot be undone.
          </p>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:opacity-80 transition-opacity disabled:opacity-40">
            {deleting ? "Deleting…" : "Delete client"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Edit Session Modal ───────────────────────────────────────────────────────
function EditSessionModal({
  session,
  onClose,
  onSaved,
}: {
  session: Booking;
  onClose: () => void;
  onSaved: (updates: Partial<Booking>) => void;
}) {
  const [description, setDescription] = useState(session.description ?? "");
  const [size, setSize] = useState(session.size ?? "");
  const [placement, setPlacement] = useState(session.placement ?? "");
  const [totalAmount, setTotalAmount] = useState(session.total_amount != null ? String(session.total_amount) : "");
  const [tipAmount, setTipAmount] = useState(session.tip_amount != null ? String(session.tip_amount) : "");
  const [completionNotes, setCompletionNotes] = useState(session.completion_notes ?? "");
  const [appointmentDate, setAppointmentDate] = useState(session.appointment_date ? toDatetimeLocal(session.appointment_date) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        action: "edit_details",
        description: description.trim(),
        size: size.trim() || null,
        placement: placement.trim() || null,
        completion_notes: completionNotes.trim() || null,
        appointment_date: appointmentDate ? new Date(appointmentDate).toISOString() : null,
      };
      if (totalAmount !== "") body.total_amount = Number(totalAmount) || null;
      if (tipAmount !== "") body.tip_amount = Number(tipAmount) || null;

      const res = await fetch(`/api/bookings/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return; }
      onSaved({
        description: description.trim(),
        size: size.trim() || undefined,
        placement: placement.trim() || undefined,
        total_amount: totalAmount !== "" ? (Number(totalAmount) || undefined) : undefined,
        tip_amount: tipAmount !== "" ? (Number(tipAmount) || undefined) : undefined,
        completion_notes: completionNotes.trim() || undefined,
        appointment_date: appointmentDate ? new Date(appointmentDate).toISOString() : undefined,
      });
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/40" onClick={onClose}>
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface">
          <h2 className="text-base font-semibold text-on-surface">Edit session</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label="Description" value={description} onChange={setDescription} placeholder="Tattoo idea…" multiline />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size" value={size} onChange={setSize} placeholder="e.g. palm-sized" />
            <Field label="Placement" value={placement} onChange={setPlacement} placeholder="e.g. upper arm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total ($)" value={totalAmount} onChange={setTotalAmount} placeholder="e.g. 400" type="number" />
            <Field label="Tip ($)" value={tipAmount} onChange={setTipAmount} placeholder="e.g. 50" type="number" />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Appointment</label>
            <input
              type="datetime-local"
              value={appointmentDate}
              onChange={e => setAppointmentDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <Field label="Notes" value={completionNotes} onChange={setCompletionNotes} placeholder="Session notes…" multiline />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20 bg-surface">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main ClientsTable ────────────────────────────────────────────────────────
type Tab = "all" | "active" | "past";

type EmailCompose = {
  bookingId: string;
  subject: string;
  body: string;
  templates: ResolvedTemplate[];
  defaultTemplateState?: string | null;
  paymentLinks?: InsertLink[];
  calendarLinks?: InsertLink[];
  previewVars?: Record<string, string>;
};

export function ClientsTable({ bookings: initialBookings, artistSlug = "" }: { bookings: Booking[]; artistSlug?: string }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [newSessionClient, setNewSessionClient] = useState<Client | null>(null);
  const [editingSession, setEditingSession] = useState<Booking | null>(null);
  const [emailCompose, setEmailCompose] = useState<EmailCompose | null>(null);
  const [emailLoadingFor, setEmailLoadingFor] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    const clientParam = searchParams.get("client");
    if (!clientParam) return;
    const key = clientParam.toLowerCase();
    setExpandedEmail(key);
    // Defer until the row is rendered
    requestAnimationFrame(() => {
      rowRefs.current.get(key)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [searchParams]);

  const openEmailCompose = async (client: Client) => {
    const session = client.sessions[0];
    if (!session) return;
    await openEmailComposeForSession(session.id, client.email);
  };

  const openEmailComposeForSession = async (sessionId: string, loadingKey: string) => {
    setEmailLoadingFor(loadingKey);
    try {
      const res = await fetch(`/api/bookings/${sessionId}/send-email`);
      if (!res.ok) return;
      const data = await res.json();
      setEmailCompose({
        bookingId: sessionId,
        subject: "",
        body: "",
        templates: data.templates ?? [],
        defaultTemplateState: null,
        paymentLinks: data.paymentLinks ?? [],
        calendarLinks: data.calendarLinks ?? [],
        previewVars: data.previewVars,
      });
    } finally {
      setEmailLoadingFor(null);
    }
  };

  const sendEmail = async (subject: string, body: string) => {
    if (!emailCompose) return;
    const { bookingId } = emailCompose;
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
      b.id === bookingId ? { ...b, last_email_sent_at: nowIso, sent_emails: [...(b.sent_emails ?? []), newEntry] } : b
    ));
    setEmailCompose(null);
  };

  const allClients = groupByClient(bookings);
  const activeCount = allClients.filter(isActive).length;
  const pastCount = allClients.filter(c => !isActive(c)).length;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "all",    label: "All",    count: allClients.length },
    { id: "active", label: "Active", count: activeCount },
    { id: "past",   label: "Past",   count: pastCount },
  ];

  const tabClients =
    tab === "all"    ? allClients :
    tab === "active" ? allClients.filter(isActive) :
                       allClients.filter(c => !isActive(c));

  const q = search.trim().toLowerCase();
  const visible = q
    ? tabClients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.sessions.some(s => s.description.toLowerCase().includes(q))
      )
    : tabClients;

  const handleClientSaved = (client: Client, updated: { name: string; email: string; phone: string }) => {
    setBookings(prev => prev.map(b =>
      b.client_email.toLowerCase() === client.email.toLowerCase()
        ? { ...b, client_name: updated.name, client_email: updated.email, client_phone: updated.phone || undefined }
        : b
    ));
    if (expandedEmail === client.email.toLowerCase()) setExpandedEmail(updated.email.toLowerCase());
    setEditingClient(null);
  };

  const handleClientDeleted = (client: Client) => {
    setBookings(prev => prev.filter(b => b.client_email.toLowerCase() !== client.email.toLowerCase()));
    if (expandedEmail === client.email.toLowerCase()) setExpandedEmail(null);
    setDeletingClient(null);
  };

  const handleSessionSaved = (session: Booking, updates: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === session.id ? { ...b, ...updates } : b));
    setEditingSession(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-outline-variant/10 shrink-0 flex gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setExpandedEmail(null); }}
            className={`px-3.5 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
              tab === t.id
                ? "text-primary bg-surface border border-outline-variant/20 border-b-surface -mb-px"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
              {t.count}
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
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden sm:table-cell">Sessions</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-on-surface-variant hidden md:table-cell">Last Session</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(client => {
                const expanded = expandedEmail === client.email.toLowerCase();
                const lastD = mostRecentDate(client);
                return (
                  <React.Fragment key={client.email}>
                    <tr
                      ref={el => { if (el) rowRefs.current.set(client.email.toLowerCase(), el); else rowRefs.current.delete(client.email.toLowerCase()); }}
                      className={`border-b border-outline-variant/10 hover:bg-surface-container-low/40 transition-colors cursor-pointer ${expanded ? "bg-surface-container-low/60" : ""}`}
                      onClick={() => setExpandedEmail(expanded ? null : client.email.toLowerCase())}
                    >
                      <td className="px-6 py-4">
                        <ChevronRight className={`w-4 h-4 text-on-surface-variant transition-transform ${expanded ? "rotate-90" : ""}`} />
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-on-surface">{client.name}</p>
                        <div className="flex flex-col gap-1.5 mt-2">
                          <CopyText text={client.email} className="text-sm text-on-surface-variant" />
                          {client.phone && <CopyText text={formatPhone(client.phone)} className="text-sm text-on-surface-variant" />}
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-on-surface-variant">{client.sessions.length}</span>
                          {isActive(client) && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Active</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <p className="text-sm text-on-surface-variant">{lastD ? fmtDate(lastD) : "—"}</p>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Send email"
                            disabled={emailLoadingFor === client.email}
                            onClick={() => openEmailCompose(client)}
                            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors disabled:opacity-40"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Edit client"
                            onClick={() => setEditingClient(client)}
                            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete client"
                            onClick={() => setDeletingClient(client)}
                            className="p-2 rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr key={`${client.email}-expanded`} className="border-b border-outline-variant/15 bg-surface-container-low/30">
                        <td colSpan={5} className="px-6 pb-5 pt-3">
                          <div className="border border-outline-variant/25 rounded-xl bg-surface shadow-sm overflow-hidden text-sm">
                            {/* Client header */}
                            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-container-low/50 border-b border-outline-variant/10">
                              <div>
                                <p className="text-sm font-semibold text-on-surface">{client.name}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={emailLoadingFor === client.email}
                                  onClick={() => openEmailCompose(client)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors disabled:opacity-40"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  {emailLoadingFor === client.email ? "Loading…" : "Send email"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewSessionClient(client)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  New booking
                                </button>
                              </div>
                            </div>

                            {/* Sessions */}
                            <div className="p-4 space-y-2">
                              {client.sessions.map(session => (
                                <div
                                  key={session.id}
                                  className="rounded-xl bg-surface-container-low/40 border border-outline-variant/15 hover:border-outline-variant/30 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATE_STYLE[session.state] ?? "bg-surface-container-high text-on-surface-variant"}`}>
                                        {STATE_LABEL[session.state] ?? session.state}
                                      </span>
                                      {session.appointment_date && (
                                        <span className="text-xs text-on-surface-variant">{fmtDate(session.appointment_date)}</span>
                                      )}
                                    </div>
                                    <p className="text-sm text-on-surface-variant line-clamp-1">
                                      {session.description || <span className="italic opacity-50">No description</span>}
                                    </p>
                                    {session.total_amount != null && (
                                      <p className="text-xs text-on-surface-variant/70 mt-1">
                                        ${session.total_amount.toLocaleString()}
                                        {session.tip_amount != null && session.tip_amount > 0 && ` + $${session.tip_amount} tip`}
                                      </p>
                                    )}
                                    {(session.completion_image_urls ?? []).length > 0 && (
                                      <div className="flex gap-2 mt-2">
                                        {(session.completion_image_urls ?? []).map((url, i) => (
                                          <a key={i} href={url} target="_blank" rel="noreferrer">
                                            <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-outline-variant/20 hover:opacity-80 transition-opacity" />
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      title="Send email about this booking"
                                      disabled={emailLoadingFor === session.id}
                                      onClick={() => openEmailComposeForSession(session.id, session.id)}
                                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors disabled:opacity-40"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                    </button>
                                    <Link
                                      href={`/bookings?expand=${session.id}`}
                                      title="View in bookings"
                                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </Link>
                                    <button
                                      type="button"
                                      title="Edit session"
                                      onClick={() => setEditingSession(session)}
                                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  </div>
                                {(session.sent_emails ?? []).length > 0 && (
                                  <div className="px-4 pb-3 border-t border-outline-variant/10 pt-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/70">Emails sent</p>
                                    </div>
                                    <div className="space-y-1">
                                      {(session.sent_emails ?? []).map((entry, i) => (
                                        <div key={i} className="flex items-center justify-between gap-3 group">
                                          <span className="text-xs text-on-surface-variant truncate">{entry.label}</span>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[11px] text-on-surface-variant/60">{fmtDate(entry.sent_at)}</span>
                                            <button
                                              type="button"
                                              title="Resend"
                                              disabled={emailLoadingFor === session.id}
                                              onClick={() => openEmailComposeForSession(session.id, session.id)}
                                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-on-surface-variant hover:bg-surface-container-high hover:text-primary disabled:opacity-30"
                                            >
                                              <Send className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={updated => handleClientSaved(editingClient, updated)}
        />
      )}

      {deletingClient && (
        <DeleteConfirmModal
          client={deletingClient}
          onClose={() => setDeletingClient(null)}
          onDeleted={() => handleClientDeleted(deletingClient)}
        />
      )}

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSaved={updates => handleSessionSaved(editingSession, updates)}
        />
      )}

      <BookingFormModal
        open={!!newSessionClient}
        onClose={() => { setNewSessionClient(null); router.refresh(); }}
        initialForm={newSessionClient ? {
          client_name:  newSessionClient.name,
          client_email: newSessionClient.email,
          client_phone: newSessionClient.phone ?? "",
        } : undefined}
        artistSlug={artistSlug}
      />

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
          onClose={() => setEmailCompose(null)}
        />
      )}
    </div>
  );
}
