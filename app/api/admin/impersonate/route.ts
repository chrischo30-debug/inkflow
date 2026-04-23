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

  // Generate the OTP token
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: artist.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: "Failed to generate link" }, { status: 500 });
  }

  // Immediately exchange the hashed token server-side for a real session.
  // This consumes the OTP before it can expire, so the client never races with OTP TTL.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
    },
    body: JSON.stringify({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.text();
    console.error("Supabase verify failed:", err);
    return NextResponse.json({ error: "Failed to exchange token for session" }, { status: 500 });
  }

  const session = await verifyRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return NextResponse.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}
