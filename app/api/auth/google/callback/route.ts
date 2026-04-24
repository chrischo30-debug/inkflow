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

    const { error } = await supabase
      .from("artists")
      .update({
        google_refresh_token: refreshTokenToSave,
        calendar_sync_enabled: true,
      })
      .eq("id", user.id);

    if (error) throw error;

    return redirectToCalendar("Google Calendar connected successfully.");
  } catch (error: unknown) {
    console.error("Google callback error:", error);
    return redirectToCalendar("Failed to finish Google connection.");
  }
}
