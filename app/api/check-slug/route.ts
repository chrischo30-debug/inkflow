import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.toLowerCase().trim();

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ available: false, invalid: true });
  }

  // Identify the current user so we can exclude their own row. Uses the
  // normal server client (with user cookies) — just to read auth.
  const authed = await createClient();
  const { data: { user } } = await authed.auth.getUser();

  // Do the lookup with the service client so RLS doesn't hide other
  // artists' rows. The artists table has a 'own row only' policy that
  // would otherwise return an empty set for any slug belonging to
  // someone else, falsely reporting 'available'.
  const svc = createServiceClient();
  let query = svc.from("artists").select("id").ilike("slug", slug).limit(1);
  if (user) query = query.neq("id", user.id);

  const { data } = await query;
  return NextResponse.json({ available: !data?.length });
}
