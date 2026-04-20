import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const socialLinkSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "twitter", "facebook", "website"]),
  url: z.string().url(),
});

const schema = z.object({
  booking_bg_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  booking_bg_image_url: z.string().url().nullable().optional(),
  booking_layout: z.enum(["centered", "banner", "minimal"]).optional(),
  booking_font: z.enum(["sans", "serif", "mono"]).optional(),
  booking_text_color: z.enum(["dark", "light"]).optional(),
  logo_url: z.string().url().nullable().optional(),
  website_url: z.string().url().or(z.literal("")).optional(),
  social_links: z.array(socialLinkSchema).optional(),
  show_social_on_booking: z.boolean().optional(),
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
      .update(parsed)
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.flatten() }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
