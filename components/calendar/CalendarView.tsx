"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Calendar } from "lucide-react";
import { AddEventModal } from "./AddEventModal";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  source: "google" | "flashbook";
  link?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DayDetailModal({
  dateKey,
  events,
  onClose,
  onAddEvent,
}: {
  dateKey: string;
  events: CalendarEvent[];
  onClose: () => void;
  onAddEvent: () => void;
}) {
  const label = new Date(dateKey + "T12:00:00").toLocaleDateString("default", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-outline-variant/10">
          <div>
            <p className="text-base font-semibold text-on-surface">{label}</p>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {events.length === 0 ? "No events" : `${events.length} event${events.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Calendar className="w-8 h-8 text-on-surface-variant/30" />
              <p className="text-sm text-on-surface-variant">No events scheduled for this day.</p>
            </div>
          ) : (
            events.map(ev => (
              <div
                key={ev.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/10"
              >
                <span className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${ev.source === "google" ? "bg-blue-500" : "bg-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface">{ev.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {formatTime(ev.start)}{ev.end ? ` – ${formatTime(ev.end)}` : ""}
                    <span className="ml-2 opacity-60">{ev.source === "google" ? "Google Calendar" : "FlashBook"}</span>
                  </p>
                </div>
                {ev.link && (
                  <a
                    href={ev.link}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Open ↗
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/10">
          <button
            type="button"
            onClick={onAddEvent}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add event on this day
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocalDateKey(iso: string): string {
  // Returns "YYYY-MM-DD" in local time
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function CalendarView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleSyncError, setGoogleSyncError] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // "YYYY-MM-DD"
  const [addModalDate, setAddModalDate] = useState<string | undefined>(undefined);
  const [showAddModal, setShowAddModal] = useState(false);

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

  useEffect(() => { fetchEvents(year, month); }, [year, month, fetchEvents]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(null);
  };

  const openAddModal = (date?: string) => {
    setAddModalDate(date);
    setShowAddModal(true);
  };

  // Build the grid
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Group events by local date key
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = toLocalDateKey(ev.start);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(ev);
  }

  // Build cell array: { day, currentMonth, dateKey }
  type Cell = { day: number; currentMonth: boolean; dateKey: string };
  const cells: Cell[] = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    const d = daysInPrevMonth - firstDayOfMonth + 1 + i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    cells.push({ day: d, currentMonth: false, dateKey: `${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    cells.push({ day: d, currentMonth: false, dateKey: `${nextY}-${String(nextM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  const todayKey = toLocalDateKey(today.toISOString());
  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });

  const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];

  return (
    <>
    {showAddModal && (
      <AddEventModal
        initialDate={addModalDate}
        onClose={() => setShowAddModal(false)}
        onCreated={() => fetchEvents(year, month)}
      />
    )}

    <div className="space-y-4">
      {googleSyncError && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{googleSyncError}</p>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2.5 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-heading font-semibold text-on-surface w-44 text-center">
            {monthName} {year}
          </h2>
          <button onClick={nextMonth} className="p-2.5 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:border-outline-variant transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => openAddModal(selectedDay ?? undefined)}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add event
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-outline-variant/20 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-outline-variant/20 bg-surface-container-low">
          {WEEKDAYS.map(d => (
            <div key={d} className="py-3 text-center text-sm font-medium text-on-surface-variant">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="h-80 flex items-center justify-center text-sm text-on-surface-variant">
            Loading…
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const cellEvents = eventsByDay.get(cell.dateKey) ?? [];
              const isToday = cell.dateKey === todayKey;
              const isSelected = cell.dateKey === selectedDay;
              const isLastRow = i >= 35;

              return (
                <button
                  key={`${cell.dateKey}-${i}`}
                  type="button"
                  onClick={() => setSelectedDay(cell.dateKey)}
                  className={`
                    relative min-h-[100px] p-2.5 text-left flex flex-col gap-1 transition-colors
                    ${i % 7 !== 6 ? "border-r border-outline-variant/10" : ""}
                    ${!isLastRow ? "border-b border-outline-variant/10" : ""}
                    ${isSelected ? "bg-primary/5" : "hover:bg-surface-container-low"}
                    ${!cell.currentMonth ? "bg-surface-container/30" : ""}
                  `}
                >
                  <span className={`
                    text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full leading-none
                    ${isToday ? "bg-primary text-on-primary font-bold" : cell.currentMonth ? "text-on-surface" : "text-on-surface-variant/40"}
                  `}>
                    {cell.day}
                  </span>

                  {/* Event pills — show up to 2, then +N */}
                  <div className="flex flex-col gap-0.5 w-full">
                    {cellEvents.slice(0, 2).map(ev => (
                      <span
                        key={ev.id}
                        className={`truncate text-xs font-medium px-1.5 py-0.5 rounded leading-tight
                          ${ev.source === "google"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-primary/10 text-primary"
                          }`}
                      >
                        {ev.title}
                      </span>
                    ))}
                    {cellEvents.length > 2 && (
                      <span className="text-xs text-on-surface-variant px-1">
                        +{cellEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedDay && (
        <DayDetailModal
          dateKey={selectedDay}
          events={selectedEvents}
          onClose={() => setSelectedDay(null)}
          onAddEvent={() => {
            setSelectedDay(null);
            openAddModal(selectedDay);
          }}
        />
      )}
    </div>
    </>
  );
}
