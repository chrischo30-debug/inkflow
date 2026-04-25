"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays, MapPin } from "lucide-react";
import type { SchedulingLink } from "@/lib/pipeline-settings";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDisplayDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}${period}`;
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

type View = "picker" | "done";

export function SchedulingPicker({
  artistId,
  linkId,
  artistName,
  studioName,
  studioAddress,
  blockedDates,
  link,
  bid,
}: {
  artistId: string;
  linkId: string;
  artistName: string;
  studioName: string | null;
  studioAddress: string | null;
  blockedDates: string[];
  link: SchedulingLink;
  bid?: string;
}) {
  const mapsUrl = studioAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(studioAddress)}` : null;
  const blockedSet = new Set(blockedDates);
  const today = new Date();
  const [view, setView] = useState<View>("picker");
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tzLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: link.timezone, timeZoneName: "short",
  }).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value ?? link.timezone;

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const isDisabledDay = useCallback((year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (date < now) return true;
    if (!link.days.includes(date.getDay())) return true;
    if (blockedSet.has(toDateStr(year, month, day))) return true;
    return false;
  }, [link.days, blockedSet]);

  const fetchSlots = async (dateStr: string) => {
    setLoadingSlots(true);
    setSlots([]);
    try {
      const res = await fetch(`/api/schedule/${artistId}/${linkId}/slots?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json() as { slots: Array<{ start: string; end: string }> };
        setSlots(data.slots ?? []);
      }
    } finally {
      setLoadingSlots(false);
    }
  };

  const selectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    fetchSlots(dateStr);
  };

  const confirmSlot = async () => {
    if (!selectedSlot || !selectedDate) return;
    setSubmitting(true);
    try {
      await fetch(`/api/schedule/${artistId}/${linkId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, start: selectedSlot.start, end: selectedSlot.end, ...(bid ? { bid } : {}) }),
      });
      setView("done");
    } finally {
      setSubmitting(false);
    }
  };

  const cells = buildCalendarDays(calYear, calMonth);

  const googleCalLink = selectedDate && selectedSlot
    ? (() => {
        const [sh, sm] = selectedSlot.start.split(":").map(Number);
        const [eh, em] = selectedSlot.end.split(":").map(Number);
        const pad2 = (n: number) => String(n).padStart(2, "0");
        const datePart = selectedDate.replace(/-/g, "");
        const start = `${datePart}T${pad2(sh)}${pad2(sm)}00`;
        const end = `${datePart}T${pad2(eh)}${pad2(em)}00`;
        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Appointment with ${artistName}`)}&dates=${start}/${end}`;
      })()
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-12 px-4">
      <div className={`w-full ${view === "picker" ? "max-w-3xl" : "max-w-md"}`}>
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">{artistName}</p>
          <h1 className="text-xl font-semibold text-gray-900">{link.label}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {link.duration_minutes / 60 % 1 === 0
              ? `${link.duration_minutes / 60} hr`
              : `${link.duration_minutes / 60} hrs`} session · All times in {tzLabel}
          </p>
        </div>

        {view === "done" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Your appointment is confirmed</h2>
            <p className="text-sm text-gray-500 mb-2">
              {formatDisplayDate(selectedDate!)} at {formatTime12(selectedSlot!.start)}
            </p>
            <p className="text-sm text-gray-400 mb-6 whitespace-pre-line">
              {link.confirmation_message?.trim() || `${artistName} has been notified.`}
            </p>
            {studioAddress && (
              <a
                href={mapsUrl!}
                target="_blank"
                rel="noreferrer"
                className="block mb-3 rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-gray-400 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    {studioName && <p className="text-sm font-medium text-gray-900 truncate">{studioName}</p>}
                    <p className="text-xs text-gray-500 leading-snug whitespace-pre-line">{studioAddress}</p>
                    <p className="text-[11px] text-gray-400 mt-1">Open in Google Maps →</p>
                  </div>
                </div>
              </a>
            )}
            {googleCalLink && (
              <a
                href={googleCalLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors"
              >
                <CalendarDays className="w-4 h-4" />
                Add to Google Calendar
              </a>
            )}
          </div>
        )}

        {view === "picker" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid md:grid-cols-[1fr_280px]">
              {/* Calendar (left) */}
              <div className="p-6 md:border-r border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-gray-900">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </span>
                  <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 mb-2">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1">
                  {cells.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const disabled = isDisabledDay(calYear, calMonth, day);
                    const dateStr = toDateStr(calYear, calMonth, day);
                    const isSelected = dateStr === selectedDate;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={disabled}
                        onClick={() => selectDate(dateStr)}
                        className={`aspect-square flex items-center justify-center rounded-full text-sm font-medium transition-colors mx-auto w-9 h-9 ${
                          disabled
                            ? "text-gray-300 cursor-not-allowed"
                            : isSelected
                            ? "bg-gray-900 text-white"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slots (right) */}
              <div className="p-6 bg-gray-50/40 md:bg-transparent flex flex-col min-h-[320px]">
                {!selectedDate ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <p className="text-sm text-gray-400">Pick a date to see available times.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-900 mb-4">
                      {formatDisplayDate(selectedDate)}
                    </p>

                    {loadingSlots ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-gray-400">Loading times…</p>
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-center">
                        <p className="text-sm text-gray-400">No open times on this day.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-0.5" style={{ maxHeight: "340px" }}>
                        {slots.map(slot => (
                          <button
                            key={slot.start}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                              selectedSlot?.start === slot.start
                                ? "bg-gray-900 text-white border-gray-900"
                                : "border-gray-200 text-gray-700 hover:border-gray-400"
                            }`}
                          >
                            {formatTime12(slot.start)}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedSlot && (
                      <button
                        type="button"
                        onClick={confirmSlot}
                        disabled={submitting}
                        className="mt-4 w-full py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {submitting ? "Confirming…" : `Confirm ${formatTime12(selectedSlot.start)}`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
