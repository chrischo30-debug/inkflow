"use client";

import { useEffect, useState } from "react";

interface Props {
  googleConfigured: boolean;
  hasRefreshToken: boolean;
  isCalendarConnected: boolean;
}

interface CalendarItem {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
}

export function GoogleIntegrationSettings({ googleConfigured, hasRefreshToken, isCalendarConnected }: Props) {
  const [calendars, setCalendars] = useState<CalendarItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCalendarConnected) return;
    setLoading(true);
    setError(null);
    fetch("/api/calendar/list")
      .then(r => r.json())
      .then((data: { calendars?: CalendarItem[]; selected?: string[] }) => {
        const list = data.calendars ?? [];
        setCalendars(list);
        const sel = data.selected && data.selected.length > 0
          ? new Set(data.selected)
          : new Set(list.filter(c => c.primary).map(c => c.id));
        setSelected(sel);
      })
      .catch(() => setError("Couldn't load calendars from Google."))
      .finally(() => setLoading(false));
  }, [isCalendarConnected]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSavedAt(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/sync-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar_ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("save failed");
      setSavedAt(Date.now());
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 md:p-6 shadow-sm">
      <h3 className="text-base font-semibold text-on-surface mb-2">Google Calendar</h3>
      <div className="text-sm text-on-surface-variant mb-5 space-y-2 leading-relaxed">
        <p>Sync confirmed appointments to your Google Calendar.</p>
        <p>Your clients never see this. It keeps your personal calendar up to date so you avoid double-booking.</p>
      </div>

      {!googleConfigured && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          Google OAuth is not configured. Add <code className="font-mono">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="font-mono">GOOGLE_CLIENT_SECRET</code> to your environment variables.
        </div>
      )}

      <div className="mb-5">
        <div className="flex items-center justify-between rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3">
          <div>
            <p className="text-base font-medium text-on-surface">Google Calendar</p>
            <p className="text-sm text-on-surface-variant mt-1">
              {isCalendarConnected ? "Confirmed bookings sync automatically." : "Confirmed bookings will not sync to your calendar."}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ml-3 ${
            isCalendarConnected ? "bg-emerald-100 text-emerald-700" : "bg-surface-container text-on-surface-variant border border-outline-variant/30"
          }`}>
            {isCalendarConnected ? "Connected" : "Not connected"}
          </span>
        </div>
      </div>

      {isCalendarConnected && (
        <div className="mb-5 rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-4">
          <p className="text-sm font-medium text-on-surface mb-1">Calendars to check for availability</p>
          <p className="text-sm text-on-surface-variant mb-3 leading-relaxed">
            We&apos;ll only read busy times from the calendars you pick here. New bookings are always written to your primary calendar.
          </p>

          {loading && <p className="text-sm text-on-surface-variant">Loading calendars…</p>}

          {!loading && calendars && calendars.length === 0 && (
            <p className="text-sm text-on-surface-variant">No calendars found.</p>
          )}

          {!loading && calendars && calendars.length > 0 && (
            <div className="space-y-2">
              {calendars.map(c => (
                <label key={c.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  {c.backgroundColor && (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.backgroundColor }} />
                  )}
                  <span className="text-sm text-on-surface flex-1 truncate">{c.summary}</span>
                  {c.primary && (
                    <span className="text-xs text-on-surface-variant shrink-0">primary</span>
                  )}
                </label>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-destructive mt-3">{error}</p>}

          {!loading && calendars && (
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save selection"}
              </button>
              {savedAt && <span className="text-xs text-on-surface-variant">Saved.</span>}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {googleConfigured ? (
          // Plain <a> (not next/link) — OAuth needs a real top-level browser
          // navigation so the server's 302 to accounts.google.com is followed.
          // next/link intercepts as RSC fetch and CORS-fails on the cross-origin
          // redirect.
          <a
            href="/api/auth/google/connect"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
          >
            {hasRefreshToken ? "Reconnect Calendar" : "Connect Calendar"}
          </a>
        ) : (
          <span className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-surface-container-high text-on-surface-variant cursor-not-allowed">
            Connect Calendar
          </span>
        )}
        {hasRefreshToken && (
          <form action="/api/auth/google/disconnect" method="post">
            <button
              type="submit"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-destructive hover:border-destructive/40 transition-colors"
            >
              Disconnect
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
