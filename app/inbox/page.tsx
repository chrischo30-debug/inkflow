import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { InboxView } from "@/components/inbox/InboxView";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const [{ data: artist }, { data: templateRows }] = await Promise.all([
    supabase.from("artists").select("name, slug, gmail_connected, google_refresh_token").eq("id", user.id).single(),
    supabase.from("email_templates").select("subject, state").eq("artist_id", user.id),
  ]);

  const gmailConnected = Boolean(artist?.gmail_connected && artist?.google_refresh_token);

  // Build filter labels from template subjects (custom first, fall back to defaults, strip {variables})
  const filterKeywords: string[] = [];
  const seen = new Set<string>();
  const subjectSources: string[] = [
    ...(templateRows ?? []).filter(r => r.subject).map(r => r.subject as string),
    ...Object.values(DEFAULT_EMAIL_TEMPLATES).map(t => t.subject),
  ];
  for (const subject of subjectSources) {
    const clean = subject.replace(/\{[^}]+\}/g, "").replace(/–\s*$/, "").trim();
    if (clean && !seen.has(clean)) { seen.add(clean); filterKeywords.push(clean); }
  }

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl shrink-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Inbox</h1>
        </header>

        {!gmailConnected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <p className="text-base font-medium text-on-surface mb-2">Gmail not connected</p>
              <p className="text-sm text-on-surface-variant mb-5">
                Connect your Google account to read and reply to emails from your inbox.
              </p>
              <Link
                href="/settings"
                className="inline-block px-4 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
              >
                Go to Settings → Integrations
              </Link>
            </div>
          </div>
        ) : (
          <InboxView
            slug={artist?.slug ?? ""}
            artistName={artist?.name ?? ""}
            filterKeywords={filterKeywords}
            appSenderEmail={process.env.RESEND_FROM_EMAIL ?? ""}
          />
        )}
      </main>
    </div>
  );
}
