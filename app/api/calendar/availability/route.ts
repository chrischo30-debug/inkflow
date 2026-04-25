import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGoogleAccessToken, getGoogleFreeBusy } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

// Returns busy intervals + blocked dates for the AddBookingModal date/time picker.
// Mirrors the freeBusy-based checks used by /api/schedule/[artistId]/[linkId]/slots:
// freeBusy ignores transparent events (birthdays, holidays) so they don't falsely
// block the artist when picking a time from inside the app.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start") ?? new Date().toISOString();
    const end = searchParams.get("end") ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString();

    const { data: artist } = await supabase
      .from("artists")
      .select("calendar_sync_enabled, google_refresh_token")
      .eq("id", user.id)
      .single();

    let blockedDates: string[] = [];
    try {
      const { data: bd } = await supabase
        .from("artists")
        .select("blocked_dates")
        .eq("id", user.id)
        .single();
      const raw = (bd as { blocked_dates?: unknown })?.blocked_dates;
      blockedDates = Array.isArray(raw) ? (raw as string[]) : [];
    } catch { /* column not yet migrated — skip */ }

    type Busy = { start: string; end: string; source: "google" | "flashbook" };
    const busy: Busy[] = [];

    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("id, appointment_date, state")
      .eq("artist_id", user.id)
      .eq("state", "confirmed")
      .gte("appointment_date", start)
      .lte("appointment_date", end);

    for (const row of (bookingRows ?? []) as { id: string; appointment_date: string }[]) {
      if (!row.appointment_date) continue;
      const s = new Date(row.appointment_date);
      const e = new Date(s.getTime() + 1000 * 60 * 60 * 2);
      busy.push({ start: s.toISOString(), end: e.toISOString(), source: "flashbook" });
    }

    const connected = Boolean(artist?.calendar_sync_enabled && artist?.google_refresh_token);
    let googleSyncError: string | undefined;

    if (connected && artist?.google_refresh_token) {
      try {
        const accessToken = await getGoogleAccessToken(supabase, user.id, artist.google_refresh_token);
        if (!accessToken) {
          googleSyncError = "Google Calendar disconnected. Please reconnect.";
        } else {
          const periods = await getGoogleFreeBusy({ accessToken, timeMin: start, timeMax: end });
          for (const p of periods) busy.push({ start: p.start, end: p.end, source: "google" });
        }
      } catch (err) {
        console.error("freeBusy fetch failed:", err);
        googleSyncError = "Google Calendar sync failed. Reconnect Google Calendar to continue syncing.";
      }
    }

    busy.sort((a, b) => a.start.localeCompare(b.start));

    return NextResponse.json({
      connected,
      blockedDates,
      busy,
      google_sync_error: googleSyncError,
    });
  } catch (error: unknown) {
    console.error("Calendar availability API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
