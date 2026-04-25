"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft, X, Pencil, CalendarDays } from "lucide-react";
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

function getWeekStart(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  d.setDate(d.getDate() - d.getDay());
  return toLocalDateKey(d.toISOString());
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
  return { date: d.toLocaleDateString("en-CA"), time: d.toTimeString().slice(0, 5) };
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
  event, onSave, onClose,
}: {
  event: CalendarEvent;
  onSave: (updated: { title: string; startDateTime: string; endDateTime: string }) => Promise<void>;
  onClose: () => void;
}) {
  const { date: initDate, time: initTime } = isoToDateAndTime(event.start);
  const endD = event.end
    ? isoToDateAndTime(event.end)
    : isoToDateAndTime(new Date(new Date(event.start).getTime() + 3_600_000).toISOString());

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
    try { await onSave({ title, startDateTime, endDateTime }); onClose(); }
    catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
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
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container-low border border-outline-variant/20 rounded-lg focus:outline-none focus:border-primary" />
            </div>
          )}
          {event.source === "flashbook" && (
            <p className="text-sm text-on-surface font-medium">{event.title.replace(/^Appointment:\s*/, "")}</p>
          )}
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container-low border border-outline-variant/20 rounded-lg focus:outline-none focus:border-primary" />
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
          <button type="button" onClick={onClose}
            className="flex-1 py-2 text-sm font-medium rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-2 text-sm font-medium rounded-xl bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Month picker popover ──────────────────────────────────────────────────────

