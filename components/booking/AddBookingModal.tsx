"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Ban, Copy, Check, ChevronDown, Send, ExternalLink } from "lucide-react";
import { SendDepositModal } from "./SendDepositModal";
import { TimeSelect } from "@/components/ui/TimeSelect";
import type { SchedulingLink } from "@/lib/pipeline-settings";

const BOOKING_STATES = [
  { value: "inquiry",       label: "Submission" },
  { value: "follow_up",     label: "Follow Up" },
  { value: "sent_deposit",  label: "Sent Deposit" },
  { value: "sent_calendar", label: "Sent Calendar" },
  { value: "booked",        label: "Booked" },
  { value: "completed",     label: "Completed" },
  { value: "rejected",      label: "Rejected" },
  { value: "cancelled",     label: "Cancelled" },
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

type BusyInterval = { start: string; end: string; source: "google" | "flashbook" };

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTimeRange(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${fmt(s)} – ${fmt(e)}`;
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
  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const fetchAvailability = useCallback(async (y: number, m: number) => {
    setLoadingEvents(true);
    const start = new Date(y, m, 1).toISOString();
    const end = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    try {
      const res = await fetch(`/api/calendar/availability?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const body = await res.json();
      setBusy(Array.isArray(body.busy) ? body.busy : []);
      setBlockedDates(new Set(Array.isArray(body.blockedDates) ? body.blockedDates : []));
      setCalendarConnected(Boolean(body.connected));
    } catch {
      setBusy([]);
      setBlockedDates(new Set());
      setCalendarConnected(false);
    } finally { setLoadingEvents(false); }
  }, []);

  useEffect(() => { fetchAvailability(viewYear, viewMonth); }, [viewYear, viewMonth, fetchAvailability]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDate = (key: string) => {
    if (blockedDates.has(key)) return;
    setDate(key);
    const iso = new Date(`${key}T${time}:00`).toISOString();
    onChange(iso);
  };

  const handleTimeChange = (t: string) => {
    setTime(t);
    if (date) onChange(new Date(`${date}T${t}:00`).toISOString());
  };

  // Check if the currently picked date+time+duration overlaps any busy interval.
  const conflict = (() => {
    if (!date) return null;
    const slotStart = new Date(`${date}T${time}:00`);
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    return busy.find(b => {
      const bs = new Date(b.start);
      const be = new Date(b.end);
      return slotStart < be && slotEnd > bs;
    }) ?? null;
  })();

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

  const busyByDay = new Map<string, BusyInterval[]>();
  for (const b of busy) {
    const key = toLocalDateKey(b.start);
    if (!busyByDay.has(key)) busyByDay.set(key, []);
    busyByDay.get(key)!.push(b);
  }

  const todayKey = toLocalDateKey(today.toISOString());
  const selectedDayBusy = date ? (busyByDay.get(date) ?? []) : [];

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
            const cellBusy = busyByDay.get(cell.dateKey) ?? [];
            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === date;
            const isBlocked = blockedDates.has(cell.dateKey);
            return (
              <button
                key={`${cell.dateKey}-${i}`}
                type="button"
                onClick={() => selectDate(cell.dateKey)}
                disabled={isBlocked}
                title={isBlocked ? "Blocked date" : undefined}
                className={`
                  p-1 flex flex-col items-center gap-0.5 transition-colors min-h-[36px] relative
                  ${i % 7 !== 6 ? "border-r border-outline-variant/10" : ""}
                  ${i < 35 ? "border-b border-outline-variant/10" : ""}
                  ${isBlocked ? "bg-surface-container/40 cursor-not-allowed" : ""}
                  ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : !isBlocked ? "hover:bg-surface-container-low" : ""}
                  ${!cell.currentMonth && !isSelected && !isBlocked ? "bg-surface-container/20" : ""}
                `}
              >
                <span className={`
                  text-[10px] font-medium w-5 h-5 flex items-center justify-center rounded-full leading-none
                  ${isToday && !isBlocked ? "bg-primary text-on-primary font-bold" : ""}
                  ${isSelected && !isToday ? "ring-2 ring-primary text-primary" : ""}
                  ${isBlocked ? "text-on-surface-variant/40 line-through" : ""}
                  ${!isToday && !isSelected && !isBlocked ? (cell.currentMonth ? "text-on-surface" : "text-on-surface-variant/40") : ""}
                `}>
                  {cell.day}
                </span>
                {!isBlocked && cellBusy.length > 0 && (
                  <div className="flex gap-0.5">
                    {cellBusy.slice(0, 2).map((b, idx) => (
                      <span key={idx} className={`w-1 h-1 rounded-full ${b.source === "google" ? "bg-blue-500" : "bg-amber-500"}`} />
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
            {blockedDates.has(date) && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-on-surface-variant">
                <Ban className="w-3 h-3" /> Blocked
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-on-surface-variant flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Pick a day
          </p>
        )}

        {selectedDayBusy.length > 0 && (
          <div className="space-y-1">
            {selectedDayBusy.map((b, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                <span className="font-medium text-amber-800 shrink-0">{formatTimeRange(b.start, b.end)}</span>
                <span className={`shrink-0 ml-auto text-[10px] px-1.5 py-px rounded font-medium ${b.source === "google" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"}`}>
                  {b.source === "google" ? "Google · busy" : "Booking"}
                </span>
              </div>
            ))}
          </div>
        )}

        {conflict && (
          <div className="flex items-start gap-1.5 text-xs px-2 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>This time overlaps a busy interval ({formatTimeRange(conflict.start, conflict.end)}).</span>
          </div>
        )}

        {!calendarConnected && !loadingEvents && (
          <p className="text-sm text-on-surface-variant">
            Connect Google Calendar in Settings to see real-time conflicts.
          </p>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">Time</label>
            <TimeSelect value={time} onChange={handleTimeChange} className="w-full" />
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

function SendFormOption({
  artistSlug, clientName, clientEmail, clientPhone,
  linkCopied, setLinkCopied, showManual, setShowManual,
}: {
  artistSlug: string; clientName: string; clientEmail: string; clientPhone: string;
  linkCopied: boolean; setLinkCopied: (v: boolean) => void;
  showManual: boolean; setShowManual: (v: boolean) => void;
}) {
  const formUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${artistSlug}/book?name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail)}${clientPhone ? `&phone=${encodeURIComponent(clientPhone)}` : ""}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(formUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const firstName = clientName.split(" ")[0];
  const mailtoHref = `mailto:${clientEmail}?subject=${encodeURIComponent(`Fill out my booking form`)}&body=${encodeURIComponent(`Hi ${firstName},\n\nHere's a link to my booking form — your info is already filled in:\n\n${formUrl}\n\nThanks!`)}`;

  return (
    <div className="px-6 pt-5 pb-4 space-y-4 border-b border-outline-variant/10">
      <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 space-y-3">
        <div>
          <p className="text-base font-medium text-on-surface">Send {firstName} the form</p>
          <p className="text-xs text-on-surface-variant mt-0.5">Their name, email, and phone are pre-filled — they just fill in the tattoo details and submit.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={formUrl}
            className="flex-1 min-w-0 px-3 py-2 text-xs text-on-surface-variant bg-surface border border-outline-variant/30 rounded-lg truncate focus:outline-none"
          />
          <button type="button" onClick={copyLink}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity whitespace-nowrap">
            {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {linkCopied ? "Copied" : "Copy link"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <a href={mailtoHref}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <Send className="w-3 h-3" /> Email {firstName}
          </a>
          <a href={formUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <ExternalLink className="w-3 h-3" /> Preview form
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowManual(!showManual)}
        className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showManual ? "rotate-180" : ""}`} />
        {showManual ? "Hide manual entry" : "Or add it manually instead"}
      </button>
    </div>
  );
}

// Controlled modal — used by CalendarView (click-to-create) and AddBookingModal
export function BookingFormModal({
  open,
  onClose,
  initialDateTime,
  initialForm,
  artistSlug,
}: {
  open: boolean;
  onClose: () => void;
  initialDateTime?: string;
  initialForm?: Partial<typeof BLANK>;
  artistSlug?: string;
}) {
  // "send" = send them a pre-filled form link, "manual" = fill it in yourself
  const hasClientContext = Boolean(artistSlug && initialForm?.client_email);
  const [mode, setMode] = useState<"send" | "manual">(hasClientContext ? "send" : "manual");
  const [showManual, setShowManual] = useState(!hasClientContext);
  const [linkCopied, setLinkCopied] = useState(false);

  const [form, setForm] = useState({ ...BLANK, appointment_date: initialDateTime ?? "", ...(initialForm ?? {}) });
  const [formKey, setFormKey] = useState(0);
  const [sendPaymentLink, setSendPaymentLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After-save deposit modal context
  const [depositCtx, setDepositCtx] = useState<{
    bookingId: string;
    clientName: string;
    paymentsConnected: boolean;
    paymentProvider: "stripe" | "square" | null;
    schedulingLinks: SchedulingLink[];
  } | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (open) {
      const hasCtx = Boolean(artistSlug && initialForm?.client_email);
      setMode(hasCtx ? "send" : "manual");
      setShowManual(!hasCtx);
      setLinkCopied(false);
      setForm({ ...BLANK, appointment_date: initialDateTime ?? "", ...(initialForm ?? {}) });
      setFormKey(k => k + 1);
      setError(null);
      setSendPaymentLink(false);
      setDepositCtx(null);
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
      // When sending a payment link, the booking is created in the
      // deposit-sent stage so the email modal lands on the deposit template
      // and the pipeline reflects where the booking actually sits even if
      // the artist closes the email modal without sending.
      const payload = sendPaymentLink ? { ...form, state: "sent_deposit" } : form;
      const res = await fetch("/api/bookings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookings: [payload] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }

      const bookingId: string | undefined = data.ids?.[0];
      if (sendPaymentLink && bookingId) {
        // Pull payment provider + scheduling-links context so the deposit
        // modal can offer the provider link generator + automation picker.
        const emailRes = await fetch(`/api/bookings/${bookingId}/send-email`);
        const emailData = emailRes.ok ? await emailRes.json() : {};
        setDepositCtx({
          bookingId,
          clientName: form.client_name,
          paymentsConnected: Boolean(emailData.paymentsConnected),
          paymentProvider: (emailData.paymentProvider as "stripe" | "square" | null) ?? null,
          schedulingLinks: Array.isArray(emailData.schedulingLinksFull) ? emailData.schedulingLinksFull : [],
        });
      } else {
        onClose();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const closeDeposit = () => {
    setDepositCtx(null);
    onClose();
    router.refresh();
  };

  if (!open) return null;

  // After a "Save & compose email" submission we hand off to SendDepositModal
  // (which has the variable picker + provider deposit-link generator + template
  // selector). The booking is already saved at this point.
  if (depositCtx) {
    return (
      <SendDepositModal
        bookingId={depositCtx.bookingId}
        clientName={depositCtx.clientName}
        paymentsConnected={depositCtx.paymentsConnected}
        paymentProvider={depositCtx.paymentProvider}
        schedulingLinks={depositCtx.schedulingLinks}
        artistId=""
        onSent={closeDeposit}
        onClose={closeDeposit}
      />
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSubmit}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface">
              <h2 className="text-base font-semibold text-on-surface">
                {hasClientContext ? `New booking for ${initialForm?.client_name?.split(" ")[0] ?? "client"}` : "Add booking"}
              </h2>
              <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {hasClientContext && (
              <SendFormOption
                artistSlug={artistSlug!}
                clientName={initialForm?.client_name ?? ""}
                clientEmail={initialForm?.client_email ?? ""}
                clientPhone={initialForm?.client_phone ?? ""}
                linkCopied={linkCopied}
                setLinkCopied={setLinkCopied}
                showManual={showManual}
                setShowManual={setShowManual}
              />
            )}

            {showManual && (
              <>
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
              </>
            )}

            {hasClientContext && !showManual && (
              <div className="sticky bottom-0 flex justify-end px-6 py-4 border-t border-outline-variant/20 bg-surface">
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
                  Done
                </button>
              </div>
            )}
        </form>
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
        data-coachmark="dashboard-add-booking"
        title="Add booking"
        className="px-2.5 sm:px-3.5 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity whitespace-nowrap"
      >
        + <span className="hidden sm:inline">Add booking</span><span className="sm:hidden">New</span>
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
