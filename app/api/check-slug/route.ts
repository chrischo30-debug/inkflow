import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.toLowerCase().trim();

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ available: false, invalid: true });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from("artists").select("id").ilike("slug", slug).limit(1);
  if (user) query = query.neq("id", user.id);

  const { data } = await query;
  return NextResponse.json({ available: !data?.length });
}
