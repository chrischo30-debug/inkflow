import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { old_email, new_name, new_email, new_phone } = await req.json();
  if (!old_email) return NextResponse.json({ error: "old_email required" }, { status: 400 });

  const updates: Record<string, string | null> = {};
  if (new_name !== undefined) updates.client_name = new_name;
  if (new_email !== undefined) updates.client_email = new_email;
  if (new_phone !== undefined) updates.client_phone = new_phone || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("bookings")
    .update(updates)
    .eq("artist_id", user.id)
    .eq("client_email", old_email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("artist_id", user.id)
    .eq("client_email", email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
