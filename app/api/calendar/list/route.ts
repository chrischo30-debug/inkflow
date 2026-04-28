import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGoogleAccessToken, listGoogleCalendarList } from "@/lib/google-calendar";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: artist } = await supabase
      .from("artists")
      .select("calendar_sync_enabled, google_refresh_token, synced_calendar_ids")
      .eq("id", user.id)
      .single();

    if (!artist?.calendar_sync_enabled || !artist.google_refresh_token) {
      return NextResponse.json({ connected: false, calendars: [], selected: [] });
    }

    const accessToken = await getGoogleAccessToken(supabase, user.id, artist.google_refresh_token);
    if (!accessToken) {
      return NextResponse.json({ connected: false, calendars: [], selected: [] });
    }

    const calendars = await listGoogleCalendarList(accessToken);
    const selected: string[] = Array.isArray(artist.synced_calendar_ids)
      ? artist.synced_calendar_ids
      : [];

    return NextResponse.json({ connected: true, calendars, selected });
  } catch (err) {
    console.error("calendar/list failed", err);
    return NextResponse.json({ error: "Failed to load calendars" }, { status: 500 });
  }
}
