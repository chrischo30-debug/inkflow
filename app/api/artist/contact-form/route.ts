import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const settingsSchema = z.object({
  contact_form_enabled: z.boolean().nullish(),
  contact_form_header: z.string().max(200).nullish(),
  contact_form_subtext: z.string().max(500).nullish(),
  contact_form_button_text: z.string().max(100).nullish(),
  contact_form_confirmation_message: z.string().max(500).nullish(),
  show_contact_on_closed: z.boolean().nullish(),
  contact_phone_enabled: z.boolean().nullish(),
  contact_phone_required: z.boolean().nullish(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("artists")
    .select("contact_form_enabled, contact_form_header, contact_form_subtext, contact_form_button_text, contact_form_confirmation_message, show_contact_on_closed, contact_phone_enabled, contact_phone_required, slug")
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

    // If phone is disabled, also clear required
    const patch = {
      ...parsed,
      ...(parsed.contact_phone_enabled === false ? { contact_phone_required: false } : {}),
    };

    const { error } = await supabase
      .from("artists")
      .update(patch)
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
