import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { PipelineView } from "@/components/booking/PipelineView";
import type { Booking, BookingState } from "@/lib/types";

const PIPELINE_STATES: BookingState[] = [
  "inquiry",
  "reviewed",
  "deposit_sent",
  "deposit_paid",
  "confirmed",
  "completed",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("id, artist_id, client_name, client_email, client_phone, description, size, placement, budget, reference_urls, custom_answers, state, appointment_date, created_at, updated_at")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false });

  const { data: baseFields } = await supabase
    .from("form_fields")
    .select("field_key, label")
    .eq("artist_id", user.id);
  const { data: customFields } = await supabase
    .from("custom_form_fields")
    .select("field_key, label")
    .eq("artist_id", user.id);

  const bookings: Booking[] = (bookingsData ?? []) as Booking[];
  const fieldLabelMap: Record<string, string> = {};
  for (const row of baseFields ?? []) {
    if (row.field_key && row.label) fieldLabelMap[row.field_key] = row.label;
  }
  for (const row of customFields ?? []) {
    if (row.field_key && row.label) fieldLabelMap[row.field_key] = row.label;
  }
  const today = new Date().toISOString().slice(0, 10);

  const unreviewedCount = bookings.filter((b) => b.state === "inquiry").length;
  const pendingDepositsCount = bookings.filter((b) => b.state === "deposit_sent").length;
  const todaysAppointments = bookings.filter(
    (b) => b.state === "confirmed" && b.appointment_date?.slice(0, 10) === today
  );

  const pipelineCounts = PIPELINE_STATES.map((state) => ({
    state,
    count: bookings.filter((b) => b.state === state).length,
  }));

  return (
    <div className="dashboard flex h-screen w-full bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center px-8 border-b border-outline-variant/10 bg-surface">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Dashboard</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5">
              <p className="text-sm text-on-surface-variant">Unreviewed inquiries</p>
              <p className="mt-2 text-3xl font-heading font-bold">{unreviewedCount}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5">
              <p className="text-sm text-on-surface-variant">Pending deposits</p>
              <p className="mt-2 text-3xl font-heading font-bold">{pendingDepositsCount}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5">
              <p className="text-sm text-on-surface-variant">Today&apos;s appointments</p>
              <p className="mt-2 text-3xl font-heading font-bold">{todaysAppointments.length}</p>
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5">
            <h2 className="text-lg font-heading font-semibold">Pipeline summary</h2>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {pipelineCounts.map((item) => (
                <div key={item.state} className="rounded-lg bg-surface-container-low p-3 border border-outline-variant/10">
                  <p className="text-xs uppercase tracking-wide text-on-surface-variant">{item.state.replace("_", " ")}</p>
                  <p className="text-2xl font-bold mt-1">{item.count}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5">
            <h2 className="text-lg font-heading font-semibold mb-4">Booking pipeline</h2>
            {bookings.length > 0 ? (
              <PipelineView initialBookings={bookings} fieldLabelMap={fieldLabelMap} />
            ) : (
              <p className="text-sm text-on-surface-variant">No inquiries yet.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
