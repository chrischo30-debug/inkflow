import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { listGmailThreads, getGmailThreadSummary } from "@/lib/gmail";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: artist } = await supabase
    .from("artists")
    .select("google_refresh_token, gmail_connected")
    .eq("id", user.id)
    .single();

  if (!artist?.google_refresh_token || !artist.gmail_connected) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const pageToken = searchParams.get("pageToken") ?? undefined;

  try {
    const { threads: rawThreads, nextPageToken } = await listGmailThreads(
      artist.google_refresh_token,
      25,
      pageToken,
    );

    if (!rawThreads.length) {
      return NextResponse.json({ threads: [], nextPageToken: null });
    }

    const threads = await Promise.all(
      rawThreads.map(t =>
        getGmailThreadSummary(artist.google_refresh_token!, t.id, t.snippet),
      ),
    );

    return NextResponse.json({ threads, nextPageToken: nextPageToken ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("403") || msg.includes("401") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
