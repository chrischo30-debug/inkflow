import { Sidebar } from "@/components/layout/Sidebar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarView } from "@/components/calendar/CalendarView";
import { Settings } from "lucide-react";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("calendar_sync_enabled, google_refresh_token, gmail_connected, gmail_address")
    .eq("id", user.id)
    .single();

  const isCalendarConnected = Boolean(artist?.calendar_sync_enabled && artist?.google_refresh_token);
  const isGmailConnected = Boolean(artist?.gmail_connected && artist?.google_refresh_token);

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Calendar</h1>
          <Link
            href="/settings#google"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:border-outline-variant transition-colors"
          >
            <Settings className="w-4 h-4" />
            Manage integrations
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {params.message && (
            <p className="max-w-3xl p-3 rounded-lg border border-amber-300/50 bg-amber-50 text-amber-700 text-sm">
              {params.message}
            </p>
          )}

          {/* Connection status strip */}
          <div className="max-w-3xl flex flex-wrap gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${isCalendarConnected ? "bg-emerald-100 text-emerald-700" : "bg-surface-container-high text-on-surface-variant border border-outline-variant/20"}`}>
              <span className={`w-2 h-2 rounded-full ${isCalendarConnected ? "bg-emerald-500" : "bg-on-surface-variant/40"}`} />
              Calendar {isCalendarConnected ? "syncing" : "not connected"}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${isGmailConnected ? "bg-emerald-100 text-emerald-700" : "bg-surface-container-high text-on-surface-variant border border-outline-variant/20"}`}>
              <span className={`w-2 h-2 rounded-full ${isGmailConnected ? "bg-emerald-500" : "bg-on-surface-variant/40"}`} />
              Gmail {isGmailConnected ? `sending from ${artist?.gmail_address ?? "your account"}` : "not connected"}
            </span>
          </div>

          <div className="max-w-5xl">
            <CalendarView />
          </div>
        </div>
      </main>
    </div>
  );
}
