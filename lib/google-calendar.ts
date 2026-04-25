import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Token encryption ──────────────────────────────────────────────────────────
// Set GOOGLE_TOKEN_ENCRYPTION_KEY to a 64-char hex string (32 random bytes).
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Tokens that pre-date encryption are stored plain-text and still work until
// the artist reconnects, at which point they get re-saved encrypted.

function getEncKey(): Buffer | null {
  const k = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!k) return null;
  const buf = Buffer.from(k, "hex");
  return buf.length === 32 ? buf : null;
}

export function encryptToken(text: string): string {
  const key = getEncKey();
  if (!key) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptToken(text: string): string {
  const key = getEncKey();
  if (!key || !text.includes(":")) return text; // plain-text fallback
  try {
    const [ivHex, encHex] = text.split(":", 2);
    const iv = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return text; // not actually encrypted — return as-is
  }
}

export class InvalidGrantError extends Error {
  constructor() { super("Google refresh token revoked"); this.name = "InvalidGrantError"; }
}

// Decrypt the stored refresh token, exchange it for a fresh access token, and
// handle revocation by marking the artist as disconnected in the DB.
export async function getGoogleAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  artistId: string,
  encryptedRefreshToken: string,
): Promise<string | null> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  try {
    return await refreshGoogleAccessToken(refreshToken);
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      await supabase
        .from("artists")
        .update({ calendar_sync_enabled: false, google_refresh_token: null })
        .eq("id", artistId);
      return null;
    }
    throw err;
  }
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

interface GoogleCalendarListEvent {
  id: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }
  return { clientId, clientSecret };
}

export function getGoogleRedirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI ?? `${origin}/api/auth/google/callback`;
}

export function buildGoogleOAuthUrl({
  state,
  redirectUri,
}: {
  state: string;
  redirectUri: string;
}) {
  const { clientId } = getGoogleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCodeForTokens({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = getGoogleConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleConfig();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (body.error === "invalid_grant") throw new InvalidGrantError();
    throw new Error(`Google access token refresh failed: ${JSON.stringify(body)}`);
  }

  const data = (await res.json()) as GoogleTokenResponse;
  return data.access_token;
}

export async function createGoogleCalendarEvent({
  accessToken,
  summary,
  description,
  startDateTime,
  endDateTime,
}: {
  accessToken: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
}) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google event creation failed: ${text}`);
  }

  const event = (await res.json()) as { id: string };
  return event.id;
}

export async function deleteGoogleCalendarEvent({
  accessToken,
  eventId,
}: {
  accessToken: string;
  eventId: string;
}) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Google event deletion failed: ${text}`);
  }
}

export async function updateGoogleCalendarEvent({
  accessToken,
  eventId,
  summary,
  description,
  startDateTime,
  endDateTime,
}: {
  accessToken: string;
  eventId: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
}) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google event update failed: ${text}`);
  }
  const event = (await res.json()) as { id: string };
  return event.id;
}

export async function listGoogleCalendarEvents({
  accessToken,
  timeMin,
  timeMax,
  calendarId = "primary",
}: {
  accessToken: string;
  timeMin: string;
  timeMax: string;
  calendarId?: string;
}) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google events fetch failed (${calendarId}): ${text}`);
  }

  const data = (await res.json()) as { items?: GoogleCalendarListEvent[] };
  return data.items ?? [];
}

export async function listAllGoogleCalendarEvents({
  accessToken,
  timeMin,
  timeMax,
}: {
  accessToken: string;
  timeMin: string;
  timeMax: string;
}): Promise<GoogleCalendarListEvent[]> {
  // Fetch all calendars the user has access to
  const calRes = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  let calendarIds: string[] = ["primary"];
  if (calRes.ok) {
    const calData = (await calRes.json()) as { items?: { id: string }[] };
    const ids = (calData.items ?? []).map(c => c.id).filter(Boolean);
    if (ids.length > 0) calendarIds = ids;
  }

  // Fetch events from all calendars in parallel, deduplicate by event id
  const results = await Promise.allSettled(
    calendarIds.map(id => listGoogleCalendarEvents({ accessToken, timeMin, timeMax, calendarId: id })),
  );

  const seen = new Set<string>();
  const all: GoogleCalendarListEvent[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const ev of r.value) {
        if (ev.id && !seen.has(ev.id)) { seen.add(ev.id); all.push(ev); }
      }
    }
  }
  return all;
}
