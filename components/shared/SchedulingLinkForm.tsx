"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import type { SchedulingLink } from "@/lib/pipeline-settings";
import { DEFAULT_CONFIRMATION_MESSAGE } from "@/lib/pipeline-settings";

export const DURATIONS = [
  { label: "1 hr", minutes: 60 }, { label: "1.5 hrs", minutes: 90 },
  { label: "2 hrs", minutes: 120 }, { label: "2.5 hrs", minutes: 150 },
  { label: "3 hrs", minutes: 180 }, { label: "3.5 hrs", minutes: 210 },
  { label: "4 hrs", minutes: 240 },
];
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const HOURS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6;
  return { label: h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`, value: h };
});
export const TIMEZONES = [
  { label: "Eastern (ET)", value: "America/New_York" },
  { label: "Central (CT)", value: "America/Chicago" },
  { label: "Mountain (MT)", value: "America/Denver" },
  { label: "Pacific (PT)", value: "America/Los_Angeles" },
  { label: "Arizona (AZ)", value: "America/Phoenix" },
  { label: "Alaska (AKT)", value: "America/Anchorage" },
  { label: "Hawaii (HST)", value: "Pacific/Honolulu" },
];

export const BUFFER_OPTIONS = [
  { label: "None", minutes: 0 },
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
];

export const HALF_DAY_OPTIONS = [
  { label: "3 hrs", minutes: 180 },
  { label: "4 hrs", minutes: 240 },
  { label: "5 hrs", minutes: 300 },
  { label: "6 hrs", minutes: 360 },
];

export function generateId() { return Math.random().toString(36).slice(2, 10); }

export function newLinkDraft(): Omit<SchedulingLink, "id"> {
  return {
    label: "",
    duration_minutes: 120,
    days: [1, 2, 3, 4, 5],
    start_hour: 10,
    end_hour: 19,
    timezone: "America/New_York",
    block_full_day: false,
    confirmation_message: DEFAULT_CONFIRMATION_MESSAGE,
    buffer_minutes: 0,
    is_half_day: false,
    half_day_minutes: 240,
    half_day_followup_minutes: [],
  };
}

export interface CalendarOption { id: string; summary: string; primary: boolean; color: string; }

export type LinkDraft = Omit<SchedulingLink, "id">;

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} role="switch" aria-checked={on}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? "bg-on-surface" : "bg-outline-variant/40"}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export function SchedulingLinkForm({
  draft,
  setDraft,
  isCalendarConnected,
  calendarOptions,
  calendarsLoading,
}: {
  draft: LinkDraft;
  setDraft: (updater: (prev: LinkDraft) => LinkDraft) => void;
  isCalendarConnected: boolean;
  calendarOptions: CalendarOption[];
  calendarsLoading: boolean;
}) {
  const toggleDay = (d: number) =>
    setDraft(prev => ({ ...prev, days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d].sort() }));
  const toggleCalendar = (id: string) =>
    setDraft(prev => { const ids = prev.calendar_ids ?? []; return { ...prev, calendar_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }; });
  const toggleFollowup = (mins: number) =>
    setDraft(prev => {
      const cur = prev.half_day_followup_minutes ?? [];
      return { ...prev, half_day_followup_minutes: cur.includes(mins) ? cur.filter(x => x !== mins) : [...cur, mins].sort((a, b) => a - b) };
    });

  const isHalfDay = !!draft.is_half_day;

  return (
    <>
      <div>
        <label className="text-xs font-medium text-on-surface-variant block mb-1">Link name</label>
        <input type="text" value={draft.label} onChange={e => setDraft(prev => ({ ...prev, label: e.target.value }))}
          placeholder='e.g. "2-Hour Tattoo Session"'
          className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]" />
      </div>

      <div className="flex items-center justify-between gap-4 py-1 border-t border-outline-variant/15">
        <div>
          <p className="text-sm font-medium text-on-surface">Half-day session</p>
          <p className="text-xs text-on-surface-variant">Offer one long session, with optional shorter follow-ups after</p>
        </div>
        <Toggle on={isHalfDay} onToggle={() => setDraft(prev => ({ ...prev, is_half_day: !prev.is_half_day }))} />
      </div>

      {!isHalfDay ? (
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1">Session duration</label>
          <select value={draft.duration_minutes} onChange={e => setDraft(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
            {DURATIONS.map(d => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
          </select>
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1">Half-day duration</label>
            <select value={draft.half_day_minutes ?? 240} onChange={e => setDraft(prev => ({ ...prev, half_day_minutes: Number(e.target.value) }))}
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
              {HALF_DAY_OPTIONS.map(d => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-2">Allow these follow-up sessions on the same day</label>
            <div className="flex gap-1.5 flex-wrap">
              {DURATIONS.map(opt => {
                const active = (draft.half_day_followup_minutes ?? []).includes(opt.minutes);
                return (
                  <button key={opt.minutes} type="button" onClick={() => toggleFollowup(opt.minutes)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? "bg-on-surface text-surface border-on-surface" : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-on-surface-variant/70 mt-1.5">
              {(draft.half_day_followup_minutes ?? []).length === 0
                ? "No follow-ups — the rest of the day is closed once a half-day is booked."
                : "Clients can book one of the selected durations after the half-day ends."}
            </p>
          </div>
        </>
      )}

      <div>
        <label className="text-xs font-medium text-on-surface-variant block mb-2">Buffer after each appointment</label>
        <div className="flex gap-1.5">
          {BUFFER_OPTIONS.map(opt => {
            const active = (draft.buffer_minutes ?? 0) === opt.minutes;
            return (
              <button key={opt.minutes} type="button" onClick={() => setDraft(prev => ({ ...prev, buffer_minutes: opt.minutes }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? "bg-on-surface text-surface border-on-surface" : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-on-surface-variant block mb-2">Available days</label>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_LABELS.map((label, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${draft.days.includes(i) ? "bg-on-surface text-surface border-on-surface" : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-on-surface-variant block mb-1">Earliest start</label>
          <select value={draft.start_hour} onChange={e => setDraft(prev => ({ ...prev, start_hour: Number(e.target.value) }))}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
            {HOURS.slice(0, -1).map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-on-surface-variant block mb-1">Latest end</label>
          <select value={draft.end_hour} onChange={e => setDraft(prev => ({ ...prev, end_hour: Number(e.target.value) }))}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
            {HOURS.slice(1).map(h => <option key={h.value} value={h.value} disabled={h.value <= draft.start_hour}>{h.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-on-surface-variant block mb-1">Timezone</label>
        <select value={draft.timezone} onChange={e => setDraft(prev => ({ ...prev, timezone: e.target.value }))}
          className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
          {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between gap-4 py-1 border-t border-outline-variant/15">
        <div>
          <p className="text-sm font-medium text-on-surface">Full-day sessions</p>
          <p className="text-sm text-on-surface-variant">Once a booking is confirmed for a day, hide all remaining slots</p>
        </div>
        <Toggle on={!!draft.block_full_day} onToggle={() => setDraft(prev => ({ ...prev, block_full_day: !prev.block_full_day }))} />
      </div>

      <div>
        <label className="text-xs font-medium text-on-surface-variant block mb-1">Confirmation message</label>
        <textarea value={draft.confirmation_message ?? ""} onChange={e => setDraft(prev => ({ ...prev, confirmation_message: e.target.value }))}
          rows={3} placeholder={DEFAULT_CONFIRMATION_MESSAGE}
          className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888] resize-none" />
      </div>

      {isCalendarConnected && (
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-2">Check availability against</label>
          {calendarsLoading ? (
            <p className="text-xs text-on-surface-variant/60">Loading calendars…</p>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => setDraft(prev => ({ ...prev, calendar_ids: [] }))}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${(draft.calendar_ids ?? []).length === 0 ? "bg-on-surface border-on-surface" : "border-outline-variant/50"}`}>
                  {(draft.calendar_ids ?? []).length === 0 && <Check className="w-2.5 h-2.5 text-surface" />}
                </div>
                <span className="text-xs text-on-surface font-medium select-none">All calendars</span>
              </label>
              {calendarOptions.length > 0 && (
                <div className="border-t border-outline-variant/15 pt-2 space-y-2">
                  {calendarOptions.map(cal => {
                    const checked = (draft.calendar_ids ?? []).includes(cal.id);
                    return (
                      <label key={cal.id} className="flex items-center gap-2.5 cursor-pointer" onClick={() => toggleCalendar(cal.id)}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-on-surface border-on-surface" : "border-outline-variant/50"}`}>
                          {checked && <Check className="w-2.5 h-2.5 text-surface" />}
                        </div>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cal.color }} />
                        <span className="text-xs text-on-surface select-none">{cal.summary}{cal.primary && <span className="text-on-surface-variant ml-1">(primary)</span>}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function useCalendarOptions(isCalendarConnected: boolean) {
  const [calendarOptions, setCalendarOptions] = useState<CalendarOption[]>([]);
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  useEffect(() => {
    if (!isCalendarConnected) return;
    setCalendarsLoading(true);
    fetch("/api/artist/calendar-list")
      .then(r => r.json())
      .then((d: { calendars?: CalendarOption[] }) => setCalendarOptions(d.calendars ?? []))
      .catch(() => {})
      .finally(() => setCalendarsLoading(false));
  }, [isCalendarConnected]);
  return { calendarOptions, calendarsLoading };
}