function MonthPickerPopover({
  initialYear, initialMonth, todayKey, eventsByDay,
  onSelectDay, onClose,
}: {
  initialYear: number;
  initialMonth: number;
  todayKey: string;
  eventsByDay: Map<string, CalendarEvent[]>;
  onSelectDay: (key: string) => void;
  onClose: () => void;
}) {
  const [pickerYear, setPickerYear] = useState(initialYear);
  const [pickerMonth, setPickerMonth] = useState(initialMonth);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const firstDow = new Date(pickerYear, pickerMonth, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const daysInPrev = new Date(pickerYear, pickerMonth, 0).getDate();

  type Cell = { day: number; currentMonth: boolean; key: string };
  const cells: Cell[] = [];
  for (let i = 0; i < firstDow; i++) {
    const d = daysInPrev - firstDow + 1 + i;
    const pm = pickerMonth === 0 ? 11 : pickerMonth - 1;
    const py = pickerMonth === 0 ? pickerYear - 1 : pickerYear;
    cells.push({ day: d, currentMonth: false, key: `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, key: `${pickerYear}-${String(pickerMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; cells.length < 42; d++) {
    const nm = pickerMonth === 11 ? 0 : pickerMonth + 1;
    const ny = pickerMonth === 11 ? pickerYear + 1 : pickerYear;
    cells.push({ day: d, currentMonth: false, key: `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  const prevMonth = () => {
    if (pickerMonth === 0) { setPickerYear(y => y - 1); setPickerMonth(11); }
    else setPickerMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (pickerMonth === 11) { setPickerYear(y => y + 1); setPickerMonth(0); }
    else setPickerMonth(m => m + 1);
  };

  return (
    <div ref={ref} className="absolute top-full right-0 mt-1 z-50 bg-surface border border-outline-variant/30 rounded-2xl shadow-xl p-3 w-64">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold text-on-surface">{MONTH_NAMES[pickerMonth]} {pickerYear}</p>
        <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-on-surface-variant py-1">{d[0]}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, i) => {
          const isToday = cell.key === todayKey;
          const hasEvents = (eventsByDay.get(cell.key) ?? []).length > 0;
          return (
            <button
              key={`${cell.key}-${i}`}
              type="button"
              onClick={() => { onSelectDay(cell.key); onClose(); }}
              className={`relative flex flex-col items-center justify-center h-8 rounded-lg text-xs font-medium transition-colors hover:bg-surface-container-high
                ${isToday ? "bg-primary text-on-primary hover:bg-primary" : cell.currentMonth ? "text-on-surface" : "text-on-surface-variant"}`}
            >
              {cell.day}
              {hasEvents && (
                <span className={`w-1.5 h-1.5 rounded-full mt-px ${isToday ? "bg-on-primary" : "bg-primary"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Month picker button (shared between week + day views) ─────────────────────

function MonthPickerButton({
  weekStart, todayKey, eventsByDay, onSelectWeek,
}: {
  weekStart: string;
  todayKey: string;
  eventsByDay: Map<string, CalendarEvent[]>;
  onSelectWeek: (weekStartKey: string, highlightDay: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const d = new Date(weekStart + "T12:00:00");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowPicker(p => !p)}
        title="Month overview"
        className={`p-1.5 rounded-lg transition-colors ${showPicker ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant hover:bg-surface-container-high"}`}
      >
        <CalendarDays className="w-4 h-4" />
      </button>
      {showPicker && (
        <MonthPickerPopover
          initialYear={d.getFullYear()}
          initialMonth={d.getMonth()}
          todayKey={todayKey}
          eventsByDay={eventsByDay}
          onSelectDay={key => {
            onSelectWeek(getWeekStart(key), key);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ── Day column ────────────────────────────────────────────────────────────────

function DayColumn({
  dateKey, timedEvents, nowPct, todayKey, highlightedDay, isLastCol,
  onAddAtTime, onEditEvent, scrollRef,
}: {
  dateKey: string;
  timedEvents: LayoutEvent[];
  nowPct: number | null;
  todayKey: string;
  highlightedDay: string | null;
  isLastCol: boolean;
  onAddAtTime: (iso: string) => void;
  onEditEvent: (ev: CalendarEvent) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isToday = dateKey === todayKey;
  const isHighlighted = highlightedDay === dateKey && !isToday;

  return (
    <div
      className={`flex-1 relative cursor-pointer select-none
        ${!isLastCol ? "border-r-2 border-outline-variant/20" : ""}
        ${isToday ? "bg-primary/[0.03]" : isHighlighted ? "bg-surface-container-low" : ""}`}
      onClick={e => {
        if ((e.target as HTMLElement).closest("[data-event]")) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
        const totalMin = START_HOUR * 60 + y / PX_PER_MIN;
        const hours = Math.min(Math.floor(totalMin / 60), END_HOUR - 1);
        const minutes = snapToQuarter(totalMin % 60) % 60;
        const iso = new Date(`${dateKey}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`).toISOString();
        onAddAtTime(iso);
      }}
    >
      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
        <div key={i} className="absolute inset-x-0 border-t border-outline-variant/10" style={{ top: i * PX_PER_HOUR }} />
      ))}
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div key={`h-${i}`} className="absolute inset-x-0 border-t border-outline-variant/5" style={{ top: i * PX_PER_HOUR + PX_PER_HOUR / 2 }} />
      ))}

      {isToday && nowPct !== null && nowPct >= 0 && nowPct <= TOTAL_HOURS * PX_PER_HOUR && (
        <div className="absolute inset-x-0 flex items-center pointer-events-none z-20" style={{ top: nowPct }}>
          <span className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
          <div className="flex-1 h-px bg-red-500" />
        </div>
      )}

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
            className={`absolute rounded-lg px-1.5 py-1 overflow-hidden pointer-events-auto cursor-pointer hover:brightness-95 transition-all group ${
              isFlash ? "bg-amber-100 border border-amber-300" : "bg-blue-100 border border-blue-300"
            }`}
            style={{ top, height, left: `${ev.left * 100}%`, width: `calc(${ev.width * 100}% - 3px)` }}
            onClick={e => { e.stopPropagation(); onEditEvent(ev); }}
          >
            <div className="flex items-start justify-between gap-0.5">
              <p className={`text-[11px] font-semibold leading-tight flex-1 ${isFlash ? "text-amber-900" : "text-blue-900"}`}>
                {ev.title.replace(/^Appointment:\s*/, "")}
              </p>
              <Pencil className={`w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity mt-0.5 ${isFlash ? "text-amber-700" : "text-blue-700"}`} />
            </div>
            {height > 32 && (
              <p className={`text-[10px] leading-tight mt-0.5 ${isFlash ? "text-amber-700" : "text-blue-700"}`}>
                {formatEventTime(ev.start)}{ev.end ? ` – ${formatEventTime(ev.end)}` : ""}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekTimeline({
  weekStart, eventsByDay, todayKey, loading, highlightedDay,
  onPrev, onNext, onToday, onSelectDay, onAddAtTime, onEditEvent, onSelectWeek,
}: {
  weekStart: string;
  eventsByDay: Map<string, CalendarEvent[]>;
  todayKey: string;
  loading: boolean;
  highlightedDay: string | null;
  onPrev: () => void; onNext: () => void; onToday: () => void;
  onSelectDay: (key: string) => void;
  onAddAtTime: (iso: string) => void;
  onEditEvent: (ev: CalendarEvent) => void;
  onSelectWeek: (weekStartKey: string, highlightDay: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowPct, setNowPct] = useState<number | null>(null);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    days.push(toLocalDateKey(d.toISOString()));
  }

  const firstD = new Date(days[0] + "T12:00:00");
  const lastD = new Date(days[6] + "T12:00:00");
  const weekLabel = firstD.getMonth() === lastD.getMonth()
    ? `${MONTH_NAMES[firstD.getMonth()]} ${firstD.getFullYear()}`
    : `${MONTH_NAMES[firstD.getMonth()]} – ${MONTH_NAMES[lastD.getMonth()]} ${lastD.getFullYear()}`;

  useEffect(() => {
    if (!scrollRef.current) return;
    const isCurrentWeek = days.includes(todayKey);
    const targetMin = isCurrentWeek
      ? new Date().getHours() * 60 + new Date().getMinutes() - START_HOUR * 60 - 60
      : (8 - START_HOUR) * 60;
    scrollRef.current.scrollTop = Math.max(0, targetMin * PX_PER_MIN);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffect(() => {
    const update = () => {
      if (!days.includes(todayKey)) { setNowPct(null); return; }
      const now = new Date();
      setNowPct((now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) * PX_PER_MIN);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, todayKey]);

  const allDayByDay = days.map(key => (eventsByDay.get(key) ?? []).filter(e => isAllDay(e.start)));
  const hasAnyAllDay = allDayByDay.some(evs => evs.length > 0);
  const timedByDay = days.map(key => layoutEvents(eventsByDay.get(key) ?? []));

  return (
    <div className="flex flex-col h-full">
      {/* Nav header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-outline-variant/20">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrev} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={onNext} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold text-on-surface">{weekLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onToday}
            className="text-xs px-3 py-1.5 rounded-lg border border-outline-variant/30 text-on-surface font-medium hover:bg-surface-container-high transition-colors">
            Today
          </button>
          <MonthPickerButton
            weekStart={weekStart}
            todayKey={todayKey}
            eventsByDay={eventsByDay}
            onSelectWeek={onSelectWeek}
          />
        </div>
      </div>

      {/* Day headers */}
      <div className="shrink-0 flex border-b-2 border-outline-variant/20">
        <div className="w-14 shrink-0" />
        {days.map((key, i) => {
          const d = new Date(key + "T12:00:00");
          const isToday = key === todayKey;
          const isHighlighted = highlightedDay === key && !isToday;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              className={`flex-1 py-2 text-center hover:bg-surface-container-low transition-colors ${i < 6 ? "border-r-2 border-outline-variant/20" : ""}`}
            >
              <p className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wide">{WEEKDAYS_SHORT[d.getDay()]}</p>
              <p className={`text-sm font-bold mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-colors ${
                isToday
                  ? "bg-primary text-on-primary"
                  : isHighlighted
                    ? "bg-surface-container-highest text-on-surface ring-2 ring-outline-variant"
                    : "text-on-surface"
              }`}>
                {d.getDate()}
              </p>
            </button>
          );
        })}
      </div>

      {/* All-day strip */}
      {hasAnyAllDay && (
        <div className="shrink-0 flex border-b border-outline-variant/20 bg-surface-container-low">
          <div className="w-14 shrink-0 flex items-center justify-end pr-2 py-1">
            <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">all day</span>
          </div>
          {allDayByDay.map((evs, i) => (
            <div key={days[i]} className={`flex-1 flex flex-col gap-0.5 px-0.5 py-1 ${i < 6 ? "border-r-2 border-outline-variant/20" : ""}`}>
              {evs.map(ev => (
                <button key={ev.id} type="button" onClick={() => onEditEvent(ev)}
                  className={`text-left text-[10px] font-medium px-1.5 py-0.5 rounded w-full truncate transition-opacity hover:opacity-75 ${
                    ev.source === "google" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                  }`}>
                  {ev.title.replace(/^Appointment:\s*/, "")}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant">Loading…</div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="relative flex" style={{ height: TOTAL_HOURS * PX_PER_HOUR }}>
            <div className="w-14 shrink-0 relative pointer-events-none select-none">
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                <div key={i} className="absolute right-0 flex items-start" style={{ top: i * PX_PER_HOUR }}>
                  <span className="pr-2 text-[10px] text-on-surface-variant font-medium text-right -translate-y-2">
                    {i < TOTAL_HOURS ? formatHour(START_HOUR + i) : ""}
                  </span>
                </div>
              ))}
            </div>
            {timedByDay.map((timedEvents, i) => (
              <DayColumn
                key={days[i]}
                dateKey={days[i]}
                timedEvents={timedEvents}
                nowPct={nowPct}
                todayKey={todayKey}
                highlightedDay={highlightedDay}
                isLastCol={i === 6}
                onAddAtTime={onAddAtTime}
                onEditEvent={onEditEvent}
                scrollRef={scrollRef}
              />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-4 px-5 py-2 border-t border-outline-variant/20">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" />
          <span className="text-[11px] text-on-surface-variant font-medium">FlashBooker</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300" />
          <span className="text-[11px] text-on-surface-variant font-medium">Google Calendar</span>
        </div>
        <p className="text-[11px] text-on-surface-variant ml-auto">Click a day or time slot to add</p>
      </div>
    </div>
  );
}

// ── Day timeline ──────────────────────────────────────────────────────────────

function DayTimeline({
  dateKey, events, loading, weekStart, eventsByDay, todayKey,
  onAddAtTime, onPrevDay, onNextDay, onToday, onBack, onEditEvent, onSelectWeek,
}: {
  dateKey: string;
  events: CalendarEvent[];
  loading: boolean;
  weekStart: string;
  eventsByDay: Map<string, CalendarEvent[]>;
  todayKey: string;
  onAddAtTime: (iso: string) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onBack: () => void;
  onEditEvent: (ev: CalendarEvent) => void;
  onSelectWeek: (weekStartKey: string, highlightDay: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [nowPct, setNowPct] = useState<number | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const targetMin = dateKey === todayKey
      ? new Date().getHours() * 60 + new Date().getMinutes() - START_HOUR * 60 - 60
      : (8 - START_HOUR) * 60;
    scrollRef.current.scrollTop = Math.max(0, targetMin * PX_PER_MIN);
  }, [dateKey, todayKey]);

  useEffect(() => {
    const update = () => {
      if (dateKey !== todayKey) { setNowPct(null); return; }
      const now = new Date();
      setNowPct((now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) * PX_PER_MIN);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [dateKey, todayKey]);

  const d = new Date(dateKey + "T12:00:00");
  const dayLabel = `${WEEKDAYS_LONG[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
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
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-outline-variant/20">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Back to week">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={onPrevDay} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-on-surface">{dayLabel}</h2>
          <button type="button" onClick={onNextDay} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isToday && (
            <button type="button" onClick={onToday}
              className="text-xs px-3 py-1.5 rounded-lg border border-outline-variant/30 text-on-surface font-medium hover:bg-surface-container-high transition-colors">
              Today
            </button>
          )}
          <MonthPickerButton
            weekStart={weekStart}
            todayKey={todayKey}
            eventsByDay={eventsByDay}
            onSelectWeek={onSelectWeek}
          />
        </div>
      </div>

      {allDayEvents.length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-1.5 px-5 py-2 border-b border-outline-variant/20 bg-surface-container-low">
          {allDayEvents.map(ev => (
            <button key={ev.id} type="button" onClick={() => onEditEvent(ev)}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-75 ${
                ev.source === "google" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
              }`}>
              {ev.title.replace(/^Appointment:\s*/, "")}
              <Pencil className="w-2.5 h-2.5" />
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant">Loading…</div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div
            className="relative cursor-pointer select-none"
            style={{ height: TOTAL_HOURS * PX_PER_HOUR }}
            onMouseMove={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHoverY(e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0));
            }}
            onMouseLeave={() => setHoverY(null)}
            onClick={e => {
              if ((e.target as HTMLElement).closest("[data-event]")) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
              const totalMin = START_HOUR * 60 + y / PX_PER_MIN;
              const hours = Math.min(Math.floor(totalMin / 60), END_HOUR - 1);
              const minutes = snapToQuarter(totalMin % 60) % 60;
              const iso = new Date(`${dateKey}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`).toISOString();
              onAddAtTime(iso);
            }}
          >
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div key={i} className="absolute inset-x-0 flex items-start pointer-events-none" style={{ top: i * PX_PER_HOUR }}>
                <span className="w-14 shrink-0 pr-3 text-[10px] text-on-surface-variant font-medium text-right -translate-y-2 select-none">
                  {i < TOTAL_HOURS ? formatHour(START_HOUR + i) : ""}
                </span>
                <div className="flex-1 border-t border-outline-variant/15" />
              </div>
            ))}
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div key={`half-${i}`} className="absolute inset-x-14 border-t border-outline-variant/8 pointer-events-none" style={{ top: i * PX_PER_HOUR + PX_PER_HOUR / 2 }} />
            ))}
            {nowPct !== null && nowPct >= 0 && nowPct <= TOTAL_HOURS * PX_PER_HOUR && (
              <div className="absolute inset-x-14 flex items-center pointer-events-none z-20" style={{ top: nowPct }}>
                <span className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                <div className="flex-1 h-px bg-red-500" />
              </div>
            )}
            {hoverY !== null && hoverY >= 0 && hoverY <= TOTAL_HOURS * PX_PER_HOUR && (
              <div className="absolute inset-x-14 flex items-center pointer-events-none z-10" style={{ top: hoverY }}>
                <span className="text-[10px] text-primary -ml-14 w-14 text-right pr-2 shrink-0 font-semibold">{hoverLabel}</span>
                <div className="flex-1 border-t border-dashed border-primary/40" />
              </div>
            )}
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
                      isFlash ? "bg-amber-100 border border-amber-300 hover:bg-amber-200" : "bg-blue-100 border border-blue-300 hover:bg-blue-200"
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

  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [weekStart, setWeekStart] = useState(getWeekStart(seedDate));
  const [selectedDay, setSelectedDay] = useState<string>(seedDate);
  // Day highlighted by month picker (not today)
  const [highlightedDay, setHighlightedDay] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleSyncError, setGoogleSyncError] = useState("");
  const [addDateTime, setAddDateTime] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Track the furthest end date we've already fetched so we never replace data with a narrower range
  const fetchedThroughRef = useRef<Date>(new Date(0));

  const fetchEvents = useCallback(async (throughDate: Date) => {
    const now = new Date();
    const fetchStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const fetchEnd = new Date(throughDate.getFullYear(), throughDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/events?start=${encodeURIComponent(fetchStart)}&end=${encodeURIComponent(fetchEnd)}`);
      const body = await res.json();
      setEvents(body.events ?? []);
      setGoogleSyncError(body.google_sync_error ?? "");
      fetchedThroughRef.current = throughDate;
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureFetched = useCallback((ws: string) => {
    const now = new Date();
    const weekD = new Date(ws + "T12:00:00");
    // Always cover at least 12 months ahead of today
    const minThrough = new Date(now.getFullYear(), now.getMonth() + 12, 0);
    const through = weekD > minThrough ? weekD : minThrough;
    if (through > fetchedThroughRef.current) {
      fetchEvents(through);
    }
  }, [fetchEvents]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { ensureFetched(weekStart); }, []);

  useEffect(() => { ensureFetched(weekStart); }, [weekStart, ensureFetched]);

  const prevWeek = () => {
    setHighlightedDay(null);
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() - 7);
    setWeekStart(toLocalDateKey(d.toISOString()));
  };
  const nextWeek = () => {
    setHighlightedDay(null);
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + 7);
    setWeekStart(toLocalDateKey(d.toISOString()));
  };
  const goToday = () => {
    setHighlightedDay(null);
    setWeekStart(getWeekStart(todayKey));
    setSelectedDay(todayKey);
    setViewMode("week");
  };

  // Called when clicking a day header in week view → zoom to day
  const handleSelectDay = (key: string) => {
    setSelectedDay(key);
    setViewMode("day");
  };

  // Called from month picker → stay in week view, jump to that week, highlight day
  const handleSelectWeek = (ws: string, highlight: string) => {
    setWeekStart(ws);
    setHighlightedDay(highlight);
    setViewMode("week");
  };

  const prevDay = () => {
    const d = new Date(selectedDay + "T12:00:00");
    d.setDate(d.getDate() - 1);
    const key = toLocalDateKey(d.toISOString());
    setSelectedDay(key);
    const ws = getWeekStart(key);
    if (ws !== weekStart) setWeekStart(ws);
  };
  const nextDay = () => {
    const d = new Date(selectedDay + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const key = toLocalDateKey(d.toISOString());
    setSelectedDay(key);
    const ws = getWeekStart(key);
    if (ws !== weekStart) setWeekStart(ws);
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
      const bookingId = ev.id.replace(/^booking-/, "");
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_appointment",
          appointment_date: updated.startDateTime,
          duration_minutes: Math.round((new Date(updated.endDateTime).getTime() - new Date(updated.startDateTime).getTime()) / 60_000),
        }),
      }).then(r => { if (!r.ok) throw new Error(); });
    }
    // Force a re-fetch of the full range to pick up the saved change
    fetchedThroughRef.current = new Date(0);
    ensureFetched(weekStart);
  };

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = isAllDay(ev.start) ? ev.start : toLocalDateKey(ev.start);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(ev);
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {googleSyncError && (
        <p className="shrink-0 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {googleSyncError}
        </p>
      )}

      <div className="border border-outline-variant/20 rounded-2xl overflow-hidden bg-surface flex flex-col flex-1 min-h-0" style={{ minHeight: 480 }}>
        {viewMode === "week" ? (
          <WeekTimeline
            weekStart={weekStart}
            eventsByDay={eventsByDay}
            todayKey={todayKey}
            loading={loading}
            highlightedDay={highlightedDay}
            onPrev={prevWeek}
            onNext={nextWeek}
            onToday={goToday}
            onSelectDay={handleSelectDay}
            onAddAtTime={(iso) => { setAddDateTime(iso); setShowAddModal(true); }}
            onEditEvent={setEditingEvent}
            onSelectWeek={handleSelectWeek}
          />
        ) : (
          <DayTimeline
            dateKey={selectedDay}
            events={eventsByDay.get(selectedDay) ?? []}
            loading={loading}
            weekStart={weekStart}
            eventsByDay={eventsByDay}
            todayKey={todayKey}
            onAddAtTime={(iso) => { setAddDateTime(iso); setShowAddModal(true); }}
            onPrevDay={prevDay}
            onNextDay={nextDay}
            onToday={goToday}
            onBack={() => setViewMode("week")}
            onEditEvent={setEditingEvent}
            onSelectWeek={handleSelectWeek}
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
