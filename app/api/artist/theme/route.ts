import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

const schema = z.object({
  accent_theme: z.enum(["crimson", "blue"]),
});

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { accent_theme } = schema.parse(body);

    const { error } = await supabase
      .from("artists")
      .update({ accent_theme })
      .eq("id", user.id);

    if (error) throw error;

    const cookieStore = await cookies();
    cookieStore.set("accent_theme", accent_theme, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid theme value" }, { status: 400 });
    }
    console.error("Theme update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
