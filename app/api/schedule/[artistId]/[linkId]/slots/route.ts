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

  // Generate all candidate slots (30-min increments, duration must fit before end_hour)
  const candidates: Array<{ hour: number; minute: number }> = [];
  let h = link.start_hour;
  let m = 0;
  while (true) {
    const endMinutes = h * 60 + m + link.duration_minutes;
    if (endMinutes > link.end_hour * 60) break;
    candidates.push({ hour: h, minute: m });
    m += 30;
    if (m >= 60) { h++; m = 0; }
  }

  // If no calendar connected, return all candidate slots
  if (!artist.google_refresh_token || !artist.calendar_sync_enabled) {
    return NextResponse.json({
      slots: candidates.map(c => ({
        start: `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`,
        end: (() => {
          const em = c.hour * 60 + c.minute + link.duration_minutes;
          return `${String(Math.floor(em / 60)).padStart(2, "0")}:${String(em % 60).padStart(2, "0")}`;
        })(),
      })),
    });
  }

  // Fetch freeBusy from Google Calendar
  // Note: freeBusy only returns opaque (busy) periods — free/transparent events
  // (birthdays, holidays) are correctly ignored. Use Blocked Dates for explicit closures.
  let busyPeriods: Array<{ start: string; end: string }> = [];
  try {
    const accessToken = await getGoogleAccessToken(admin, artistId, artist.google_refresh_token);
    if (accessToken) {
      const dayStart = toUTCDate(date, link.start_hour, 0, link.timezone);
      const dayEnd = toUTCDate(date, link.end_hour, 0, link.timezone);
      const calendarIds: string[] | undefined = link.calendar_ids?.length ? link.calendar_ids : undefined;
      busyPeriods = await getGoogleFreeBusy({
        accessToken,
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        calendarIds,
      });
    }
  } catch {
    // If calendar checks fail, return all candidates
  }

  const busy = busyPeriods.map(b => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));

  const available = candidates.filter(c => {
    const slotStart = toUTCDate(date, c.hour, c.minute, link.timezone);
    const endMinutes = c.hour * 60 + c.minute + link.duration_minutes;
    const slotEnd = toUTCDate(date, Math.floor(endMinutes / 60), endMinutes % 60, link.timezone);
    return !busy.some(b => overlaps(slotStart, slotEnd, b.start, b.end));
  });

  return NextResponse.json({
    slots: available.map(c => ({
      start: `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`,
      end: (() => {
        const em = c.hour * 60 + c.minute + link.duration_minutes;
        return `${String(Math.floor(em / 60)).padStart(2, "0")}:${String(em % 60).padStart(2, "0")}`;
      })(),
    })),
  });
}
