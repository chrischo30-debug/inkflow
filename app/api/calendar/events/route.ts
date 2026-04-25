import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createGoogleCalendarEvent, listAllGoogleCalendarEvents, getGoogleAccessToken, updateGoogleCalendarEvent } from "@/lib/google-calendar";
import type { Booking } from "@/lib/types";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  source: "google" | "flashbook";
  link?: string;
};

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start") ?? new Date().toISOString();
    const end = searchParams.get("end") ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString();

    const { data: artist } = await supabase
      .from("artists")
      .select("calendar_sync_enabled, google_refresh_token")
      .eq("id", user.id)
      .single();

    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("id, client_name, description, appointment_date, state")
      .eq("artist_id", user.id)
      .eq("state", "confirmed")
      .gte("appointment_date", start)
      .lte("appointment_date", end)
      .order("appointment_date", { ascending: true });

    const bookingEvents: CalendarEvent[] = ((bookingRows ?? []) as Partial<Booking>[])
      .filter((row) => typeof row.id === "string" && typeof row.client_name === "string" && typeof row.appointment_date === "string")
      .map((row) => {
        const startDate = row.appointment_date as string;
        const endDate = new Date(new Date(startDate).getTime() + 1000 * 60 * 60 * 2).toISOString();
        return {
          id: `booking-${row.id}`,
          title: `Appointment: ${row.client_name as string}`,
          start: startDate,
          end: endDate,
          source: "flashbook" as const,
        };
      });

    let googleEvents: CalendarEvent[] = [];
    let googleSyncError = "";
    if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
      try {
        const accessToken = await getGoogleAccessToken(supabase, user.id, artist.google_refresh_token);
        if (!accessToken) { googleSyncError = "Google Calendar disconnected. Please reconnect."; }
        const rows = accessToken ? await listAllGoogleCalendarEvents({
          accessToken,
          timeMin: start,
          timeMax: end,
        }) : [];
        googleEvents = rows
          .filter((event) => Boolean(event.id && (event.start?.dateTime || event.start?.date)))
          .map((event) => ({
            id: `google-${event.id}`,
            title: event.summary || "Google Calendar Event",
            start: event.start?.dateTime || event.start?.date || "",
            end: event.end?.dateTime || event.end?.date,
            source: "google" as const,
            link: event.htmlLink,
          }));
      } catch (googleError: unknown) {
        console.error("Google calendar fetch failed:", googleError);
        googleSyncError = "Google Calendar sync failed. Reconnect Google Calendar to continue syncing.";
      }
    }

    const events = [...bookingEvents, ...googleEvents].sort((a, b) => a.start.localeCompare(b.start));
    return NextResponse.json({
      connected: Boolean(artist?.calendar_sync_enabled && artist?.google_refresh_token),
      google_sync_error: googleSyncError || undefined,
      events,
    });
  } catch (error: unknown) {
    console.error("Calendar events API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, description, startDateTime, endDateTime } = await req.json() as {
      title: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
    };

    if (!title || !startDateTime || !endDateTime) {
      return NextResponse.json({ error: "title, startDateTime, and endDateTime are required" }, { status: 400 });
    }

    const { data: artist } = await supabase
      .from("artists")
      .select("calendar_sync_enabled, google_refresh_token")
      .eq("id", user.id)
      .single();

    if (!artist?.calendar_sync_enabled || !artist.google_refresh_token) {
      return NextResponse.json({ error: "Google Calendar is not connected. Connect it in Settings first." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken(supabase, user.id, artist.google_refresh_token);
    if (!accessToken) return NextResponse.json({ error: "Google Calendar disconnected. Please reconnect." }, { status: 400 });
    const eventId = await createGoogleCalendarEvent({ accessToken, summary: title, description, startDateTime, endDateTime });

    return NextResponse.json({ success: true, eventId });
  } catch (error: unknown) {
    console.error("Create calendar event error:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { googleEventId, title, description, startDateTime, endDateTime } = await req.json() as {
      googleEventId: string;
      title: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
    };

    if (!googleEventId || !title || !startDateTime || !endDateTime) {
      return NextResponse.json({ error: "googleEventId, title, startDateTime, and endDateTime are required" }, { status: 400 });
    }

    const { data: artist } = await supabase
      .from("artists")
      .select("calendar_sync_enabled, google_refresh_token")
      .eq("id", user.id)
      .single();

    if (!artist?.calendar_sync_enabled || !artist.google_refresh_token) {
      return NextResponse.json({ error: "Google Calendar is not connected." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken(supabase, user.id, artist.google_refresh_token);
    if (!accessToken) return NextResponse.json({ error: "Google Calendar disconnected. Please reconnect." }, { status: 400 });
    await updateGoogleCalendarEvent({ accessToken, eventId: googleEventId, summary: title, description, startDateTime, endDateTime });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Update calendar event error:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}
