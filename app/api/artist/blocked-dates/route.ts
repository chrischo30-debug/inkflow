import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

const bodySchema = z.object({
  blocked_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("artists")
    .select("blocked_dates")
    .eq("id", user.id)
    .single();

  const blocked_dates: string[] = Array.isArray(data?.blocked_dates) ? data.blocked_dates : [];
  return NextResponse.json({ blocked_dates });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("artists")
    .update({ blocked_dates: body.blocked_dates })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
