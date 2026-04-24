import { Sidebar } from "@/components/layout/Sidebar";
import { SettingsShell, type TabId } from "@/components/settings/SettingsShell";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { normalizePaymentLinks } from "@/lib/pipeline-settings";
import type { CalendarLink } from "@/lib/pipeline-settings";

const ALLOWED_TABS: TabId[] = ["profile", "integrations", "webhooks", "emails", "reminders"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const initialTab = ALLOWED_TABS.includes(params.tab as TabId) ? (params.tab as TabId) : undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Core columns — always exist
  const { data: artist } = await supabase
    .from("artists")
    .select("name, slug, studio_name, accent_theme, payment_links, calendar_sync_enabled, google_refresh_token")
    .eq("id", user.id)
    .single();

  // Newer columns — may not exist if migrations haven't run; fail gracefully
  type ExtendedArtist = {
    pipeline_settings?: object;
    calendar_links?: CalendarLink[];
    stripe_api_key?: string;
    stripe_webhook_secret?: string;
    calcom_api_key?: string;
    kit_api_key?: string;
    kit_form_id?: string;
    reminder_enabled?: boolean;
    reminder_hours_before?: number;
  };
  let extended: ExtendedArtist = {};
  try {
    const { data } = await supabase
      .from("artists")
      .select("pipeline_settings, calendar_links, stripe_api_key, stripe_webhook_secret, calcom_api_key, kit_api_key, kit_form_id, reminder_enabled, reminder_hours_before")
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
        artistId={user.id}
        slug={artist?.slug ?? ""}
        artistName={artist?.name ?? ""}
        studioName={artist?.studio_name ?? ""}
        email={user.email ?? ""}
        accentTheme={(artist?.accent_theme as "crimson" | "blue") ?? "crimson"}
        googleConfigured={googleConfigured}
        hasRefreshToken={hasRefreshToken}
        isCalendarConnected={Boolean(artist?.calendar_sync_enabled && hasRefreshToken)}
        paymentLinks={normalizePaymentLinks(artist?.payment_links)}
        calendarLinks={(extended.calendar_links as CalendarLink[]) ?? []}
        stripeApiKey={extended.stripe_api_key ?? ""}
        stripeWebhookSecret={extended.stripe_webhook_secret ?? ""}
        calcomApiKey={extended.calcom_api_key ?? ""}
        kitApiKey={extended.kit_api_key ?? ""}
        kitFormId={extended.kit_form_id ?? ""}
        reminderEnabled={extended.reminder_enabled ?? false}
        reminderHoursBefore={extended.reminder_hours_before ?? 24}
        initialTab={initialTab}
      />
    </div>
  );
}
