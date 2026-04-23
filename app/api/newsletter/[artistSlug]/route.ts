import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const subscribeSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  first_name: z.string().optional(),
});

async function subscribeToKit(apiKey: string, formId: string, email: string, firstName?: string) {
  const res = await fetch(`https://api.convertkit.com/v3/forms/${formId}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      api_key: apiKey,
      email,
      first_name: firstName || undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `Kit API error ${res.status}`);
  }

  return res.json();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  try {
    const { artistSlug } = await params;
    const admin = createAdminClient();

    const { data: artist } = await admin
      .from("artists")
      .select("id, newsletter_form_enabled, kit_api_key, kit_form_id")
      .eq("slug", artistSlug)
      .single();

    if (!artist) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!artist.newsletter_form_enabled) {
      return NextResponse.json({ error: "Newsletter form is not enabled" }, { status: 403 });
    }
    if (!artist.kit_api_key || !artist.kit_form_id) {
      return NextResponse.json({ error: "Newsletter is not fully configured" }, { status: 503 });
    }

    const body = await req.json();
    const parsed = subscribeSchema.parse(body);

    await subscribeToKit(
      artist.kit_api_key,
      artist.kit_form_id,
      parsed.email.trim().toLowerCase(),
      parsed.first_name?.trim() || undefined,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      return NextResponse.json({ error: first?.message ?? "Invalid request" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Something went wrong";
    console.error("Newsletter subscribe error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
