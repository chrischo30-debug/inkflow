"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Check, Copy, ExternalLink, Pencil } from "lucide-react";
import type { SchedulingLink } from "@/lib/pipeline-settings";

const DURATIONS = [
  { label: "1 hr",     minutes: 60  },
  { label: "1.5 hrs",  minutes: 90  },
  { label: "2 hrs",    minutes: 120 },
  { label: "2.5 hrs",  minutes: 150 },
  { label: "3 hrs",    minutes: 180 },
  { label: "3.5 hrs",  minutes: 210 },
  { label: "4 hrs",    minutes: 240 },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOURS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6;
  const label = h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`;
  return { label, value: h };
});

const TIMEZONES = [
  { label: "Eastern (ET)",   value: "America/New_York"    },
  { label: "Central (CT)",   value: "America/Chicago"     },
  { label: "Mountain (MT)",  value: "America/Denver"      },
  { label: "Pacific (PT)",   value: "America/Los_Angeles" },
  { label: "Arizona (AZ)",   value: "America/Phoenix"     },
  { label: "Alaska (AKT)",   value: "America/Anchorage"   },
  { label: "Hawaii (HST)",   value: "Pacific/Honolulu"    },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface CalendarOption {
  id: string;
  summary: string;
  primary: boolean;
  color: string;
}

type DraftLink = Omit<SchedulingLink, "id">;

function newLinkDefaults(): DraftLink {
  return {
    label: "",
    duration_minutes: 120,
    days: [1, 2, 3, 4, 5],
    start_hour: 10,
    end_hour: 19,
    timezone: "America/New_York",
    calendar_ids: [],
  };
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function LinkForm({
  draft,
  setDraft,
  calendarOptions,
  calendarsLoading,
  isCalendarConnected,
  onSave,
  onCancel,
  saveLabel,
  canSave,
}: {
  draft: DraftLink;
  setDraft: (fn: (prev: DraftLink) => DraftLink) => void;
  calendarOptions: CalendarOption[];
  calendarsLoading: boolean;
  isCalendarConnected: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  canSave: boolean;
}) {
  const toggleDay = (d: number) =>
    setDraft(prev => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d].sort(),
    }));

  const toggleCalendar = (id: string) =>
    setDraft(prev => {
      const ids = prev.calendar_ids ?? [];
      return {
        ...prev,
        calendar_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
      };
    });

  const selectedIds = draft.calendar_ids ?? [];

  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 space-y-4">
      {/* Label */}
      <div>
        <label className="text-xs font-medium text-on-surface-variant block mb-1">Link name</label>
        <input
          type="text"
          placeholder='e.g. "2-Hour Tattoo Session"'
          value={draft.label}
          onChange={e => setDraft(prev => ({ ...prev, label: e.target.value }))}
          className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
        />
      </div>

      {/* Duration */}
      <div>
        <label className="text-xs font-medium text-on-surface-variant block mb-1">Session duration</label>
        <select
          value={draft.duration_minutes}
          onChange={e => setDraft(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
          className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
        >
          {DURATIONS.map(d => (
            <option key={d.minutes} value={d.minutes}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Days */}
      <div>
        <label className="text-xs font-medium text-on-surface-variant block mb-2">Available days</label>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                draft.days.includes(i)
                  ? "bg-on-surface text-surface border-on-surface"
                  : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hours */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-on-surface-variant block mb-1">Earliest start</label>
          <select
            value={draft.start_hour}
            onChange={e => setDraft(prev => ({ ...prev, start_hour: Number(e.target.value) }))}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
          >
            {HOURS.slice(0, -1).map(h => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-on-surface-variant block mb-1">Latest end</label>
          <select
            value={draft.end_hour}
            onChange={e => setDraft(prev => ({ ...prev, end_hour: Number(e.target.value) }))}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
          >
            {HOURS.slice(1).map(h => (
              <option key={h.value} value={h.value} disabled={h.value <= draft.start_hour}>{h.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="text-xs font-medium text-on-surface-variant block mb-1">Timezone</label>
        <select
          value={draft.timezone}
          onChange={e => setDraft(prev => ({ ...prev, timezone: e.target.value }))}
          className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
        >
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>

      {/* Calendar picker — only shown when Google Calendar is connected */}
      {isCalendarConnected && (
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1">
            Check availability against
          </label>
          {calendarsLoading ? (
            <p className="text-xs text-on-surface-variant/60 py-1">Loading calendars…</p>
          ) : calendarOptions.length === 0 ? (
            <p className="text-xs text-on-surface-variant/60 py-1">No calendars found.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {/* All calendars option */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                    selectedIds.length === 0
                      ? "bg-on-surface border-on-surface"
                      : "border-outline-variant/50 group-hover:border-on-surface-variant"
                  }`}
                  onClick={() => setDraft(prev => ({ ...prev, calendar_ids: [] }))}
                >
                  {selectedIds.length === 0 && <Check className="w-2.5 h-2.5 text-surface" />}
                </div>
                <span
                  className="text-xs text-on-surface font-medium select-none"
                  onClick={() => setDraft(prev => ({ ...prev, calendar_ids: [] }))}
                >
                  All calendars
                </span>
              </label>

              <div className="border-t border-outline-variant/15 pt-2 space-y-2">
                {calendarOptions.map(cal => {
                  const checked = selectedIds.includes(cal.id);
                  return (
                    <label key={cal.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          checked
                            ? "border-on-surface bg-on-surface"
                            : "border-outline-variant/50 group-hover:border-on-surface-variant"
                        }`}
                        onClick={() => toggleCalendar(cal.id)}
                      >
                        {checked && <Check className="w-2.5 h-2.5 text-surface" />}
                      </div>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: cal.color }}
                      />
                      <span
                        className="text-xs text-on-surface select-none"
                        onClick={() => toggleCalendar(cal.id)}
                      >
                        {cal.summary}
                        {cal.primary && <span className="text-on-surface-variant ml-1">(primary)</span>}
                      </span>
                    </label>
                  );
                })}
              </div>

              {selectedIds.length > 0 && (
                <p className="text-[10px] text-on-surface-variant/60 pt-0.5">
                  Only the selected calendars will be checked for conflicts.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          style={{ background: "#000", color: "#fff", opacity: canSave ? 1 : 0.35 }}
          className="px-4 py-2.5 text-sm font-medium rounded-lg transition-opacity"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export function SchedulingLinksSettings({
  initialLinks,
  artistId,
  isCalendarConnected,
}: {
  initialLinks: SchedulingLink[];
  artistId: string;
  isCalendarConnected: boolean;
}) {
  const [links, setLinks] = useState<SchedulingLink[]>(initialLinks);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<DraftLink>(newLinkDefaults());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftLink>(newLinkDefaults());
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [copied, setCopied] = useState<string | null>(null);
  const [calendarOptions, setCalendarOptions] = useState<CalendarOption[]>([]);
  const [calendarsLoading, setCalendarsLoading] = useState(false);

  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!isCalendarConnected) return;
    setCalendarsLoading(true);
    fetch("/api/artist/calendar-list")
      .then(r => r.json())
      .then((d: { calendars?: CalendarOption[] }) => setCalendarOptions(d.calendars ?? []))
      .catch(() => {})
      .finally(() => setCalendarsLoading(false));
  }, [isCalendarConnected]);

  const persist = async (updated: SchedulingLink[]) => {
    setStatus("saving");
    const res = await fetch("/api/artist/scheduling-links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links: updated }),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addLink = () => {
    if (!addDraft.label.trim()) return;
    const newLink: SchedulingLink = { ...addDraft, id: generateId(), label: addDraft.label.trim() };
    const updated = [...links, newLink];
    setLinks(updated);
    setAddDraft(newLinkDefaults());
    setAdding(false);
    persist(updated);
  };

  const startEdit = (link: SchedulingLink) => {
    setAdding(false);
    setEditingId(link.id);
    setEditDraft({
      label: link.label,
      duration_minutes: link.duration_minutes,
      days: link.days,
      start_hour: link.start_hour,
      end_hour: link.end_hour,
      timezone: link.timezone,
      calendar_ids: link.calendar_ids ?? [],
    });
  };

  const saveEdit = () => {
    if (!editingId || !editDraft.label.trim()) return;
    const updated = links.map(l =>
      l.id === editingId ? { ...editDraft, id: editingId, label: editDraft.label.trim() } : l
    );
    setLinks(updated);
    setEditingId(null);
    persist(updated);
  };

  const removeLink = (id: string) => {
    const updated = links.filter(l => l.id !== id);
    setLinks(updated);
    persist(updated);
  };

  const copyUrl = (id: string) => {
    navigator.clipboard.writeText(`${origin}/schedule/${artistId}/${id}`).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const durationLabel = (minutes: number) =>
    DURATIONS.find(d => d.minutes === minutes)?.label ?? `${minutes / 60} hrs`;

  const hourLabel = (h: number) =>
    HOURS.find(x => x.value === h)?.label ?? `${h}:00`;

  const canAdd = addDraft.label.trim().length > 0 && addDraft.days.length > 0 && addDraft.start_hour < addDraft.end_hour;
  const canSaveEdit = editDraft.label.trim().length > 0 && editDraft.days.length > 0 && editDraft.start_hour < editDraft.end_hour;

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-on-surface">Scheduling Links</h3>
        {status === "saved" && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
        {status === "error" && <span className="text-xs text-red-500">Failed to save</span>}
      </div>
      <p className="text-xs text-on-surface-variant mb-4">
        Create a scheduling link to send clients after payment. They pick an open slot based on your Google Calendar availability.
      </p>

      <div className="space-y-2 mb-3">
        {links.length === 0 && !adding && (
          <p className="text-xs text-on-surface-variant/60 py-2">No scheduling links yet.</p>
        )}
        {links.map(link => {
          const url = `${origin}/schedule/${artistId}/${link.id}`;
          const isCopied = copied === link.id;
          const isEditing = editingId === link.id;

          if (isEditing) {
            return (
              <LinkForm
                key={link.id}
                draft={editDraft}
                setDraft={setEditDraft}
                calendarOptions={calendarOptions}
                calendarsLoading={calendarsLoading}
                isCalendarConnected={isCalendarConnected}
                onSave={saveEdit}
                onCancel={() => setEditingId(null)}
                saveLabel="Save changes"
                canSave={canSaveEdit}
              />
            );
          }

          const calSummary = (() => {
            const ids = link.calendar_ids ?? [];
            if (!isCalendarConnected || ids.length === 0) return null;
            if (ids.length === 1) {
              const cal = calendarOptions.find(c => c.id === ids[0]);
              return cal ? cal.summary : "1 calendar";
            }
            return `${ids.length} calendars`;
          })();

          return (
            <div key={link.id} className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-on-surface">{link.label}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {durationLabel(link.duration_minutes)} · {link.days.map(d => DAY_LABELS[d]).join(", ")} · {hourLabel(link.start_hour)}–{hourLabel(link.end_hour)}
                    {calSummary && <span className="text-on-surface-variant/60"> · {calSummary}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(link)}
                  className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => copyUrl(link.id)}
                  className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
                  title="Copy link"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
                  title="Open link"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => removeLink(link.id)}
                  className="p-1 text-on-surface-variant hover:text-destructive transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant/50 mt-1.5 truncate font-mono">{url}</p>
            </div>
          );
        })}
      </div>

      {adding ? (
        <LinkForm
          draft={addDraft}
          setDraft={setAddDraft}
          calendarOptions={calendarOptions}
          calendarsLoading={calendarsLoading}
          isCalendarConnected={isCalendarConnected}
          onSave={addLink}
          onCancel={() => { setAdding(false); setAddDraft(newLinkDefaults()); }}
          saveLabel="Create link"
          canSave={canAdd}
        />
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setEditingId(null); setAdding(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New link
          </button>
        </div>
      )}
    </div>
  );
}
