"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddEventModalProps {
  initialDate?: string; // "YYYY-MM-DD"
  onClose: () => void;
  onCreated: () => void;
}

function toLocalDatetimeValue(date: string, time: string) {
  return `${date}T${time}`;
}

function toISO(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

export function AddEventModal({ initialDate, onClose, onCreated }: AddEventModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate ?? today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  // Auto-advance end time when start changes
  const handleStartChange = (val: string) => {
    setStartTime(val);
    const [h, m] = val.split(":").map(Number);
    const end = new Date(0, 0, 0, h + 1, m);
    setEndTime(`${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (startTime >= endTime) { setError("End time must be after start time."); return; }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          startDateTime: toISO(date, startTime),
          endDateTime: toISO(date, endTime),
        }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? "Failed to create event."); return; }
      onCreated();
      onClose();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-2xl border border-outline-variant/20 shadow-2xl p-6 space-y-5">

        <div className="flex items-center justify-between">
          <h2 className="text-base font-heading font-semibold text-on-surface">New Event</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">Title</label>
            <Input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Blocked, Flash day, Consultation…"
              className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 focus-visible:ring-0 focus-visible:border-primary shadow-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">Date</label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 focus-visible:ring-0 focus-visible:border-primary shadow-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-on-surface-variant">Start time</label>
              <Input
                type="time"
                value={startTime}
                onChange={e => handleStartChange(e.target.value)}
                className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 focus-visible:ring-0 focus-visible:border-primary shadow-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-on-surface-variant">End time</label>
              <Input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 focus-visible:ring-0 focus-visible:border-primary shadow-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">Description <span className="text-on-surface-variant/50">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Notes about this block…"
              className="w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-3 text-sm text-on-surface placeholder:text-[#888888] resize-none focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-auto py-3 text-sm font-medium rounded-xl bg-on-surface text-surface hover:opacity-80 transition-opacity"
          >
            {saving ? "Adding…" : "Add to Calendar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
