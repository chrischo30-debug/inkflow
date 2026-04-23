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

  // Prevent superusers from deleting themselves
  if (artistId === user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the target is not a superuser
  const { data: target } = await admin
    .from("artists")
    .select("email, is_superuser")
    .eq("id", artistId)
    .single();

  if (!target) return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  if (target.is_superuser) {
    return NextResponse.json({ error: "Cannot delete another superuser" }, { status: 400 });
  }

  // Delete the auth user — cascades to artists row via FK
  const { error } = await admin.auth.admin.deleteUser(artistId);
  if (error) {
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
