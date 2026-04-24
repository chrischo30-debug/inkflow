import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import Link from "next/link";
import { normalizePaymentLinks } from "@/lib/pipeline-settings";
import type { CalendarLink } from "@/lib/pipeline-settings";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@flashbooker.app";

function CheckIcon({ done }: { done: boolean }) {
  return (
    <span className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-xs font-bold ${
      done ? "bg-emerald-100 text-emerald-700" : "bg-surface-container border border-outline-variant/30 text-on-surface-variant"
    }`}>
      {done ? "✓" : "·"}
    </span>
  );
}

function StepCard({
  done, title, description, note, action, actionHref, external = false,
}: {
  done: boolean;
  title: string;
  description: string;
  note?: string;
  action: string;
  actionHref: string;
  external?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 flex items-start gap-4 transition-colors ${
      done ? "border-emerald-200/60 bg-emerald-50/40" : "border-outline-variant/20 bg-surface-container-lowest"
    }`}>
      <CheckIcon done={done} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? "text-emerald-800" : "text-on-surface"}`}>{title}</p>
        <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>
        {note && <p className="text-xs text-emerald-700 mt-1 font-medium">{note}</p>}
      </div>
      <Link
        href={actionHref}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={`shrink-0 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          done
            ? "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
            : "bg-on-surface text-surface hover:opacity-80"
        }`}
      >
        {done ? "Edit" : action}
      </Link>
    </div>
  );
}

function ToolCard({
  name, description, url, tag,
}: {
  name: string; description: string; url: string; tag?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-outline-variant/20 p-5 hover:border-outline-variant/50 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{name}</p>
        {tag && <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/20 shrink-0">{tag}</span>}
      </div>
      <p className="text-sm text-on-surface-variant">{description}</p>
      <p className="text-xs text-primary mt-2 font-medium">Learn more →</p>
    </a>
  );
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  const params = searchParams ? await searchParams : {};
  const isNew = params.new === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("name, slug, logo_url, google_refresh_token, payment_links, calendar_sync_enabled, gmail_address")
    .eq("id", user.id)
    .single();

  type Extended = { calendar_links?: CalendarLink[]; stripe_api_key?: string; calcom_api_key?: string };
  let extended: Extended = {};
  try {
    const { data } = await supabase
      .from("artists")
      .select("calendar_links, stripe_api_key, calcom_api_key")
      .eq("id", user.id)
      .single();
    extended = (data as Extended) ?? {};
  } catch { /* migrations pending */ }

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const calendarConnected = Boolean(artist?.calendar_sync_enabled && artist?.google_refresh_token);
  const paymentLinks = normalizePaymentLinks(artist?.payment_links);
  const calendarLinks = (extended.calendar_links ?? []) as CalendarLink[];
  const hasLogo = Boolean(artist?.logo_url);
  const hasSlug = Boolean(artist?.slug);
  const hasStripe = Boolean(extended.stripe_api_key);
  const hasCalcom = Boolean(extended.calcom_api_key);

  const hasReplyTo = Boolean(artist?.gmail_address ?? user.email);

  const requiredSteps = [hasSlug, hasReplyTo];
  const recommendedSteps = [paymentLinks.length > 0, calendarLinks.length > 0, hasLogo];
  const integrationSteps = [calendarConnected, hasStripe, hasCalcom];

  const requiredComplete = requiredSteps.filter(Boolean).length;
  const recommendedComplete = recommendedSteps.filter(Boolean).length;
  const integrationsComplete = integrationSteps.filter(Boolean).length;
  const stepsComplete = requiredComplete + recommendedComplete + integrationsComplete;
  const totalSteps = requiredSteps.length + recommendedSteps.length + integrationSteps.length;
  const requiredDone = requiredComplete === requiredSteps.length;

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl shrink-0">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Setup Guide</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-2xl space-y-10">

            {/* Welcome banner for new accounts */}
            {isNew && (
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-5">
                <p className="text-sm font-semibold text-emerald-800">Profile saved — now let's connect your tools.</p>
                <p className="text-sm text-emerald-700/80 mt-1">Complete the steps below to unlock the full FlashBooker workflow. You can always come back to this page from the sidebar.</p>
              </div>
            )}

            {/* How email works — explains the flow, points to the required reply-to step */}
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-lg">✉️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface">How email works in FlashBooker</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Two things to confirm below. No SMTP, no Gmail login, no DNS.</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-on-surface leading-relaxed pt-0.5">
                    You click <span className="font-medium">Send email</span> on a booking. FlashBooker sends it for you — no third-party tools to connect.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <div className="flex-1 pt-0.5">
                    <p className="text-on-surface leading-relaxed">
                      Your client sees the email from: <span className="font-semibold">{artist?.name || "You"} via FlashBooker</span>.
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      It feels personal because your name is on it, but the delivery is handled by us.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <div className="flex-1 pt-0.5">
                    <p className="text-on-surface leading-relaxed">
                      When the client replies, it goes <span className="font-semibold">straight to your personal inbox</span>:
                    </p>
                    <p className="text-xs font-mono text-on-surface mt-1 bg-surface px-2.5 py-1.5 rounded border border-outline-variant/20 inline-block">
                      {artist?.gmail_address || user.email}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                      You reply from Gmail, Outlook, your phone — wherever. FlashBooker doesn&apos;t need to be open for you to keep talking to clients.{" "}
                      <a href="/settings" className="text-primary hover:underline">Change this address →</a>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-on-surface">{stepsComplete} of {totalSteps} steps complete</p>
                {requiredDone && stepsComplete < totalSteps && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">Required done — keep going!</span>
                )}
                {stepsComplete === totalSteps && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">All set!</span>
                )}
              </div>
              <div className="h-2 rounded-full bg-surface-container-low overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${(stepsComplete / totalSteps) * 100}%` }}
                />
              </div>
            </div>

            {/* REQUIRED — bare minimum to accept bookings */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xs font-bold text-on-surface uppercase tracking-wide">Required</h2>
                <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Bare minimum</span>
              </div>
              <p className="text-xs text-on-surface-variant -mt-1 mb-2">These two make the app work. Everything else is optional.</p>

              <StepCard
                done={hasSlug}
                title="Set your booking URL"
                description="The link you share with clients so they can submit inquiries. Without this, nothing else matters."
                note={artist?.slug ? `flashbooker.app/${artist.slug}/book` : undefined}
                action="Set URL"
                actionHref="/settings"
              />

              <StepCard
                done={hasReplyTo}
                title="Set your reply-to email"
                description="Where client replies land. Usually your Gmail, Outlook, or whatever you check most often."
                note={hasReplyTo ? (artist?.gmail_address || user.email) : undefined}
                action="Set reply-to"
                actionHref="/settings"
              />
            </section>

            {/* RECOMMENDED — flows assume these are set */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xs font-bold text-on-surface uppercase tracking-wide">Recommended</h2>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Best experience</span>
              </div>
              <p className="text-xs text-on-surface-variant -mt-1 mb-2">These make your booking flow feel finished. Add them when you&apos;re ready.</p>

              <StepCard
                done={paymentLinks.length > 0}
                title="Add payment links"
                description="Stripe, Venmo, or Cash App. Sent to the client automatically when you accept a booking and request a deposit."
                note={paymentLinks.length > 0 ? `${paymentLinks.length} link${paymentLinks.length !== 1 ? "s" : ""} saved` : undefined}
                action="Add links"
                actionHref="/payment-links"
              />

              <StepCard
                done={calendarLinks.length > 0}
                title="Add scheduling links"
                description="Your Cal.com or Calendly link. Sent automatically once a client pays their deposit so they can pick a time."
                note={calendarLinks.length > 0 ? `${calendarLinks.length} link${calendarLinks.length !== 1 ? "s" : ""} saved` : undefined}
                action="Add links"
                actionHref="/settings"
              />

              <StepCard
                done={hasLogo}
                title="Upload your logo"
                description="Shown on your booking form and at the top of client emails. Makes your bookings feel on-brand."
                action="Upload logo"
                actionHref="/settings"
              />
            </section>

            {/* POWER INTEGRATIONS — save time with automations */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xs font-bold text-on-surface uppercase tracking-wide">Power integrations</h2>
                <span className="text-[10px] font-semibold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full uppercase tracking-wide">Optional</span>
              </div>
              <p className="text-xs text-on-surface-variant -mt-1 mb-2">Connect API keys to automate the boring parts — no more copy-pasting deposit amounts or creating calendar events.</p>

              <StepCard
                done={hasStripe}
                title="Connect Stripe for automated deposits"
                description="Generate per-booking payment links without leaving the dashboard. We auto-mark bookings as paid when your client pays."
                note={hasStripe ? "Stripe API key saved" : undefined}
                action="Add Stripe key"
                actionHref="/settings?tab=integrations"
              />

              <StepCard
                done={hasCalcom}
                title="Connect Cal.com for one-click scheduling"
                description="Pre-fills the client&apos;s name and email in the Cal.com link — they just pick a time. Skip the copy-paste dance."
                note={hasCalcom ? "Cal.com API key saved" : undefined}
                action="Add Cal.com key"
                actionHref="/settings?tab=integrations"
              />

              <StepCard
                done={calendarConnected}
                title="Sync appointments to Google Calendar"
                description="Confirmed bookings show up on your personal Google Calendar automatically. Skip if you use a different calendar — you can still use FlashBooker&apos;s built-in calendar view."
                action={googleConfigured ? "Connect Calendar" : "Not configured"}
                actionHref={googleConfigured ? "/api/auth/google/connect" : "/settings"}
              />
            </section>

            {/* Recommended tools */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Recommended tools</h2>
              <div className="grid grid-cols-2 gap-3">
                <ToolCard
                  name="Cal.com"
                  description="Free scheduling tool. Clients book a time slot — paste your Cal link into the calendar email template."
                  url="https://cal.com"
                  tag="Free"
                />
                <ToolCard
                  name="Stripe"
                  description="Accept credit card payments online. Generate a payment link for each deposit request."
                  url="https://stripe.com"
                />
                <ToolCard
                  name="Kit"
                  description="Email marketing for creators. Grow your client list and send flash announcements."
                  url="https://kit.com"
                  tag="Free tier"
                />
              </div>
            </section>

            {/* Help */}
            <section className="rounded-xl border border-outline-variant/20 p-6 bg-surface-container-lowest space-y-2">
              <p className="text-sm font-semibold text-on-surface">Need help?</p>
              <p className="text-sm text-on-surface-variant">
                Having trouble setting something up, or want to request a feature? Reach out directly.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-block mt-1 text-sm font-medium text-primary hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
