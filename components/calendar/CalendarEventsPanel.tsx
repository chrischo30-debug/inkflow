"use client";

import { useEffect, useState } from "react";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  source: "google" | "flashbook";
  link?: string;
};

export function CalendarEventsPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [googleSyncError, setGoogleSyncError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch("/api/calendar/events");
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.error || "Failed to load calendar events.");
        }
        if (isMounted) {
          setEvents(body.events ?? []);
          setGoogleSyncError(body.google_sync_error ?? "");
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load calendar events.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <p className="text-sm text-on-surface-variant">Loading events...</p>;
  }
  if (error) {
    return <p className="text-sm text-error">{error}</p>;
  }
  if (events.length === 0) {
    return (
      <div className="space-y-2">
        {googleSyncError && <p className="text-sm text-error">{googleSyncError}</p>}
        <p className="text-sm text-on-surface-variant">No upcoming events found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {googleSyncError && <p className="text-sm text-error">{googleSyncError}</p>}
      {events.map((event) => (
        <div key={event.id} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-on-surface">{event.title}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${event.source === "google" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-700"}`}>
              {event.source}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            {new Date(event.start).toLocaleString()}
          </p>
          {event.link && (
            <a href={event.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
              Open in Google Calendar
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
