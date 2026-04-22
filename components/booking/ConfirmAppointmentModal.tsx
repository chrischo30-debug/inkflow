"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

interface ExistingAppointment {
  appointment_date: string;
  client_name: string;
}

interface Props {
  bookingId: string;
  calendarSyncEnabled: boolean;
  initialAppointmentDate?: string; // ISO — pre-populates fields in edit mode
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
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function parseInitial(iso?: string) {
  if (!iso) return { date: "", time: "10:00" };
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const time = d.toTimeString().slice(0, 5);  // HH:MM
  return { date, time };
}

function MiniCalendar({
  value,
  onChange,
  existingAppointments = [],
}: {
  value: string;
  onChange: (v: string) => void;
  existingAppointments?: ExistingAppointment[];
}) {
  const today = new Date();
  const seed = value ? new Date(value + "T12:00:00") : today;
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Map of date string → list of client names booked that day
  const busyDays = new Map<string, string[]>();
  for (const appt of existingAppointments) {
    const day = appt.appointment_date.slice(0, 10);
    const existing = busyDays.get(day) ?? [];
    busyDays.set(day, [...existing, appt.client_name]);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = today.toLocaleDateString("en-CA");

  const cells: { dateStr: string; day: number; thisMonth: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) {
    const d = new Date(viewYear, viewMonth, i - firstDay + 1);
    cells.push({ dateStr: d.toLocaleDateString("en-CA"), day: d.getDate(), thisMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(viewYear, viewMonth, d);
    cells.push({ dateStr: dt.toLocaleDateString("en-CA"), day: dt.getDate(), thisMonth: true });
  }
  let trailing = 1;
  while (cells.length % 7 !== 0) {
    const dt = new Date(viewYear, viewMonth + 1, trailing++);
    cells.push({ dateStr: dt.toLocaleDateString("en-CA"), day: dt.getDate(), thisMonth: false });
  }

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-semibold text-on-surface">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-on-surface-variant/50 py-0.5">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ dateStr, day, thisMonth }) => {
          const isSelected = dateStr === value;
          const isToday = dateStr === todayStr;
          const busyClients = busyDays.get(dateStr);
          const isBusy = !!busyClients;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onChange(dateStr)}
              title={isBusy ? `Booked: ${busyClients!.join(", ")}` : undefined}
              className={`relative h-8 w-8 mx-auto rounded-full text-xs font-medium transition-colors flex flex-col items-center justify-center
                ${isSelected ? "bg-on-surface text-surface" : ""}
                ${!isSelected && isToday ? "text-primary font-bold" : ""}
                ${!isSelected && thisMonth && !isToday ? "text-on-surface hover:bg-surface-container-highest" : ""}
                ${!isSelected && !thisMonth ? "text-on-surface-variant/30" : ""}
              `}
            >
              <span className={isSelected ? "-mt-0.5" : ""}>{day}</span>
              {/* Busy indicator dot */}
              {isBusy && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500" />
              )}
              {isBusy && isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-300" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {busyDays.size > 0 && (
        <div className="mt-2 pt-2 border-t border-outline-variant/10 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-[10px] text-on-surface-variant/70">Already booked</span>
        </div>
      )}
    </div>
  );
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

  // Clients already booked on the selected day (excluding self)
  const conflictsOnDate = date
    ? existingAppointments.filter(a => a.appointment_date.slice(0, 10) === date)
    : [];

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
        className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-on-surface">
            {isEdit ? "Edit Appointment" : "Confirm Appointment"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {!isEdit && (
          <p className="text-sm text-on-surface-variant mb-4">
            Set the appointment date and time. This will move the booking to Booked.
          </p>
        )}

        <div className={`space-y-4 ${isEdit ? "mt-4" : ""} mb-4`}>
          {/* Inline calendar */}
          <MiniCalendar value={date} onChange={setDate} existingAppointments={existingAppointments} />

          {/* Conflict warning */}
          {conflictsOnDate.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Already booked this day</p>
                <p className="text-xs text-amber-700/80 mt-0.5">
                  {conflictsOnDate.map(a => a.client_name).join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Time + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide block mb-1.5">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-surface-container-low border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide block mb-1.5">
                {date ? new Date(date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Date"}
              </label>
              <div className="px-3 py-2.5 text-sm bg-surface-container-low border border-outline-variant/30 rounded-lg text-on-surface-variant">
                {date ? new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "Select on calendar"}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide block mb-1.5">Duration</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
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
          <p className="text-xs text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2.5 mb-4">
            Google Calendar is connected — {isEdit ? "the event will be updated automatically." : "an event will be created automatically."}
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
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
