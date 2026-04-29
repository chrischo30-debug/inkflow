import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const KEYS = ["notify_new_submission", "notify_new_booking", "notify_reschedule", "notify_contact_form"] as const;
type Key = typeof KEYS[number];

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Partial<Record<Key, unknown>>;
  const updates: Partial<Record<Key, boolean>> = {};
  for (const k of KEYS) {
    if (k in body) {
      if (typeof body[k] !== "boolean") {
        return NextResponse.json({ error: `${k} must be a boolean` }, { status: 400 });
      }
      updates[k] = body[k] as boolean;
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("artists")
    .update(updates)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  return NextResponse.json({ success: true });
}
