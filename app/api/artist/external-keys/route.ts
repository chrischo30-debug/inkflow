import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const STRING_FIELDS = [
  "stripe_api_key",
  "stripe_webhook_secret",
  "square_access_token",
  "square_webhook_signature_key",
  "square_location_id",
  "square_environment",
] as const;

const ENUM_FIELDS: Record<string, readonly string[]> = {
  payment_provider: ["stripe", "square", ""],
  square_environment: ["production", "sandbox"],
};

type AllowedKey = typeof STRING_FIELDS[number] | "payment_provider";

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const update: Partial<Record<AllowedKey, string | null>> = {};

  for (const key of STRING_FIELDS) {
    if (key in body && typeof body[key] === "string") {
      const allowedValues = ENUM_FIELDS[key];
      const value = body[key] as string;
      if (allowedValues && !allowedValues.includes(value)) {
        return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
      }
      update[key] = value;
    }
  }

  if ("payment_provider" in body) {
    const value = body.payment_provider;
    if (value === null || value === "") {
      update.payment_provider = null;
    } else if (typeof value === "string" && ENUM_FIELDS.payment_provider.includes(value)) {
      update.payment_provider = value;
    } else {
      return NextResponse.json({ error: "Invalid payment_provider" }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const { error } = await supabase.from("artists").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
