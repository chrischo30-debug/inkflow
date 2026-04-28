import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar/CalendarView";
import { AddBookingModal } from "@/components/booking/AddBookingModal";
import { CoachmarkSequence } from "@/components/coachmarks/Coachmark";

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
    .select("calendar_sync_enabled, google_refresh_token")
    .eq("id", user.id)
    .single();

  const isCalendarConnected = Boolean(artist?.calendar_sync_enabled && artist?.google_refresh_token);

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
            <MobileNavToggle />
            <h1 className="text-xl font-heading font-semibold text-on-surface truncate" data-coachmark="page-calendar">Calendar</h1>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isCalendarConnected ? "bg-emerald-100 text-emerald-700" : "bg-surface-container-high text-on-surface-variant border border-outline-variant/20"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isCalendarConnected ? "bg-emerald-500" : "bg-on-surface-variant/40"}`} />
              {isCalendarConnected ? "syncing" : "not connected"}
            </span>
          </div>
          <CoachmarkSequence tips={[{
            id: "page.calendar.intro",
            anchorSelector: '[data-coachmark="page-calendar"]',
            title: "Your full schedule, in one view",
            body: <>
              <p>Confirmed appointments show here automatically.</p>
              <p>If you connect Google Calendar, your existing events show too, so you can see everything in one place and avoid double-booking.</p>
              <p>Click any empty slot to add a booking right at that time.</p>
            </>,
          }]} />
          <div className="flex items-center gap-3">
            <AddBookingModal />
          </div>
        </header>

        {params.message && (
          <div className="px-4 md:px-8 pt-3 shrink-0">
            <p className="max-w-3xl p-3 rounded-lg border border-amber-300/50 bg-amber-50 text-amber-700 text-sm">
              {params.message}
            </p>
          </div>
        )}

        {/* Calendar fills all remaining vertical space */}
        <div className="flex-1 min-h-0 overflow-hidden px-2 md:px-8 pt-4 pb-4">
          <CalendarView initialDate={params.date} />
        </div>
      </main>
    </div>
  );
}
