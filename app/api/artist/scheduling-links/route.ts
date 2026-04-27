import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const linkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  duration_minutes: z.number().int().min(60),
  days: z.array(z.number().int().min(0).max(6)),
  start_hour: z.number().int().min(0).max(23),
  end_hour: z.number().int().min(1).max(23),
  timezone: z.string().min(1),
  calendar_ids: z.array(z.string()).nullish(),
  block_full_day: z.boolean().nullish(),
  confirmation_message: z.string().nullish(),
});

const bodySchema = z.object({
  links: z.array(linkSchema),
});

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { links } = bodySchema.parse(body);

    const { error } = await supabase
      .from("artists")
      .update({ scheduling_links: links })
      .eq("id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.flatten() }, { status: 400 });
    }
    console.error("Scheduling links update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
