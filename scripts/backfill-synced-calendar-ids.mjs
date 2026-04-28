#!/usr/bin/env node
// Backfill artists.synced_calendar_ids for artists who connected Google Calendar
// before the per-artist calendar selection feature shipped.
//
// Behavior change (without backfill): freeBusy + event listing fall back to
// ["primary"] for artists with NULL synced_calendar_ids. Existing users with
// secondary calendars (shared studio cals, etc.) would suddenly stop seeing
// those as busy. This script preserves prior behavior by writing every calendar
// from each connected artist's Google calendarList into synced_calendar_ids.
//
// Run once after deploying the migration:
//   node scripts/backfill-synced-calendar-ids.mjs
//
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_ENCRYPTION_KEY (if used).

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ENC_KEY_HEX = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  process.exit(1);
}

function getEncKey() {
  if (!ENC_KEY_HEX) return null;
  const buf = Buffer.from(ENC_KEY_HEX, "hex");
  return buf.length === 32 ? buf : null;
}

function decryptToken(text) {
  const key = getEncKey();
  if (!key || !text.includes(":")) return text;
  try {
    const [ivHex, encHex] = text.split(":", 2);
    const iv = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return text;
  }
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`refresh failed: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function listCalendarIds(accessToken) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`calendarList fetch failed: ${await res.text()}`);
  }
  const data = await res.json();
  return (data.items ?? []).map(c => c.id).filter(Boolean);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: artists, error } = await supabase
    .from("artists")
    .select("id, google_refresh_token, calendar_sync_enabled, synced_calendar_ids")
    .eq("calendar_sync_enabled", true)
    .not("google_refresh_token", "is", null);

  if (error) {
    console.error("Failed to load artists:", error);
    process.exit(1);
  }

  console.log(`Found ${artists.length} connected artist(s).`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const artist of artists) {
    if (Array.isArray(artist.synced_calendar_ids) && artist.synced_calendar_ids.length > 0) {
      skipped++;
      continue;
    }
    try {
      const refreshToken = decryptToken(artist.google_refresh_token);
      const accessToken = await refreshAccessToken(refreshToken);
      const ids = await listCalendarIds(accessToken);
      if (ids.length === 0) {
        console.warn(`[${artist.id}] no calendars returned, skipping`);
        skipped++;
        continue;
      }
      const { error: updErr } = await supabase
        .from("artists")
        .update({ synced_calendar_ids: ids })
        .eq("id", artist.id);
      if (updErr) throw updErr;
      console.log(`[${artist.id}] backfilled ${ids.length} calendar(s)`);
      updated++;
    } catch (err) {
      console.error(`[${artist.id}] failed:`, err.message ?? err);
      failed++;
    }
  }

  console.log(`Done. updated=${updated} skipped=${skipped} failed=${failed}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
