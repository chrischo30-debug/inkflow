import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = ["stripe_api_key", "calcom_api_key", "stripe_webhook_secret"] as const;
  type AllowedKey = typeof allowed[number];

  const update: Partial<Record<AllowedKey, string>> = {};
  for (const key of allowed) {
    if (key in body && typeof body[key] === "string") {
      update[key] = body[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const { error } = await supabase.from("artists").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
