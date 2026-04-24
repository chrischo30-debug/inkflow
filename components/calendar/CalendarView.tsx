"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft, X, Pencil } from "lucide-react";
import { BookingFormModal } from "@/components/booking/AddBookingModal";
import { TimeSelect } from "@/components/ui/TimeSelect";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  source: "google" | "flashbook";
  link?: string;
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAYS_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const START_HOUR = 7;
const END_HOUR = 24;
const PX_PER_HOUR = 64;
const PX_PER_MIN = PX_PER_HOUR / 60;
const TOTAL_HOURS = END_HOUR - START_HOUR;

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isAllDay(start: string): boolean {
  return !start.includes("T");
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function snapToQuarter(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

function isoToDateAndTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-CA"),
    time: d.toTimeString().slice(0, 5),
  };
}

type LayoutEvent = CalendarEvent & { left: number; width: number };

function layoutEvents(events: CalendarEvent[]): LayoutEvent[] {
  const timed = events.filter(e => !isAllDay(e.start));
  if (timed.length === 0) return [];

  const getEnd = (e: CalendarEvent) =>
    e.end ? new Date(e.end) : new Date(new Date(e.start).getTime() + 3_600_000);

  const overlaps = (a: CalendarEvent, b: CalendarEvent) => {
    const aS = new Date(a.start), aE = getEnd(a);
    const bS = new Date(b.start), bE = getEnd(b);
    return aS < bE && bS < aE;
  };

  const sorted = [...timed].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const colEnds: Date[] = [];
  const withCol: Array<CalendarEvent & { col: number }> = [];
  for (const ev of sorted) {
    const start = new Date(ev.start);
    const end = getEnd(ev);
    let col = -1;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= start) { col = c; colEnds[c] = end; break; }
    }
    if (col === -1) { col = colEnds.length; colEnds.push(end); }
    withCol.push({ ...ev, col });
  }

  return withCol.map(ev => {
    const groupMembers = withCol.filter(other => other.id === ev.id || overlaps(ev, other));
    const maxCol = Math.max(...groupMembers.map(e => e.col));
    const totalCols = maxCol + 1;
    return { ...ev, left: ev.col / totalCols, width: 1 / totalCols };
  });
}

// ── Edit event modal ──────────────────────────────────────────────────────────

