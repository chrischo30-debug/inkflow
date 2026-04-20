import { Sidebar } from "@/components/layout/Sidebar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarEventsPanel } from "@/components/calendar/CalendarEventsPanel";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: artist } = await supabase
    .from("artists")
    .select("calendar_sync_enabled, google_refresh_token")
    .eq("id", user.id)
    .single();

  const isConnected = Boolean(artist?.calendar_sync_enabled);
  const hasRefreshToken = Boolean(artist?.google_refresh_token);
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="dashboard flex h-screen w-full bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Calendar</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="w-full max-w-3xl border border-outline-variant/30 rounded-xl bg-surface-container-low/40 p-8 space-y-6">
            {params.message && (
              <p className="p-3 rounded-md bg-amber-100 text-amber-700 text-sm">
                {params.message}
              </p>
            )}
            {!googleConfigured && (
              <p className="p-3 rounded-md bg-red-100 text-red-700 text-sm">
                Google OAuth is not configured. Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in environment variables, then restart the app.
              </p>
            )}
            <div>
              <h2 className="text-xl font-heading font-semibold text-on-surface">Google Calendar Integration</h2>
              <p className="text-on-surface-variant text-sm leading-relaxed mt-2">
                Connect your calendar so confirmed bookings can sync automatically.
              </p>
              <div className="mt-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${isConnected && hasRefreshToken ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {isConnected && hasRefreshToken ? "Connected" : "Not Connected"}
                </span>
              </div>
            </div>

            <ol className="space-y-3 text-sm text-on-surface-variant list-decimal pl-5">
              <li>Click &quot;Connect Google Calendar&quot;.</li>
              <li>Sign in with your Google account and grant calendar permissions.</li>
              <li>Return to FlashBook and confirm the status is Connected.</li>
              <li>When bookings move to Confirmed, events will sync automatically.</li>
            </ol>

            <div className="flex items-center gap-3">
              {googleConfigured ? (
                <Link
                  href="/api/auth/google/connect"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  {isConnected && hasRefreshToken ? "Reconnect Google Calendar" : "Connect Google Calendar"}
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-surface-container-high text-on-surface-variant text-sm font-semibold cursor-not-allowed">
                  Connect Google Calendar
                </span>
              )}
              {isConnected && hasRefreshToken && (
                <form action="/api/auth/google/disconnect" method="post">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors"
                  >
                    Disconnect
                  </button>
                </form>
              )}
              <p className="text-xs text-on-surface-variant">
                If you recently connected, refresh this page to update status.
              </p>
            </div>

            <div className="pt-2 border-t border-outline-variant/20">
              <h3 className="font-heading font-semibold text-on-surface mb-3">Upcoming Events</h3>
              <CalendarEventsPanel />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
