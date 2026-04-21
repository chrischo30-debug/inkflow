"use client";

import Link from "next/link";

interface Props {
  googleConfigured: boolean;
  hasRefreshToken: boolean;
  isCalendarConnected: boolean;
  isGmailConnected: boolean;
  gmailAddress: string;
}

export function GoogleIntegrationSettings({ googleConfigured, hasRefreshToken, isCalendarConnected, isGmailConnected, gmailAddress }: Props) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-on-surface mb-1">Google</h3>
      <p className="text-xs text-on-surface-variant mb-5">
        Send booking emails from your Gmail address and sync confirmed appointments to your calendar.
      </p>

      {!googleConfigured && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          Google OAuth is not configured. Add <code className="font-mono">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="font-mono">GOOGLE_CLIENT_SECRET</code> to your environment variables.
        </div>
      )}

      <div className="space-y-2 mb-5">
        <StatusRow
          label="Gmail"
          connected={isGmailConnected}
          connectedNote={`Emails sent from ${gmailAddress || "your Gmail"}`}
          disconnectedNote="Emails will be sent from noreply@flashbook.app"
        />
        <StatusRow
          label="Google Calendar"
          connected={isCalendarConnected}
          connectedNote="Confirmed bookings sync automatically"
          disconnectedNote="Confirmed bookings will not sync to calendar"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {googleConfigured ? (
          <Link
            href="/api/auth/google/connect"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
          >
            {hasRefreshToken ? "Reconnect Google" : "Connect Google"}
          </Link>
        ) : (
          <span className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-surface-container-high text-on-surface-variant cursor-not-allowed">
            Connect Google
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

function StatusRow({ label, connected, connectedNote, disconnectedNote }: {
  label: string; connected: boolean; connectedNote: string; disconnectedNote: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3">
      <div>
        <p className="text-sm font-medium text-on-surface">{label}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{connected ? connectedNote : disconnectedNote}</p>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ml-3 ${
        connected ? "bg-emerald-100 text-emerald-700" : "bg-surface-container text-on-surface-variant border border-outline-variant/30"
      }`}>
        {connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}
