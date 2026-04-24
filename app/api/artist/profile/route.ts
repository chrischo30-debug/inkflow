import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const profileSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  studio_name: z.string().optional(),
  style_tags: z.string().optional(),
});

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = profileSchema.parse(body);
    const normalizedSlug = parsed.slug.toLowerCase();

    const styleTags = (parsed.style_tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    // Explicit application-level check in addition to the DB unique index.
    // Guards against race conditions and gives a clean 409 instead of a 500.
    const { data: conflict } = await supabase
      .from("artists")
      .select("id")
      .ilike("slug", normalizedSlug)
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json({ error: "That public booking URL is already taken." }, { status: 409 });
    }

    const { error } = await supabase
      .from("artists")
      .update({
        name: parsed.name,
        slug: normalizedSlug,
        studio_name: parsed.studio_name || null,
        style_tags: styleTags,
      })
      .eq("id", user.id);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That public booking URL is already taken." }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid profile data", details: error.flatten() }, { status: 400 });
    }
    console.error("Artist profile update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
