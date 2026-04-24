import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { sendViaGmail } from "@/lib/gmail";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: artist } = await supabase
    .from("artists")
    .select("name, google_refresh_token, gmail_address")
    .eq("id", user.id)
    .single();

  if (!artist?.google_refresh_token || !artist.gmail_address) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
  }

  const { to, subject, body, threadId } = (await req.json()) as {
    to: string;
    subject: string;
    body: string;
    threadId: string;
  };

  if (!to || !body) {
    return NextResponse.json({ error: "Missing to or body" }, { status: 400 });
  }

  try {
    const result = await sendViaGmail({
      refreshToken: artist.google_refresh_token,
      fromAddress: artist.gmail_address,
      fromName: artist.name ?? "",
      to,
      subject: subject || "Re: (no subject)",
      body,
      threadId,
    });
    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 },
    );
  }
}
