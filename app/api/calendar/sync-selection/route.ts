import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { calendar_ids?: unknown };
    if (!Array.isArray(body.calendar_ids)) {
      return NextResponse.json({ error: "calendar_ids must be an array" }, { status: 400 });
    }
    const ids = body.calendar_ids
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .slice(0, 100);

    const { error } = await supabase
      .from("artists")
      .update({ synced_calendar_ids: ids.length > 0 ? ids : null })
      .eq("id", user.id);

    if (error) {
      console.error("sync-selection update failed", error);
      return NextResponse.json({ error: "Failed to save selection" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, selected: ids });
  } catch (err) {
    console.error("sync-selection failed", err);
    return NextResponse.json({ error: "Failed to save selection" }, { status: 500 });
  }
}
