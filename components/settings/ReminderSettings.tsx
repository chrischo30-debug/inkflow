"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const HOUR_OPTIONS = [
  { value: 2,  label: "2 hours before" },
  { value: 4,  label: "4 hours before" },
  { value: 8,  label: "8 hours before" },
  { value: 12, label: "12 hours before" },
  { value: 24, label: "24 hours before (1 day)" },
  { value: 48, label: "48 hours before (2 days)" },
  { value: 72, label: "72 hours before (3 days)" },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ReminderSettings({
  initialEnabled,
  initialHoursBefore,
}: {
  initialEnabled: boolean;
  initialHoursBefore: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [hoursBefore, setHoursBefore] = useState(initialHoursBefore);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const save = async (newEnabled: boolean, newHours: number) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/artist/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminder_enabled: newEnabled, reminder_hours_before: newHours }),
      });
      setStatus(res.ok ? "saved" : "error");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    save(next, hoursBefore);
  };

  const handleHoursChange = (val: number) => {
    setHoursBefore(val);
    if (enabled) save(enabled, val);
  };

  return (
    <div className="rounded-xl border border-outline-variant/20 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-medium text-on-surface">Appointment reminders</p>
          <p className="text-sm text-on-surface-variant mt-1">
            Automatically email clients a reminder before their appointment.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? "bg-primary" : "bg-outline-variant/40"
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {enabled && (
        <div>
          <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Send reminder</label>
          <select
            value={hoursBefore}
            onChange={e => handleHoursChange(Number(e.target.value))}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
          >
            {HOUR_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {status === "saved" && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-600">
          <Check className="w-3.5 h-3.5" /> Saved
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">Failed to save. Please try again.</p>
      )}
    </div>
  );
}
