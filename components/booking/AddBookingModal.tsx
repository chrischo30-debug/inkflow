"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const BOOKING_STATES = [
  { value: "inquiry",   label: "Submission" },
  { value: "follow_up", label: "Follow Ups" },
  { value: "accepted",  label: "Accepted" },
  { value: "confirmed", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "rejected",  label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const DURATION_OPTIONS = [
  { label: "30m", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr", value: 120 },
  { label: "3 hr", value: 180 },
  { label: "4 hr", value: 240 },
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

type CalEvent = { id: string; title: string; start: string; source: "google" | "flashbook" };

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AppointmentDatePicker({
  value,
  onChange,
}: {
  value: string; // ISO or ""
  onChange: (iso: string) => void;
}) {
  const today = new Date();
  const initial = value ? new Date(value) : null;
  const [date, setDate] = useState(initial ? toLocalDateKey(initial.toISOString()) : "");
  const [time, setTime] = useState(initial ? initial.toTimeString().slice(0, 5) : "10:00");
  const [duration, setDuration] = useState(120);

  const seed = date ? new Date(date + "T12:00:00") : today;
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setLoadingEvents(true);
    const start = new Date(y, m, 1).toISOString();
    const end = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    try {
      const res = await fetch(`/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const body = await res.json();
      setEvents(body.events ?? []);
    } catch { setEvents([]); }
    finally { setLoadingEvents(false); }
  }, []);

  useEffect(() => { fetchEvents(viewYear, viewMonth); }, [viewYear, viewMonth, fetchEvents]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDate = (key: string) => {
    setDate(key);
    const iso = new Date(`${key}T${time}:00`).toISOString();
    onChange(iso);
  };

  const handleTimeChange = (t: string) => {
    setTime(t);
    if (date) onChange(new Date(`${date}T${t}:00`).toISOString());
  };

  // Build grid
  type Cell = { day: number; currentMonth: boolean; dateKey: string };
  const cells: Cell[] = [];
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  for (let i = 0; i < firstDayOfMonth; i++) {
    const d = daysInPrevMonth - firstDayOfMonth + 1 + i;
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: d, currentMonth: false, dateKey: `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, dateKey: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; cells.length < 42; d++) {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: d, currentMonth: false, dateKey: `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  const eventsByDay = new Map<string, CalEvent[]>();
  for (const ev of events) {
    const key = toLocalDateKey(ev.start);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(ev);
  }

  const todayKey = toLocalDateKey(today.toISOString());
  const selectedDayEvents = date ? (eventsByDay.get(date) ?? []) : [];

  return (
    <div className="border border-outline-variant/30 rounded-xl overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/20 bg-surface-container-low">
        <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-on-surface">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-outline-variant/10 bg-surface-container-low">
        {WEEKDAYS.map(d => (
          <div key={d} className="py-1 text-center text-[10px] font-medium text-on-surface-variant/70">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      {loadingEvents ? (
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className={`h-9 ${i % 7 !== 6 ? "border-r" : ""} ${i < 35 ? "border-b" : ""} border-outline-variant/10 animate-pulse bg-surface-container/20`} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const cellEvents = eventsByDay.get(cell.dateKey) ?? [];
            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === date;
            return (
              <button
                key={`${cell.dateKey}-${i}`}
                type="button"
                onClick={() => selectDate(cell.dateKey)}
                className={`
                  p-1 flex flex-col items-center gap-0.5 transition-colors min-h-[36px]
                  ${i % 7 !== 6 ? "border-r border-outline-variant/10" : ""}
                  ${i < 35 ? "border-b border-outline-variant/10" : ""}
                  ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-surface-container-low"}
                  ${!cell.currentMonth && !isSelected ? "bg-surface-container/20" : ""}
                `}
              >
                <span className={`
                  text-[10px] font-medium w-5 h-5 flex items-center justify-center rounded-full leading-none
                  ${isToday ? "bg-primary text-on-primary font-bold" : ""}
                  ${isSelected && !isToday ? "ring-2 ring-primary text-primary" : ""}
                  ${!isToday && !isSelected ? (cell.currentMonth ? "text-on-surface" : "text-on-surface-variant/40") : ""}
                `}>
                  {cell.day}
                </span>
                {cellEvents.length > 0 && (
                  <div className="flex gap-0.5">
                    {cellEvents.slice(0, 2).map(ev => (
                      <span key={ev.id} className={`w-1 h-1 rounded-full ${ev.source === "google" ? "bg-blue-500" : "bg-amber-500"}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected day info + time + duration */}
      <div className="border-t border-outline-variant/20 px-3 py-3 space-y-3 bg-surface-container-low">
        {date ? (
          <p className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-on-surface-variant" />
            {new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric" })}
          </p>
        ) : (
          <p className="text-xs text-on-surface-variant/60 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Pick a day
          </p>
        )}

        {selectedDayEvents.length > 0 && (
          <div className="space-y-1">
            {selectedDayEvents.map(ev => {
              const isAllDay = !ev.start.includes("T");
              const timeStr = isAllDay
                ? "All day"
                : new Date(ev.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              return (
                <div key={ev.id} className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="font-medium text-amber-800 shrink-0 w-16">{timeStr}</span>
                  <span className="text-amber-700 truncate">{ev.title.replace(/^Appointment:\s*/, "")}</span>
                  <span className={`shrink-0 ml-auto text-[10px] px-1.5 py-px rounded font-medium ${ev.source === "google" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"}`}>
                    {ev.source === "google" ? "Google" : "FB"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={e => handleTimeChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-surface-container-low border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">Duration</label>
            <select
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-sm bg-surface-container-low border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:border-primary"
            >
              {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

const BLANK = {
  client_name: "", client_email: "", client_phone: "",
  description: "", size: "", placement: "", budget: "",
  state: "confirmed", appointment_date: "",
};

type PaymentLinkOption = { label: string; url: string };

// Controlled modal — used by CalendarView (click-to-create) and AddBookingModal
export function BookingFormModal({
  open,
  onClose,
  initialDateTime,
  initialForm,
}: {
  open: boolean;
  onClose: () => void;
  initialDateTime?: string;
  initialForm?: Partial<typeof BLANK>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ ...BLANK, appointment_date: initialDateTime ?? "", ...(initialForm ?? {}) });
  const [formKey, setFormKey] = useState(0);
  const [sendPaymentLink, setSendPaymentLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 — email editor
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkOption[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const router = useRouter();

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm({ ...BLANK, appointment_date: initialDateTime ?? "", ...(initialForm ?? {}) });
      setFormKey(k => k + 1);
      setError(null);
      setSendPaymentLink(false);
      setCreatedId(null);
      setEmailSubject("");
      setEmailBody("");
      setPaymentLinks([]);
      setEmailError(null);
    }
  // initialForm intentionally omitted — reset is driven by `open` transition
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDateTime]);

  const set = (k: keyof typeof BLANK, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookings: [form] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }

      const bookingId: string | undefined = data.ids?.[0];
      if (sendPaymentLink && bookingId) {
        // Load email template context for the new booking
        const emailRes = await fetch(`/api/bookings/${bookingId}/send-email`);
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          setEmailSubject(emailData.subject ?? "");
          setEmailBody(emailData.body ?? "");
          setPaymentLinks(emailData.paymentLinks ?? []);
        }
        setCreatedId(bookingId);
        setStep(2);
      } else {
        onClose();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const insertLink = (url: string) => {
    const ta = bodyRef.current;
    if (!ta) { setEmailBody(b => b + "\n" + url); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = emailBody.slice(0, start) + url + emailBody.slice(end);
    setEmailBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + url.length, start + url.length);
    });
  };

  const handleSendEmail = async () => {
    if (!createdId) return;
    setSendingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch(`/api/bookings/${createdId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: emailSubject, body: emailBody }),
      });
      if (!res.ok) {
        const d = await res.json();
        setEmailError(d.error ?? "Failed to send email");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSendingEmail(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {step === 1 ? (
          <form onSubmit={handleSubmit}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface">
              <h2 className="text-base font-semibold text-on-surface">Add booking</h2>
              <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <BookingFormFields key={formKey} form={form} set={set} />

              {/* Send payment link toggle */}
              <div className="pt-1 border-t border-outline-variant/10">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sendPaymentLink}
                    onClick={() => setSendPaymentLink(v => !v)}
                    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${sendPaymentLink ? "bg-primary" : "bg-outline-variant/50"}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${sendPaymentLink ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                  <div>
                    <p className="text-sm font-medium text-on-surface">Send payment link</p>
                    <p className="text-xs text-on-surface-variant">After saving, compose a deposit request email</p>
                  </div>
                </label>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20 bg-surface">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40">
                {saving ? "Saving…" : sendPaymentLink ? "Save & compose email →" : "Add booking"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setStep(1)} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-semibold text-on-surface">Send payment link email</h2>
              </div>
              <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-on-surface-variant">Booking saved. Compose an email to send your client a payment link.</p>

              {paymentLinks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-2">Insert payment link</p>
                  <div className="flex flex-wrap gap-2">
                    {paymentLinks.map((pl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => insertLink(pl.url)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                      >
                        <span className="text-primary">+</span> {pl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Body</label>
                <textarea
                  ref={bodyRef}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none font-mono placeholder:text-[#888888]"
                />
              </div>

              {emailError && <p className="text-sm text-destructive">{emailError}</p>}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20 bg-surface">
              <button
                type="button"
                onClick={() => { onClose(); router.refresh(); }}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Skip, save only
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailSubject.trim()}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {sendingEmail ? "Sending…" : "Send email"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function AddBookingModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3.5 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
      >
        + Add booking
      </button>
      <BookingFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export type BookingFormState = typeof BLANK;

export function BookingFormFields({
  form,
  set,
}: {
  form: BookingFormState;
  set: (k: keyof BookingFormState, v: string) => void;
}) {
  return (
    <>
      <Field label="Name *" value={form.client_name} onChange={v => set("client_name", v)} placeholder="Client name" />
      <Field label="Email" value={form.client_email} onChange={v => set("client_email", v)} placeholder="client@email.com" type="email" />
      <Field label="Phone" value={form.client_phone} onChange={v => set("client_phone", v)} placeholder="(555) 000-0000" />
      <Field label="Description" value={form.description} onChange={v => set("description", v)} placeholder="Tattoo idea…" multiline />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Size" value={form.size} onChange={v => set("size", v)} placeholder="e.g. palm-sized" />
        <Field label="Placement" value={form.placement} onChange={v => set("placement", v)} placeholder="e.g. upper arm" />
      </div>
      <Field label="Budget ($)" value={form.budget} onChange={v => set("budget", v)} placeholder="e.g. 300" type="number" />
      <div>
        <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Status</label>
        <select
          value={form.state}
          onChange={e => set("state", e.target.value)}
          className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
        >
          {BOOKING_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Appointment date</label>
        <AppointmentDatePicker
          value={form.appointment_date}
          onChange={v => set("appointment_date", v)}
        />
      </div>
    </>
  );
}

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
