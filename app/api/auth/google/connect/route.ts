import { NextResponse } from "next/server";
import { buildGoogleOAuthUrl, getGoogleRedirectUri } from "@/lib/google-calendar";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const state = crypto.randomUUID();
  const redirectUri = getGoogleRedirectUri(origin);

  try {
    const authUrl = buildGoogleOAuthUrl({ state, redirectUri });
    const res = NextResponse.redirect(authUrl);
    res.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return res;
  } catch (error: unknown) {
    console.error("Google connect setup error:", error);
    const message = encodeURIComponent("Google Calendar is not configured yet.");
    return NextResponse.redirect(`${origin}/calendar?message=${message}`);
  }
}