function EditEventModal({
  event,
  onSave,
  onClose,
}: {
  event: CalendarEvent;
  onSave: (updated: { title: string; startDateTime: string; endDateTime: string }) => Promise<void>;
  onClose: () => void;
}) {
  const { date: initDate, time: initTime } = isoToDateAndTime(event.start);
  const endD = event.end ? isoToDateAndTime(event.end) : isoToDateAndTime(new Date(new Date(event.start).getTime() + 3_600_000).toISOString());

  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(initDate);
  const [startTime, setStartTime] = useState(initTime);
  const [endTime, setEndTime] = useState(endD.time);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    if (!date || !startTime || !endTime) { setError("Please fill in all fields."); return; }
    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();
    if (new Date(endDateTime) <= new Date(startDateTime)) { setError("End time must be after start time."); return; }
    setSaving(true);
    try {
      await onSave({ title, startDateTime, endDateTime });
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface">Edit Event</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {event.source === "google" && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container-low border border-outline-variant/20 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          )}
          {event.source === "flashbook" && (
            <p className="text-sm text-on-surface font-medium">{event.title.replace(/^Appointment:\s*/, "")}</p>
          )}

          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container-low border border-outline-variant/20 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">Start</label>
              <TimeSelect value={startTime} onChange={setStartTime} className="w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">End</label>
              <TimeSelect value={endTime} onChange={setEndTime} className="w-full" />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm font-medium rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 text-sm font-medium rounded-xl bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Month grid ────────────────────────────────────────────────────────────────

function MonthGrid({
  year, month, eventsByDay, todayKey,
  onPrev, onNext, onSelectDay,
}: {
  year: number; month: number;
  eventsByDay: Map<string, CalendarEvent[]>; todayKey: string;
  onPrev: () => void; onNext: () => void;
  onSelectDay: (key: string) => void;
}) {
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  type Cell = { day: number; currentMonth: boolean; dateKey: string };
  const cells: Cell[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    const d = daysInPrevMonth - firstDayOfMonth + 1 + i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ day: d, currentMonth: false, dateKey: `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; cells.length < 42; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ day: d, currentMonth: false, dateKey: `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Month nav header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/10 shrink-0">
        <button type="button" onClick={onPrev} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-on-surface">{MONTH_NAMES[month]} {year}</h2>
        <button type="button" onClick={onNext} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-outline-variant/10 shrink-0">
        {WEEKDAYS_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-on-surface-variant/60">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-7 grid-rows-6">
        {cells.map((cell, i) => {
          const evs = eventsByDay.get(cell.dateKey) ?? [];
          const isToday = cell.dateKey === todayKey;
          const isLastRow = i >= 35;
          const isLastCol = i % 7 === 6;

          return (
            <button
              key={`${cell.dateKey}-${i}`}
              type="button"
              onClick={() => onSelectDay(cell.dateKey)}
              className={`
                p-1.5 text-left flex flex-col gap-0.5 min-h-0 overflow-hidden transition-colors hover:bg-surface-container-low
                ${!isLastCol ? "border-r border-outline-variant/10" : ""}
                ${!isLastRow ? "border-b border-outline-variant/10" : ""}
                ${!cell.currentMonth ? "bg-surface-container/40" : ""}
              `}
            >
              <span className={`
                text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium leading-none shrink-0
                ${isToday ? "bg-primary text-on-primary font-bold" : cell.currentMonth ? "text-on-surface" : "text-on-surface-variant/30"}
              `}>
                {cell.day}
              </span>
              <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                {evs.slice(0, 3).map(ev => (
                  <span
                    key={ev.id}
                    className={`truncate text-[10px] font-medium px-1 py-px rounded leading-tight
                      ${ev.source === "google" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {ev.title.replace(/^Appointment:\s*/, "")}
                  </span>
                ))}
                {evs.length > 3 && (
                  <span className="text-[10px] text-on-surface-variant/50 px-1">+{evs.length - 3} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-2 border-t border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" />
          <span className="text-[11px] text-on-surface-variant">FlashBooker</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300" />
          <span className="text-[11px] text-on-surface-variant">Google Calendar</span>
        </div>
      </div>
    </div>
  );
}

// ── Day timeline ──────────────────────────────────────────────────────────────

function DayTimeline({
  dateKey, events, loading,
  onAddAtTime, onPrevDay, onNextDay, onToday, onBack,
  onEditEvent,
}: {
  dateKey: string;
  events: CalendarEvent[];
  loading: boolean;
  onAddAtTime: (iso: string) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onBack: () => void;
  onEditEvent: (ev: CalendarEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [nowPct, setNowPct] = useState<number | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const todayKey = toLocalDateKey(new Date().toISOString());
    let targetMin: number;
    if (dateKey === todayKey) {
      const now = new Date();
      targetMin = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60 - 60;
    } else {
      targetMin = (8 - START_HOUR) * 60;
    }
    scrollRef.current.scrollTop = Math.max(0, targetMin * PX_PER_MIN);
  }, [dateKey]);

  useEffect(() => {
    const update = () => {
      const todayKey = toLocalDateKey(new Date().toISOString());
      if (dateKey !== todayKey) { setNowPct(null); return; }
      const now = new Date();
      const minFromStart = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
      setNowPct(minFromStart * PX_PER_MIN);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [dateKey]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
    const totalMin = START_HOUR * 60 + y / PX_PER_MIN;
    const hours = Math.min(Math.floor(totalMin / 60), END_HOUR - 1);
    const minutes = snapToQuarter(totalMin % 60) % 60;
    const iso = new Date(`${dateKey}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`).toISOString();
    onAddAtTime(iso);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
    setHoverY(y);
  };

  const d = new Date(dateKey + "T12:00:00");
  const dayLabel = `${WEEKDAYS_LONG[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  const todayKey = toLocalDateKey(new Date().toISOString());
  const isToday = dateKey === todayKey;

  const allDayEvents = events.filter(e => isAllDay(e.start));
  const timedEvents = layoutEvents(events);

  let hoverLabel = "";
  if (hoverY !== null) {
    const totalMin = START_HOUR * 60 + hoverY / PX_PER_MIN;
    const h = Math.min(Math.floor(totalMin / 60), END_HOUR - 1);
    const m = snapToQuarter(totalMin % 60) % 60;
    hoverLabel = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Day header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Back to month">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={onPrevDay} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-on-surface">{dayLabel}</h2>
          <button type="button" onClick={onNextDay} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isToday && (
            <button type="button" onClick={onToday} className="text-xs px-2.5 py-1 rounded-md border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:border-outline-variant transition-colors">
              Today
            </button>
          )}
        </div>
        <p className="text-xs text-on-surface-variant/60">Click a time slot to add a session</p>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-1.5 px-5 py-2 border-b border-outline-variant/10 bg-surface-container-low">
          {allDayEvents.map(ev => (
            <button
              key={ev.id}
              type="button"
              onClick={() => onEditEvent(ev)}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-75 ${
                ev.source === "google" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {ev.title.replace(/^Appointment:\s*/, "")}
              <Pencil className="w-2.5 h-2.5" />
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant">Loading…</div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div
            className="relative cursor-pointer select-none"
            style={{ height: TOTAL_HOURS * PX_PER_HOUR }}
            onClick={handleTimelineClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverY(null)}
          >
            {/* Hour lines + labels */}
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
              const hour = START_HOUR + i;
              return (
                <div key={i} className="absolute inset-x-0 flex items-start pointer-events-none" style={{ top: i * PX_PER_HOUR }}>
                  <span className="w-14 shrink-0 pr-3 text-[10px] text-on-surface-variant/50 text-right -translate-y-2 select-none">
                    {i < TOTAL_HOURS ? formatHour(hour) : ""}
                  </span>
                  <div className="flex-1 border-t border-outline-variant/10" />
                </div>
              );
            })}

            {/* Half-hour lines */}
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div key={`half-${i}`} className="absolute inset-x-14 border-t border-outline-variant/5 pointer-events-none" style={{ top: i * PX_PER_HOUR + PX_PER_HOUR / 2 }} />
            ))}

            {/* Now indicator */}
            {nowPct !== null && nowPct >= 0 && nowPct <= TOTAL_HOURS * PX_PER_HOUR && (
              <div className="absolute inset-x-14 flex items-center pointer-events-none z-20" style={{ top: nowPct }}>
                <span className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                <div className="flex-1 h-px bg-red-500" />
              </div>
            )}

            {/* Hover indicator */}
            {hoverY !== null && hoverY >= 0 && hoverY <= TOTAL_HOURS * PX_PER_HOUR && (
              <div className="absolute inset-x-14 flex items-center pointer-events-none z-10" style={{ top: hoverY }}>
                <span className="text-[10px] text-primary -ml-14 w-14 text-right pr-2 shrink-0 font-medium">{hoverLabel}</span>
                <div className="flex-1 border-t border-dashed border-primary/40" />
              </div>
            )}

            {/* Events */}
            <div className="absolute inset-y-0 left-14 right-2 pointer-events-none">
              {timedEvents.map(ev => {
                const evD = new Date(ev.start);
                const minFromStart = evD.getHours() * 60 + evD.getMinutes() - START_HOUR * 60;
                const top = Math.max(0, minFromStart * PX_PER_MIN);
                const endD = ev.end ? new Date(ev.end) : new Date(evD.getTime() + 3_600_000);
                const durationMin = (endD.getTime() - evD.getTime()) / 60_000;
                const height = Math.max(PX_PER_MIN * 20, Math.min(durationMin, TOTAL_HOURS * 60 - minFromStart) * PX_PER_MIN);
                const isFlash = ev.source === "flashbook";

                return (
                  <div
                    key={ev.id}
                    data-event="true"
                    className={`absolute rounded-lg px-2 py-1 overflow-hidden pointer-events-auto cursor-pointer hover:brightness-95 transition-all group ${
                      isFlash
                        ? "bg-amber-100 border border-amber-300 hover:bg-amber-200"
                        : "bg-blue-100 border border-blue-300 hover:bg-blue-200"
                    }`}
                    style={{ top, height, left: `${ev.left * 100}%`, width: `calc(${ev.width * 100}% - 4px)` }}
                    onClick={e => { e.stopPropagation(); onEditEvent(ev); }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-xs font-semibold truncate leading-tight flex-1 ${isFlash ? "text-amber-900" : "text-blue-900"}`}>
                        {ev.title.replace(/^Appointment:\s*/, "")}
                      </p>
                      <Pencil className={`w-3 h-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity ${isFlash ? "text-amber-700" : "text-blue-700"}`} />
                    </div>
                    {height > 28 && (
                      <p className={`text-[10px] leading-tight mt-0.5 ${isFlash ? "text-amber-700" : "text-blue-700"}`}>
                        {formatEventTime(ev.start)}{ev.end ? ` – ${formatEventTime(ev.end)}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CalendarView ─────────────────────────────────────────────────────────

export function CalendarView({ initialDate }: { initialDate?: string }) {
  const today = new Date();
  const todayKey = toLocalDateKey(today.toISOString());
  const seedDate = initialDate ?? todayKey;
  const seedD = new Date(seedDate + "T12:00:00");

  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [viewYear, setViewYear] = useState(seedD.getFullYear());
  const [viewMonth, setViewMonth] = useState(seedD.getMonth());
  const [selectedDay, setSelectedDay] = useState<string>(seedDate);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleSyncError, setGoogleSyncError] = useState("");

  const [addDateTime, setAddDateTime] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const start = new Date(y, m, 1).toISOString();
    const end = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    try {
      const res = await fetch(`/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const body = await res.json();
      setEvents(body.events ?? []);
      setGoogleSyncError(body.google_sync_error ?? "");
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(viewYear, viewMonth); }, [viewYear, viewMonth, fetchEvents]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleSelectDay = (key: string) => {
    setSelectedDay(key);
    const d = new Date(key + "T12:00:00");
    if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
    setViewMode("day");
  };

  const prevDay = () => {
    const d = new Date(selectedDay + "T12:00:00");
    d.setDate(d.getDate() - 1);
    const key = toLocalDateKey(d.toISOString());
    setSelectedDay(key);
    const nd = new Date(key + "T12:00:00");
    if (nd.getFullYear() !== viewYear || nd.getMonth() !== viewMonth) {
      setViewYear(nd.getFullYear()); setViewMonth(nd.getMonth());
    }
  };
  const nextDay = () => {
    const d = new Date(selectedDay + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const key = toLocalDateKey(d.toISOString());
    setSelectedDay(key);
    const nd = new Date(key + "T12:00:00");
    if (nd.getFullYear() !== viewYear || nd.getMonth() !== viewMonth) {
      setViewYear(nd.getFullYear()); setViewMonth(nd.getMonth());
    }
  };
  const goToday = () => {
    setSelectedDay(todayKey);
    const d = new Date(todayKey + "T12:00:00");
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth());
  };

  const handleSaveEvent = async (ev: CalendarEvent, updated: { title: string; startDateTime: string; endDateTime: string }) => {
    if (ev.source === "google") {
      const googleEventId = ev.id.replace(/^google-/, "");
      await fetch("/api/calendar/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleEventId, ...updated }),
      }).then(r => { if (!r.ok) throw new Error(); });
    } else {
      // flashbook event: extract booking id and update appointment_date
      const bookingId = ev.id.replace(/^booking-/, "");
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_appointment", appointment_date: updated.startDateTime, duration_minutes: Math.round((new Date(updated.endDateTime).getTime() - new Date(updated.startDateTime).getTime()) / 60_000) }),
      }).then(r => { if (!r.ok) throw new Error(); });
    }
    // Refresh events
    fetchEvents(viewYear, viewMonth);
  };

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = isAllDay(ev.start) ? ev.start : toLocalDateKey(ev.start);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(ev);
  }

  const selectedDayEvents = eventsByDay.get(selectedDay) ?? [];

  return (
    <div className="flex flex-col h-full gap-2">
      {googleSyncError && (
        <p className="shrink-0 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {googleSyncError}
        </p>
      )}

      <div className="border border-outline-variant/20 rounded-2xl overflow-hidden bg-surface flex flex-col flex-1 min-h-0" style={{ minHeight: 480 }}>
        {viewMode === "month" ? (
          <MonthGrid
            year={viewYear}
            month={viewMonth}
            eventsByDay={eventsByDay}
            todayKey={todayKey}
            onPrev={prevMonth}
            onNext={nextMonth}
            onSelectDay={handleSelectDay}
          />
        ) : (
          <DayTimeline
            dateKey={selectedDay}
            events={selectedDayEvents}
            loading={loading}
            onAddAtTime={(iso) => { setAddDateTime(iso); setShowAddModal(true); }}
            onPrevDay={prevDay}
            onNextDay={nextDay}
            onToday={goToday}
            onBack={() => setViewMode("month")}
            onEditEvent={setEditingEvent}
          />
        )}
      </div>

      <BookingFormModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        initialDateTime={addDateTime}
      />

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onSave={(updated) => handleSaveEvent(editingEvent, updated)}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}
