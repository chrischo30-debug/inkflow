"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

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
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function parseInitial(iso?: string) {
  if (!iso) return { date: "", time: "10:00" };
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA");
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
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

  // Calendar view state — seed from selected date or today
  const today = new Date();
  const seed = date ? new Date(date + "T12:00:00") : today;
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());

  // Events: start with existingAppointments for immediate display, then replace with API data
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
    } catch {
      // Keep pre-loaded existingAppointments as fallback
    } finally {
      setLoadingEvents(false);
    }
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

  // Build 6-row grid (42 cells)
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
  const flashbookConflicts = selectedDayEvents.filter(e => e.source === "flashbook");

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
        className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">

          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button type="button" onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-on-surface">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="rounded-xl border border-outline-variant/20 overflow-hidden">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-outline-variant/20 bg-surface-container-low">
              {WEEKDAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-medium text-on-surface-variant">{d}</div>
              ))}
            </div>

            {/* Cells */}
            {loadingEvents ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className={`min-h-[72px] p-1.5 ${i % 7 !== 6 ? "border-r" : ""} ${i < 28 ? "border-b" : ""} border-outline-variant/10 animate-pulse bg-surface-container/20`} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7">
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
                        relative min-h-[72px] p-1.5 text-left flex flex-col gap-0.5 transition-colors
                        ${i % 7 !== 6 ? "border-r border-outline-variant/10" : ""}
                        ${!isLastRow ? "border-b border-outline-variant/10" : ""}
                        ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-surface-container-low"}
                        ${!cell.currentMonth && !isSelected ? "bg-surface-container/30" : ""}
                      `}
                    >
                      <span className={`
                        text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full leading-none shrink-0
                        ${isToday ? "bg-primary text-on-primary font-bold" : ""}
                        ${isSelected && !isToday ? "ring-2 ring-primary text-primary" : ""}
                        ${!isToday && !isSelected ? (cell.currentMonth ? "text-on-surface" : "text-on-surface-variant/40") : ""}
                      `}>
                        {cell.day}
                      </span>

                      {/* Event pills — up to 2 then +N */}
                      <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                        {cellEvents.slice(0, 2).map(ev => (
                          <span
                            key={ev.id}
                            className={`truncate text-[10px] font-medium px-1 py-0.5 rounded leading-tight
                              ${ev.source === "google"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                              }`}
                          >
                            {formatTime(ev.start)} {ev.title.replace(/^Appointment:\s*/, "")}
                          </span>
                        ))}
                        {cellEvents.length > 2 && (
                          <span className="text-[10px] text-on-surface-variant px-0.5">
                            +{cellEvents.length - 2} more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] text-on-surface-variant/70">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" />
              <span>FlashBook appointment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300" />
              <span>Google Calendar</span>
            </div>
          </div>

          {/* Selected day details */}
          {date && (
            <div className="space-y-3 pt-1 border-t border-outline-variant/10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-on-surface">
                  {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
                {selectedDayEvents.length > 0 && (
                  <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                    {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Events on this day */}
              {selectedDayEvents.length > 0 && (
                <div className="space-y-1.5">
                  {selectedDayEvents.map(ev => (
                    <div
                      key={ev.id}
                      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border
                        ${ev.source === "flashbook"
                          ? "bg-amber-500/5 border-amber-500/20"
                          : "bg-blue-500/5 border-blue-500/20"
                        }`}
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0
                        ${ev.source === "flashbook" ? "bg-amber-500" : "bg-blue-500"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-on-surface">
                          {ev.title.replace(/^Appointment:\s*/, "")}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {formatTime(ev.start)}{ev.end ? ` – ${formatTime(ev.end)}` : ""}
                          <span className="ml-2 opacity-60">
                            {ev.source === "google" ? "Google Calendar" : "FlashBook booking"}
                          </span>
                        </p>
                      </div>
                      {ev.link && (
                        <a href={ev.link} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-primary hover:underline">
                          Open ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Conflict warning */}
              {flashbookConflicts.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-amber-700">
                    {flashbookConflicts.length === 1
                      ? "Another booking is already scheduled on this day."
                      : `${flashbookConflicts.length} bookings are already scheduled on this day.`
                    }
                    {" "}Only proceed if times don't overlap.
                  </p>
                </div>
              )}

              {/* Time + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide block mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-surface-container-low border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide block mb-1.5">
                    Duration
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDuration(opt.value)}
                        className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
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
              </div>

              {calendarSyncEnabled && (
                <p className="text-xs text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2.5">
                  Google Calendar is connected — {isEdit ? "the event will be updated." : "an event will be created."}
                </p>
              )}
            </div>
          )}

          {/* Prompt when no date selected */}
          {!date && (
            <p className="text-sm text-on-surface-variant/60 text-center py-2">
              Click a day above to select the appointment date.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between shrink-0">
          {onSkip ? (
            <button type="button" onClick={onSkip} className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors underline underline-offset-2">
              skip
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!date || saving}
              className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving…" : isEdit ? "Save" : "Confirm Appointment"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
