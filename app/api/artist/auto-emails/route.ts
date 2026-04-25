import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const bodySchema = z.object({ auto_emails_enabled: z.boolean() });

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { auto_emails_enabled } = bodySchema.parse(await req.json());

    const { error } = await supabase
      .from("artists")
      .update({ auto_emails_enabled })
      .eq("id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    console.error("auto-emails update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
