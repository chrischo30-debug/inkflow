"use client";

import { useState } from "react";
import { Check } from "lucide-react";

type Key = "notify_new_submission" | "notify_new_booking" | "notify_reschedule" | "notify_contact_form";
type SaveStatus = "idle" | "saving" | "saved" | "error";

const ROWS: { key: Key; title: string; description: string }[] = [
  {
    key: "notify_new_submission",
    title: "New booking submission",
    description: "When a client submits the public booking form.",
  },
  {
    key: "notify_new_booking",
    title: "New scheduled appointment",
    description: "When a client picks a slot from a scheduling link you sent.",
  },
  {
    key: "notify_reschedule",
    title: "Appointment rescheduled",
    description: "When you move an existing booked appointment to a new time.",
  },
  {
    key: "notify_contact_form",
    title: "Contact form submission",
    description: "When someone fills out your contact form (shown when books are closed).",
  },
];

export function AdminEmailSettings({
  initial,
}: {
  initial: Record<Key, boolean>;
}) {
  const [values, setValues] = useState<Record<Key, boolean>>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const save = async (next: Partial<Record<Key, boolean>>) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/artist/admin-emails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setStatus(res.ok ? "saved" : "error");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  const toggle = (key: Key) => {
    const next = !values[key];
    setValues(prev => ({ ...prev, [key]: next }));
    save({ [key]: next });
  };

  return (
    <div className="rounded-xl border border-outline-variant/20 p-5 space-y-3">
      <div className="divide-y divide-outline-variant/15">
        {ROWS.map(row => {
          const on = values[row.key];
          return (
            <div key={row.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-base font-medium text-on-surface">{row.title}</p>
                <p className="text-sm text-on-surface-variant mt-1">{row.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(row.key)}
                className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  on ? "bg-primary" : "bg-outline-variant/40"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          );
        })}
      </div>

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
