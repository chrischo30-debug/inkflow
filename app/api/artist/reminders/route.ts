import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { reminder_enabled, reminder_hours_before } = body as {
    reminder_enabled: boolean;
    reminder_hours_before: number;
  };

  if (typeof reminder_enabled !== "boolean") {
    return NextResponse.json({ error: "reminder_enabled must be a boolean" }, { status: 400 });
  }
  if (!Number.isInteger(reminder_hours_before) || reminder_hours_before < 1) {
    return NextResponse.json({ error: "reminder_hours_before must be a positive integer" }, { status: 400 });
  }

  const { error } = await supabase
    .from("artists")
    .update({ reminder_enabled, reminder_hours_before })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  return NextResponse.json({ success: true });
}
