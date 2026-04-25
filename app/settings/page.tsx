import { Sidebar } from "@/components/layout/Sidebar";
import { SettingsShell, type TabId } from "@/components/settings/SettingsShell";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { normalizePaymentLinks, normalizeSchedulingLinks } from "@/lib/pipeline-settings";
import type { CalendarLink } from "@/lib/pipeline-settings";

const ALLOWED_TABS: TabId[] = ["profile", "integrations", "emails", "reminders"];

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
    .select("name, slug, studio_name, accent_theme, payment_links, calendar_sync_enabled, google_refresh_token, gmail_address")
    .eq("id", user.id)
    .single();

  // Newer columns — may not exist if migrations haven't run; fail gracefully
  type ExtendedArtist = {
    pipeline_settings?: object;
    calendar_links?: CalendarLink[];
    stripe_api_key?: string;
    stripe_webhook_secret?: string;
    reminder_enabled?: boolean;
    reminder_hours_before?: number;
    studio_address?: string;
    email_logo_enabled?: boolean;
    email_logo_bg?: "light" | "dark";
    logo_url?: string;
    auto_emails_enabled?: boolean;
  };
  // Use select(*) so a single missing column (e.g. unrun migration) doesn't
  // wipe out the entire row — we still get every other field that exists.
  let extended: ExtendedArtist = {};
  const { data: extData, error: extErr } = await supabase
    .from("artists")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!extErr && extData) {
    extended = extData as ExtendedArtist;
  }

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
        studioAddress={extended.studio_address ?? ""}
        emailLogoEnabled={extended.email_logo_enabled ?? true}
        emailLogoBg={extended.email_logo_bg ?? "light"}
        autoEmailsEnabled={extended.auto_emails_enabled !== false}
        hasLogo={Boolean(extended.logo_url)}
        logoUrl={extended.logo_url ?? null}
        email={user.email ?? ""}
        accentTheme={(artist?.accent_theme as "crimson" | "blue") ?? "crimson"}
        googleConfigured={googleConfigured}
        hasRefreshToken={hasRefreshToken}
        isCalendarConnected={Boolean(artist?.calendar_sync_enabled && hasRefreshToken)}
        paymentLinks={normalizePaymentLinks(artist?.payment_links)}
        calendarLinks={(extended.calendar_links as CalendarLink[]) ?? []}
        gmailAddress={(artist as { gmail_address?: string } | null)?.gmail_address ?? user.email ?? ""}
        stripeApiKey={extended.stripe_api_key ?? ""}
        stripeWebhookSecret={extended.stripe_webhook_secret ?? ""}
        schedulingLinks={normalizeSchedulingLinks((extData as Record<string, unknown>)?.scheduling_links)}
        reminderEnabled={extended.reminder_enabled ?? false}
        reminderHoursBefore={extended.reminder_hours_before ?? 24}
        initialTab={initialTab}
      />
    </div>
  );
}
