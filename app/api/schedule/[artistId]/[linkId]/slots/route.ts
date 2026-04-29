import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleAccessToken, getGoogleFreeBusy } from "@/lib/google-calendar";
import type { SchedulingLink } from "@/lib/pipeline-settings";

export const dynamic = "force-dynamic";

// Returns the UTC offset in minutes for a given timezone at the current moment.
// Positive = ahead of UTC (e.g. UTC+5:30 → 330), negative = behind (e.g. UTC-5 → -300).
function getUTCOffsetMinutes(tz: string, date: Date): number {
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  return (local.getTime() - utc.getTime()) / 60000;
}

// Build an ISO timestamp for a given date+hour+minute interpreted in `tz`.
function toUTCDate(dateStr: string, hour: number, minute: number, tz: string): Date {
  // Create a Date assuming the H:M is in UTC, then adjust by the tz offset.
  const naive = new Date(Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10)),
    hour, minute, 0,
  ));
  const offsetMinutes = getUTCOffsetMinutes(tz, naive);
  return new Date(naive.getTime() - offsetMinutes * 60000);
}

function overlaps(
  slotStart: Date, slotEnd: Date,
  busyStart: Date, busyEnd: Date,
): boolean {
  return slotStart < busyEnd && slotEnd > busyStart;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ artistId: string; linkId: string }> },
) {
  const { artistId, linkId } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("scheduling_links, google_refresh_token, calendar_sync_enabled, email")
    .eq("id", artistId)
    .single();

  if (!artist) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const links: SchedulingLink[] = Array.isArray(artist.scheduling_links) ? artist.scheduling_links : [];
  const link = links.find(l => l.id === linkId);
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  // Check global blocked dates — fetched separately so a missing column can't break availability
  let blockedDates: string[] = [];
  try {
    const { data: bd } = await admin
      .from("artists")
      .select("blocked_dates")
      .eq("id", artistId)
      .single();
    blockedDates = Array.isArray((bd as { blocked_dates?: unknown })?.blocked_dates)
      ? (bd as { blocked_dates: string[] }).blocked_dates
      : [];
  } catch { /* column not yet migrated — skip */ }

  if (blockedDates.includes(date)) {
    return NextResponse.json({ slots: [] });
  }

  // Check day-of-week in artist's timezone
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  // Adjust for timezone — get the actual local day
  const localMidnight = toUTCDate(date, 12, 0, link.timezone);
  const localDay = new Date(localMidnight.toLocaleString("en-US", { timeZone: link.timezone })).getDay();

  if (!link.days.includes(localDay)) {
    return NextResponse.json({ slots: [], dayOfWeek });
  }

  // If this link blocks the full day, check for any existing confirmed booking on this date
  if (link.block_full_day) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextDateStr = nextDate.toISOString().slice(0, 10);
    const { data: dayBookings } = await admin
      .from("bookings")
      .select("id")
      .eq("artist_id", artistId)
      .not("state", "in", '("cancelled","rejected")')
      .gte("appointment_date", `${date}T00:00:00.000Z`)
      .lt("appointment_date", `${nextDateStr}T00:00:00.000Z`)
      .limit(1);
    if (dayBookings && dayBookings.length > 0) {
      return NextResponse.json({ slots: [] });
    }
  }

  const buffer = Math.max(0, link.buffer_minutes ?? 0);
  const startMin = link.start_hour * 60;
  const endMin = link.end_hour * 60;

  // Generate all candidate slots. For half-day links, that's the half-day slot
  // at start_hour PLUS optional follow-up slots after (half_day + buffer).
  // Each candidate carries its own duration so half-day + follow-ups can coexist.
  const candidates: Array<{ minute: number; duration: number }> = [];

  if (link.is_half_day) {
    const halfDay = link.half_day_minutes ?? 240;
    if (startMin + halfDay <= endMin) {
      candidates.push({ minute: startMin, duration: halfDay });
    }
    const followups = link.half_day_followup_minutes ?? [];
    if (followups.length > 0) {
      const followupStart = startMin + halfDay + buffer;
      for (const dur of followups) {
        // 30-min increments from the earliest follow-up slot
        for (let m = followupStart; m + dur <= endMin; m += 30) {
          candidates.push({ minute: m, duration: dur });
        }
      }
    }
  } else {
    for (let m = startMin; m + link.duration_minutes <= endMin; m += 30) {
      candidates.push({ minute: m, duration: link.duration_minutes });
    }
  }

  const minutesToHHMM = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  // Pull existing FlashBooker bookings for this date — they should block slots
  // even if the artist isn't syncing them to Google. Use scheduled appointments
  // and treat them as busy [start, start + duration]. Without a per-booking
  // duration column, fall back to the link's primary duration.
  const dayStartISO = `${date}T00:00:00.000Z`;
  const nextDate = new Date(date); nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const dayEndISO = `${nextDate.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const { data: dayBookings } = await admin
    .from("bookings")
    .select("appointment_date")
    .eq("artist_id", artistId)
    .not("state", "in", '("cancelled","rejected")')
    .gte("appointment_date", dayStartISO)
    .lt("appointment_date", dayEndISO);
  const fallbackDuration = link.is_half_day ? (link.half_day_minutes ?? 240) : link.duration_minutes;
  const bookingBusy: Array<{ start: Date; end: Date }> = (dayBookings ?? [])
    .filter(b => b.appointment_date)
    .map(b => {
      const start = new Date(b.appointment_date as string);
      return { start, end: new Date(start.getTime() + fallbackDuration * 60000) };
    });

  // If no calendar connected, only DB bookings + buffer block slots
  if (!artist.google_refresh_token || !artist.calendar_sync_enabled) {
    // Inflate both ends of every busy block by buffer_minutes so a client
    // can't sandwich a session right before OR right after an existing one.
    const inflated = bookingBusy.map(b => ({
      start: new Date(b.start.getTime() - buffer * 60000),
      end: new Date(b.end.getTime() + buffer * 60000),
    }));
    const available = candidates.filter(c => {
      const slotStart = toUTCDate(date, Math.floor(c.minute / 60), c.minute % 60, link.timezone);
      const slotEnd = new Date(slotStart.getTime() + c.duration * 60000);
      return !inflated.some(b => overlaps(slotStart, slotEnd, b.start, b.end));
    });
    return NextResponse.json({
      slots: available.map(c => ({
        start: minutesToHHMM(c.minute),
        end: minutesToHHMM(c.minute + c.duration),
      })),
    });
  }

  // Fetch freeBusy from Google Calendar.
  // Fail closed: if the artist has calendar sync enabled but we can't read their
  // busy times, returning the unfiltered slot list would risk double-booking,
  // so we return zero slots + a calendar_error flag and let the client surface it.
  let busyPeriods: Array<{ start: string; end: string }> = [];
  try {
    const accessToken = await getGoogleAccessToken(admin, artistId, artist.google_refresh_token);
    if (!accessToken) {
      console.error("slots: getGoogleAccessToken returned null", { artistId });
      return NextResponse.json({ slots: [], calendar_error: true });
    }
    const dayStart = toUTCDate(date, link.start_hour, 0, link.timezone);
    const dayEnd = toUTCDate(date, link.end_hour, 0, link.timezone);
    // Per-link override wins. Otherwise fall back to the artist's saved selection.
    let calendarIds: string[] | undefined = link.calendar_ids?.length ? link.calendar_ids : undefined;
    if (!calendarIds) {
      try {
        const { data: sc } = await admin
          .from("artists")
          .select("synced_calendar_ids")
          .eq("id", artistId)
          .single();
        const raw = (sc as { synced_calendar_ids?: unknown })?.synced_calendar_ids;
        if (Array.isArray(raw) && raw.length > 0) calendarIds = raw as string[];
      } catch { /* column not yet migrated — fall back to primary in lib */ }
    }
    busyPeriods = await getGoogleFreeBusy({
      accessToken,
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      calendarIds,
    });
  } catch (err) {
    console.error("slots: Google freeBusy failed", { artistId, linkId, date, err });
    return NextResponse.json({ slots: [], calendar_error: true });
  }

  // Combine Google freeBusy + FlashBooker DB bookings, then inflate BOTH ends
  // of each busy block by buffer_minutes so a client can't book a session
  // that starts immediately after OR ends immediately before an existing one.
  const busy = [
    ...busyPeriods.map(b => ({ start: new Date(b.start), end: new Date(b.end) })),
    ...bookingBusy,
  ].map(b => ({
    start: new Date(b.start.getTime() - buffer * 60000),
    end: new Date(b.end.getTime() + buffer * 60000),
  }));

  const available = candidates.filter(c => {
    const slotStart = toUTCDate(date, Math.floor(c.minute / 60), c.minute % 60, link.timezone);
    const slotEnd = new Date(slotStart.getTime() + c.duration * 60000);
    return !busy.some(b => overlaps(slotStart, slotEnd, b.start, b.end));
  });

  return NextResponse.json({
    slots: available.map(c => ({
      start: minutesToHHMM(c.minute),
      end: minutesToHHMM(c.minute + c.duration),
    })),
  });
}
