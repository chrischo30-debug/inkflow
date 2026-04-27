import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const settingsSchema = z.object({
  kit_api_key: z.string().nullish(),
  kit_form_id: z.string().nullish(),
  newsletter_form_enabled: z.boolean().nullish(),
  newsletter_form_header: z.string().max(200).nullish(),
  newsletter_form_subtext: z.string().max(500).nullish(),
  newsletter_form_button_text: z.string().max(100).nullish(),
  newsletter_form_confirmation_message: z.string().max(500).nullish(),
  show_newsletter_on_closed: z.boolean().nullish(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("artists")
    .select("slug, kit_api_key, kit_form_id, newsletter_form_enabled, newsletter_form_header, newsletter_form_subtext, newsletter_form_button_text, newsletter_form_confirmation_message, show_newsletter_on_closed")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ settings: data ?? {} });
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = settingsSchema.parse(body);

    const { error } = await supabase
      .from("artists")
      .update(parsed)
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid settings", details: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
