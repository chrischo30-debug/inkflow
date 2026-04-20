import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const schema = z.object({
  form_header: z.string().max(200).optional(),
  form_subtext: z.string().max(500).optional(),
  form_button_text: z.string().max(100).optional(),
});

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = schema.parse(body);

    const { error } = await supabase
      .from("artists")
      .update({
        form_header: parsed.form_header ?? null,
        form_subtext: parsed.form_subtext ?? null,
        form_button_text: parsed.form_button_text ?? null,
      })
      .eq("id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.flatten() }, { status: 400 });
    }
    console.error("Form settings update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
