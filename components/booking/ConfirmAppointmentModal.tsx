"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, AlertTriangle, CalendarDays } from "lucide-react";
import { TimeSelect } from "@/components/ui/TimeSelect";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  source: "google" | "flashbook";
  link?: string;
};

interface ExistingAppointment {
  appointment_date: string;
  client_name: string;
}

interface Props {
  bookingId: string;
  calendarSyncEnabled: boolean;
  initialAppointmentDate?: string;
  existingAppointments?: ExistingAppointment[];
  onConfirmed: (appointmentDate: string, googleEventId?: string) => void;
  onSkip?: () => void;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr",   value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr",   value: 120 },
  { label: "3 hr",   value: 180 },
  { label: "4 hr",   value: 240 },
  { label: "5 hr",   value: 300 },
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function parseInitial(iso?: string) {
  if (!iso) return { date: "", time: "10:00" };
  const d = new Date(iso);
  return { date: d.toLocaleDateString("en-CA"), time: d.toTimeString().slice(0, 5) };
}

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ConfirmAppointmentModal({
  bookingId,
  calendarSyncEnabled,
  initialAppointmentDate,
  existingAppointments = [],
  onConfirmed,
  onSkip,
  onClose,
}: Props) {
  const isEdit = !!initialAppointmentDate;
  const initial = parseInitial(initialAppointmentDate);

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(120);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const seed = date ? new Date(date + "T12:00:00") : today;
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    existingAppointments.map(a => ({
      id: `pre-${a.appointment_date}`,
      title: `Appointment: ${a.client_name}`,
      start: a.appointment_date,
      source: "flashbook" as const,
    }))
  );
  const [loadingEvents, setLoadingEvents] = useState(true);

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setLoadingEvents(true);
    const start = new Date(y, m, 1).toISOString();
    const end = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    try {
      const res = await fetch(`/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const body = await res.json();
      setEvents(body.events ?? []);
    } catch { /* keep pre-loaded fallback */ }
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

  // Group events by local date
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = toLocalDateKey(ev.start);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(ev);
  }

  // 42-cell grid
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

  const todayKey = toLocalDateKey(today.toISOString());
  const selectedDayEvents = date ? (eventsByDay.get(date) ?? []) : [];

  const selectedStart = date && time ? new Date(`${date}T${time}:00`) : null;
  const selectedEnd = selectedStart ? new Date(selectedStart.getTime() + duration * 60_000) : null;
  const originalStart = initialAppointmentDate ? new Date(initialAppointmentDate) : null;
  const allTimeOverlaps = selectedStart && selectedEnd
    ? selectedDayEvents.filter(ev => {
        if (!ev.start.includes("T")) return false;
        const evStart = new Date(ev.start);
        const evEnd = ev.end ? new Date(ev.end) : new Date(evStart.getTime() + 3_600_000);
        return evStart < selectedEnd && evEnd > selectedStart;
      })
    : [];
  // When editing, separate the original appointment's event from real conflicts
  const originalOverlap = isEdit && originalStart
    ? allTimeOverlaps.find(ev => Math.abs(new Date(ev.start).getTime() - originalStart.getTime()) < 60_000)
    : null;
  const timeOverlaps = allTimeOverlaps.filter(ev => ev !== originalOverlap);

  const handleConfirm = async () => {
    if (!date) return;
    setSaving(true);
    try {
      const appointmentDate = new Date(`${date}T${time}:00`).toISOString();
      const action = isEdit ? "update_appointment" : "confirm_appointment";
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, appointment_date: appointmentDate, duration_minutes: duration }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onConfirmed(appointmentDate, data.google_event_id ?? undefined);
    } catch {
      alert("Failed to save appointment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: "min(90vh, 680px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 shrink-0">
          <h2 className="text-base font-semibold text-on-surface">
            {isEdit ? "Edit Appointment" : "Confirm Appointment"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-column body — calendar left, form right */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left: calendar ── */}
          <div className="flex-1 flex flex-col min-w-0 p-4 border-r border-outline-variant/10">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-on-surface">{MONTH_NAMES[viewMonth]} {viewYear}</span>
              <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Calendar grid */}
            <div className="flex-1 rounded-xl border border-outline-variant/20 overflow-hidden flex flex-col">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-outline-variant/10 bg-surface-container-low shrink-0">
                {WEEKDAYS.map(d => (
                  <div key={d} className="py-1.5 text-center text-[11px] font-medium text-on-surface-variant/70">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              {loadingEvents ? (
                <div className="flex-1 grid grid-cols-7">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <div key={i} className={`${i % 7 !== 6 ? "border-r" : ""} ${i < 35 ? "border-b" : ""} border-outline-variant/10 animate-pulse bg-surface-container/20`} />
                  ))}
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-7">
                  {cells.map((cell, i) => {
                    const cellEvents = eventsByDay.get(cell.dateKey) ?? [];
                    const isToday = cell.dateKey === todayKey;
                    const isSelected = cell.dateKey === date;
                    const isLastRow = i >= 35;

                    return (
                      <button
                        key={`${cell.dateKey}-${i}`}
                        type="button"
                        onClick={() => setDate(cell.dateKey)}
                        className={`
                          p-1 text-left flex flex-col gap-0.5 transition-colors min-h-0
                          ${i % 7 !== 6 ? "border-r border-outline-variant/10" : ""}
                          ${!isLastRow ? "border-b border-outline-variant/10" : ""}
                          ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-surface-container-low"}
                          ${!cell.currentMonth && !isSelected ? "bg-surface-container/30" : ""}
                        `}
                      >
                        <span className={`
                          text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full leading-none shrink-0
                          ${isToday ? "bg-primary text-on-primary font-bold" : ""}
                          ${isSelected && !isToday ? "ring-2 ring-primary text-primary" : ""}
                          ${!isToday && !isSelected ? (cell.currentMonth ? "text-on-surface" : "text-on-surface-variant/40") : ""}
                        `}>
                          {cell.day}
                        </span>
                        <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                          {cellEvents.slice(0, 2).map(ev => (
                            <span
                              key={ev.id}
                              className={`truncate text-[9px] font-medium px-0.5 py-0.5 rounded leading-tight
                                ${ev.source === "google" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
                            >
                              {ev.title.replace(/^Appointment:\s*/, "")}
                            </span>
                          ))}
                          {cellEvents.length > 2 && (
                            <span className="text-[9px] text-on-surface-variant/60">+{cellEvents.length - 2}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-2 shrink-0">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-amber-100 border border-amber-300" />
                <span className="text-[10px] text-on-surface-variant/60">FlashBooker</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-blue-100 border border-blue-300" />
                <span className="text-[10px] text-on-surface-variant/60">Google Calendar</span>
              </div>
            </div>
          </div>

          {/* ── Right: form + day detail ── */}
          <div className="w-64 shrink-0 flex flex-col overflow-y-auto">
            <div className="flex-1 p-4 space-y-4">

              {/* Selected date heading */}
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1">
                  Selected date
                </p>
                {date ? (
                  <p className="text-sm font-semibold text-on-surface leading-tight">
                    {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                      weekday: "short", month: "long", day: "numeric",
                    })}
                  </p>
                ) : (
                  <div className="flex items-center gap-1.5 text-on-surface-variant/50">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <p className="text-xs">Pick a day on the calendar</p>
                  </div>
                )}
              </div>

              {/* Events on selected day */}
              {date && selectedDayEvents.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">
                    {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? "s" : ""} this day
                  </p>
                  {selectedDayEvents.map(ev => (
                    <div
                      key={ev.id}
                      className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border text-xs
                        ${ev.source === "flashbook" ? "bg-amber-500/5 border-amber-500/20" : "bg-blue-500/5 border-blue-500/20"}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0
                        ${ev.source === "flashbook" ? "bg-amber-500" : "bg-blue-500"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-on-surface truncate">
                          {ev.title.replace(/^Appointment:\s*/, "")}
                        </p>
                        <p className="text-on-surface-variant/70 mt-0.5">
                          {formatTime(ev.start)}{ev.end ? ` – ${formatTime(ev.end)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Time overlap warning */}
              {originalOverlap && (
                <div className="flex items-start gap-2 rounded-lg bg-surface-container border border-outline-variant/30 px-2.5 py-2">
                  <CalendarDays className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
                  <p className="text-xs text-on-surface-variant">
                    Original time: {formatTime(originalOverlap.start)}
                    {originalOverlap.end ? ` – ${formatTime(originalOverlap.end)}` : ""}
                  </p>
                </div>
              )}
              {timeOverlaps.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    {timeOverlaps.length === 1
                      ? `"${timeOverlaps[0].title.replace(/^Appointment:\s*/, "")}" overlaps this time slot.`
                      : `${timeOverlaps.length} events overlap this time slot.`}
                    {" "}You can still schedule, but this may cause a conflict.
                  </p>
                </div>
              )}

              {/* Time */}
              <div>
                <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide block mb-1.5">
                  Time
                </label>
                <TimeSelect value={time} onChange={setTime} className="w-full" />
              </div>

              {/* Duration */}
              <div>
                <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide block mb-1.5">
                  Duration
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                        duration === opt.value
                          ? "bg-on-surface text-surface border-on-surface"
                          : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {calendarSyncEnabled && (
                <p className="text-[11px] text-on-surface-variant bg-surface-container-low rounded-lg px-2.5 py-2 leading-relaxed">
                  Google Calendar connected —{" "}
                  {isEdit ? "event will update." : "event will be created."}
                </p>
              )}
            </div>

            {/* Right panel footer */}
            <div className="px-4 pb-4 pt-2 border-t border-outline-variant/10 space-y-2 shrink-0">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!date || saving}
                className="w-full py-2.5 text-sm font-medium rounded-xl bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {saving ? "Saving…" : isEdit ? "Save" : "Confirm Appointment"}
              </button>
              <div className="flex items-center justify-between">
                {onSkip ? (
                  <button type="button" onClick={onSkip} className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors underline underline-offset-2">
                    skip
                  </button>
                ) : <span />}
                <button type="button" onClick={onClose} className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
