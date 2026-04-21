import { Sidebar } from "@/components/layout/Sidebar";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { mergePipelineSettings, normalizePaymentLinks } from "@/lib/pipeline-settings";
import type { CalendarLink } from "@/lib/pipeline-settings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Core columns — always exist
  const { data: artist } = await supabase
    .from("artists")
    .select("name, slug, studio_name, accent_theme, payment_links, calendar_sync_enabled, google_refresh_token, gmail_connected, gmail_address")
    .eq("id", user.id)
    .single();

  // Newer columns — may not exist if migrations haven't run; fail gracefully
  type ExtendedArtist = {
    pipeline_settings?: object;
    calendar_links?: CalendarLink[];
    stripe_api_key?: string;
    calcom_api_key?: string;
  };
  let extended: ExtendedArtist = {};
  try {
    const { data } = await supabase
      .from("artists")
      .select("pipeline_settings, calendar_links, stripe_api_key, calcom_api_key")
      .eq("id", user.id)
      .single();
    extended = (data as ExtendedArtist) ?? {};
  } catch { /* migrations not yet applied */ }

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasRefreshToken = Boolean(artist?.google_refresh_token);

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <SettingsShell
        slug={artist?.slug ?? ""}
        artistName={artist?.name ?? ""}
        studioName={artist?.studio_name ?? ""}
        email={user.email ?? ""}
        accentTheme={(artist?.accent_theme as "crimson" | "blue") ?? "crimson"}
        googleConfigured={googleConfigured}
        hasRefreshToken={hasRefreshToken}
        isCalendarConnected={Boolean(artist?.calendar_sync_enabled && hasRefreshToken)}
        isGmailConnected={Boolean(artist?.gmail_connected && hasRefreshToken)}
        gmailAddress={artist?.gmail_address ?? ""}
        paymentLinks={normalizePaymentLinks(artist?.payment_links)}
        calendarLinks={(extended.calendar_links as CalendarLink[]) ?? []}
        pipelineSettings={mergePipelineSettings((extended.pipeline_settings ?? {}) as Parameters<typeof mergePipelineSettings>[0])}
        stripeApiKey={extended.stripe_api_key ?? ""}
        calcomApiKey={extended.calcom_api_key ?? ""}
      />
    </div>
  );
}
