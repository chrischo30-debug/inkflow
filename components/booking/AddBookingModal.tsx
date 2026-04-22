"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const BOOKING_STATES = [
  { value: "inquiry",   label: "Submission" },
  { value: "follow_up", label: "Follow Ups" },
  { value: "accepted",  label: "Accepted" },
  { value: "confirmed", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "rejected",  label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const BLANK = {
  client_name: "", client_email: "", client_phone: "",
  description: "", size: "", placement: "", budget: "",
  state: "inquiry", appointment_date: "",
};

export function AddBookingModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const set = (k: keyof typeof BLANK, v: string) => setForm(f => ({ ...f, [k]: v }));

  const close = () => { setOpen(false); setForm(BLANK); setError(null); };

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
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3.5 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
      >
        + Add booking
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
          onClick={close}
        >
          <div
            className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              {/* Sticky header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface">
                <h2 className="text-base font-semibold text-on-surface">Add booking</h2>
                <button type="button" onClick={close} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="px-6 py-5 space-y-4">
                <BookingFormFields form={form} set={set} />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              {/* Sticky footer */}
              <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20 bg-surface">
                <button
                  type="button"
                  onClick={close}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Add booking"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
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
      <Field label="Appointment date" value={form.appointment_date} onChange={v => set("appointment_date", v)} type="datetime-local" />
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
