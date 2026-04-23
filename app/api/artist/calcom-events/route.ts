import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export interface CalcomEvent {
  slug: string;
  title: string;
}

export interface CalcomProfile {
  username: string;
  events: CalcomEvent[];
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: artist } = await supabase
    .from("artists")
    .select("calcom_api_key")
    .eq("id", user.id)
    .single();

  if (!artist?.calcom_api_key) {
    return NextResponse.json({ error: "Cal.com not connected" }, { status: 400 });
  }

  const headers = {
    "Authorization": `Bearer ${artist.calcom_api_key}`,
    "cal-api-version": "2024-08-13",
  };

  const [meRes, eventsRes] = await Promise.all([
    fetch("https://api.cal.com/v2/me", { headers }),
    fetch("https://api.cal.com/v2/event-types", { headers }),
  ]);

  if (!meRes.ok) return NextResponse.json({ error: "Cal.com API error" }, { status: 502 });

  const me = await meRes.json();
  const username: string = me.data?.username ?? "";

  let events: CalcomEvent[] = [];
  if (eventsRes.ok) {
    const evData = await eventsRes.json();
    const rawEvents: { slug?: string; title?: string }[] =
      evData.data?.eventTypeGroups?.[0]?.eventTypes ?? evData.data ?? [];
    events = rawEvents
      .filter((e) => e.slug && e.title)
      .map((e) => ({ slug: e.slug!, title: e.title! }));
  }

  return NextResponse.json({ username, events } satisfies CalcomProfile);
}
