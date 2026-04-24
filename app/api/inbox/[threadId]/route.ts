import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getGmailThreadDetail, markGmailThreadRead } from "@/lib/gmail";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: artist } = await supabase
    .from("artists")
    .select("google_refresh_token")
    .eq("id", user.id)
    .single();

  if (!artist?.google_refresh_token) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
  }

  try {
    const [detail] = await Promise.all([
      getGmailThreadDetail(artist.google_refresh_token, threadId),
      markGmailThreadRead(artist.google_refresh_token, threadId),
    ]);
    return NextResponse.json(detail);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("403") || msg.includes("401") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
