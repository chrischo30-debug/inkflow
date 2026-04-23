import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperUser } from "@/lib/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isSuperUser(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { artistId } = await req.json();
  if (!artistId) return NextResponse.json({ error: "Missing artistId" }, { status: 400 });

  const admin = createAdminClient();

  const { data: artist } = await admin
    .from("artists")
    .select("email")
    .eq("id", artistId)
    .single();

  if (!artist?.email) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: artist.email,
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ error: "Failed to generate reset link" }, { status: 500 });
  }

  return NextResponse.json({ link: data.properties.action_link, email: artist.email });
}
