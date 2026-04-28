import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";
import { LinksView } from "@/components/links/LinksView";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { normalizePaymentLinks, normalizeSchedulingLinks } from "@/lib/pipeline-settings";
import type { CalendarLink } from "@/lib/pipeline-settings";
import { CoachmarkSequence } from "@/components/coachmarks/Coachmark";

export default async function LinksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: artistRow } = await supabase
    .from("artists")
    .select("*")
    .eq("id", user.id)
    .single();

  const row = artistRow as {
    payment_links?: unknown;
    calendar_links?: CalendarLink[];
    scheduling_links?: unknown;
    blocked_dates?: string[];
    payment_provider?: "stripe" | "square" | null;
    stripe_api_key?: string;
    square_access_token?: string;
    square_location_id?: string;
    calendar_sync_enabled?: boolean;
    google_refresh_token?: string;
  } | null;

  const provider = row?.payment_provider ?? null;
  const paymentsConnected =
    provider === "square"
      ? Boolean(row?.square_access_token && row?.square_location_id)
      : Boolean(row?.stripe_api_key);
  const effectiveProvider = paymentsConnected
    ? (provider ?? (row?.stripe_api_key ? "stripe" : null))
    : null;

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center gap-2 px-4 md:px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <MobileNavToggle />
          <h1 className="text-xl font-heading font-semibold text-on-surface truncate" data-coachmark="page-links">Links</h1>
          <CoachmarkSequence tips={[{
            id: "page.links.intro",
            anchorSelector: '[data-coachmark="page-links"]',
            title: "All your links live here",
            body: <>
              <p>Three kinds of links: payment, calendar (Google Cal style invites), and scheduling.</p>
              <p>You can drop these into emails using <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">{"{paymentLink}"}</code> or <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">{"{schedulingLink}"}</code> placeholders.</p>
              <p>Or just copy and paste any link manually whenever you need it.</p>
            </>,
          }]} />
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <LinksView
            initialPaymentLinks={normalizePaymentLinks(row?.payment_links)}
            initialCalendarLinks={row?.calendar_links ?? []}
            initialSchedulingLinks={normalizeSchedulingLinks(row?.scheduling_links)}
            initialBlockedDates={Array.isArray(row?.blocked_dates) ? row.blocked_dates : []}
            paymentsConnected={paymentsConnected}
            paymentProvider={effectiveProvider}
            isCalendarConnected={Boolean(row?.calendar_sync_enabled && row?.google_refresh_token)}
            artistId={user.id}
          />
        </div>
      </main>
    </div>
  );
}
