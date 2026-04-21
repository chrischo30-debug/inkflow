import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { exchangeGoogleCodeForTokens, getGoogleRedirectUri } from "@/lib/google-calendar";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;

  const redirectToCalendar = (message: string) => {
    const res = NextResponse.redirect(`${origin}/calendar?message=${encodeURIComponent(message)}`);
    res.cookies.delete("google_oauth_state");
    return res;
  };

  if (oauthError) {
    return redirectToCalendar(`Google authorization failed: ${oauthError}`);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToCalendar("Google authorization could not be verified. Try connecting again.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const res = NextResponse.redirect(`${origin}/login?message=${encodeURIComponent("Please sign in and connect Google again.")}`);
    res.cookies.delete("google_oauth_state");
    return res;
  }

  try {
    const redirectUri = getGoogleRedirectUri(origin);
    const tokens = await exchangeGoogleCodeForTokens({ code, redirectUri });

    const { data: artist } = await supabase
      .from("artists")
      .select("google_refresh_token")
      .eq("id", user.id)
      .single();

    const refreshTokenToSave = tokens.refresh_token || artist?.google_refresh_token;
    if (!refreshTokenToSave) {
      return redirectToCalendar("Google did not return a refresh token. Disconnect app access in your Google account settings and reconnect.");
    }

    // Fetch the Gmail address via userinfo
    let gmailAddress: string | null = null;
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json() as { email?: string };
        gmailAddress = info.email ?? null;
      }
    } catch {
      // Non-fatal — Gmail sending will still work, address just won't be displayed
    }

    const gmailGranted = tokens.scope?.includes("gmail.send") ?? false;

    const { error } = await supabase
      .from("artists")
      .update({
        google_refresh_token: refreshTokenToSave,
        calendar_sync_enabled: true,
        gmail_connected: gmailGranted,
        gmail_address: gmailAddress,
      })
      .eq("id", user.id);

    if (error) throw error;

    const msg = gmailGranted
      ? "Google Calendar and Gmail connected successfully."
      : "Google Calendar connected. Gmail permission was not granted — reconnect to enable Gmail sending.";

    return redirectToCalendar(msg);
  } catch (error: unknown) {
    console.error("Google callback error:", error);
    return redirectToCalendar("Failed to finish Google connection.");
  }
}
