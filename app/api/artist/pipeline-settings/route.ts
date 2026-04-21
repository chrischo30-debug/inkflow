import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pipeline_settings, calendar_links } = body;

  const update: Record<string, unknown> = {};
  if (pipeline_settings !== undefined) update.pipeline_settings = pipeline_settings;
  if (calendar_links !== undefined) update.calendar_links = calendar_links;

  const { error } = await supabase.from("artists").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
