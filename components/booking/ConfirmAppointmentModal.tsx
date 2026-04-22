"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  bookingId: string;
  calendarSyncEnabled: boolean;
  initialAppointmentDate?: string; // ISO — pre-populates fields in edit mode
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

function parseInitial(iso?: string) {
  if (!iso) return { date: "", time: "10:00" };
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const time = d.toTimeString().slice(0, 5);  // HH:MM
  return { date, time };
}

export function ConfirmAppointmentModal({
  bookingId, calendarSyncEnabled, initialAppointmentDate, onConfirmed, onSkip, onClose,
}: Props) {
  const isEdit = !!initialAppointmentDate;
  const initial = parseInitial(initialAppointmentDate);

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(120);
  const [saving, setSaving] = useState(false);

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
        className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-sm p-6"
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
          <p className="text-sm text-on-surface-variant mb-6">
            Set the appointment date and time. This will move the booking to Booked.
          </p>
        )}

        <div className={`space-y-4 ${isEdit ? "mt-4" : ""} mb-4`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide block mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-surface-container-low border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide block mb-1.5">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-surface-container-low border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:border-primary"
              />
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
