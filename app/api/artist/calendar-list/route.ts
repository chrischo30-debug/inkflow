import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleAccessToken } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("google_refresh_token, calendar_sync_enabled")
    .eq("id", user.id)
    .single();

  if (!artist?.google_refresh_token || !artist.calendar_sync_enabled) {
    return NextResponse.json({ calendars: [] });
  }

  const accessToken = await getGoogleAccessToken(admin, user.id, artist.google_refresh_token);
  if (!accessToken) return NextResponse.json({ calendars: [] });

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return NextResponse.json({ calendars: [] });

  const data = (await res.json()) as {
    items?: { id: string; summary: string; primary?: boolean; backgroundColor?: string }[];
  };

  const calendars = (data.items ?? []).map(c => ({
    id: c.id,
    summary: c.summary,
    primary: c.primary ?? false,
    color: c.backgroundColor ?? "#4285F4",
  }));

  return NextResponse.json({ calendars });
}
