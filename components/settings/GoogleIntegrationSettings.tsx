"use client";

interface Props {
  googleConfigured: boolean;
  hasRefreshToken: boolean;
  isCalendarConnected: boolean;
}

export function GoogleIntegrationSettings({ googleConfigured, hasRefreshToken, isCalendarConnected }: Props) {
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
