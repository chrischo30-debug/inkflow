import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const origin = new URL(request.url).origin;
    if (!user) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const { error } = await supabase
      .from("artists")
      .update({
        calendar_sync_enabled: false,
        google_refresh_token: null,
        gmail_connected: false,
        gmail_address: null,
      })
      .eq("id", user.id);

    if (error) throw error;

    return NextResponse.redirect(`${origin}/calendar?message=${encodeURIComponent("Google Calendar disconnected.")}`);
  } catch (error: unknown) {
    console.error("Google disconnect error:", error);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(
      `${origin}/calendar?message=${encodeURIComponent("Could not disconnect Google Calendar right now.")}`
    );
  }
}
