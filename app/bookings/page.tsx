import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BookingsTable } from "@/components/booking/BookingsTable";
import { AddBookingModal } from "@/components/booking/AddBookingModal";
import type { Booking } from "@/lib/types";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const params = await searchParams;
  const initialState = params.state ?? "confirmed";

  const [{ data: bookingsData }, { data: baseFields }, { data: customFields }, { data: artistData }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, artist_id, client_name, client_email, client_phone, description, size, placement, budget, reference_urls, custom_answers, state, appointment_date, payment_link_sent, last_email_sent_at, gmail_thread_id, sent_emails, total_amount, tip_amount, completion_notes, created_at, updated_at")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("form_fields").select("field_key, label").eq("artist_id", user.id),
    supabase.from("custom_form_fields").select("field_key, label").eq("artist_id", user.id),
    supabase.from("artists").select("calendar_sync_enabled").eq("id", user.id).single(),
  ]);

  const bookings: Booking[] = (bookingsData ?? []) as Booking[];
  const fieldLabelMap: Record<string, string> = {};
  for (const r of baseFields ?? []) { if (r.field_key && r.label) fieldLabelMap[r.field_key] = r.label; }
  for (const r of customFields ?? []) { if (r.field_key && r.label) fieldLabelMap[r.field_key] = r.label; }

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Bookings</h1>
          <AddBookingModal />
        </header>
        <div className="flex-1 overflow-hidden">
          <BookingsTable bookings={bookings} fieldLabelMap={fieldLabelMap} initialState={initialState} calendarSyncEnabled={artistData?.calendar_sync_enabled ?? false} />
        </div>
      </main>
    </div>
  );
}
