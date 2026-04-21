import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { PipelineView } from "@/components/booking/PipelineView";
import Link from "next/link";
import type { Booking } from "@/lib/types";
import { mergePipelineSettings } from "@/lib/pipeline-settings";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: artistData } = await supabase
    .from("artists")
    .select("name, pipeline_settings")
    .eq("id", user.id)
    .single();

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("id, artist_id, client_name, client_email, client_phone, description, size, placement, budget, reference_urls, custom_answers, state, appointment_date, payment_link_sent, last_email_sent_at, created_at, updated_at")
    .eq("artist_id", user.id)
    .neq("state", "cancelled")
    .order("created_at", { ascending: false });

  const { data: baseFields } = await supabase.from("form_fields").select("field_key, label").eq("artist_id", user.id);
  const { data: customFields } = await supabase.from("custom_form_fields").select("field_key, label").eq("artist_id", user.id);

  const bookings: Booking[] = (bookingsData ?? []) as Booking[];
  const fieldLabelMap: Record<string, string> = {};
  for (const r of baseFields ?? []) { if (r.field_key && r.label) fieldLabelMap[r.field_key] = r.label; }
  for (const r of customFields ?? []) { if (r.field_key && r.label) fieldLabelMap[r.field_key] = r.label; }

  const today = new Date().toISOString().slice(0, 10);
  const newInquiries = bookings.filter(b => b.state === "inquiry");
  const awaitingDeposit = bookings.filter(b => b.state === "deposit_sent");
  const depositPaid = bookings.filter(b => b.state === "deposit_paid");
  const todayAppointments = bookings.filter(b => b.state === "confirmed" && b.appointment_date?.slice(0, 10) === today);

  const pipelineSettings = mergePipelineSettings((artistData?.pipeline_settings as object ?? {}) as Parameters<typeof mergePipelineSettings>[0]);
  const firstName = artistData?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Dashboard</h1>
          <Link href="/bookings" className="px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors">
            All bookings
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Action items */}
          <div className="px-8 pt-6 pb-4">
            <p className="text-base text-on-surface-variant mb-5">{greeting}, {firstName}.</p>

            {newInquiries.length === 0 && awaitingDeposit.length === 0 && depositPaid.length === 0 && todayAppointments.length === 0 ? (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 text-center">
                <p className="text-sm font-medium text-on-surface">You&apos;re all caught up.</p>
                <p className="text-sm text-on-surface-variant mt-1">No action items right now.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <ActionCard
                  label="New inquiries"
                  count={newInquiries.length}
                  description="Waiting for your review"
                  urgent={newInquiries.length > 0}
                  href="/bookings?state=inquiry"
                  cta="Review now"
                />
                <ActionCard
                  label="Awaiting deposit"
                  count={awaitingDeposit.length}
                  description="Deposit link sent, not yet paid"
                  urgent={false}
                  href="/bookings?state=deposit_sent"
                  cta="View"
                />
                <ActionCard
                  label="Deposit paid"
                  count={depositPaid.length}
                  description="Ready to confirm"
                  urgent={depositPaid.length > 0}
                  href="/bookings?state=deposit_paid"
                  cta="Confirm"
                />
                <ActionCard
                  label="Today"
                  count={todayAppointments.length}
                  description={todayAppointments.length === 0 ? "No appointments today" : todayAppointments.map(b => b.client_name).join(", ")}
                  urgent={false}
                  href="/bookings?state=confirmed"
                  cta="View"
                />
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div className="px-8 pb-8">
            <h2 className="text-sm font-heading font-semibold text-on-surface mb-3">Pipeline</h2>
            {bookings.length > 0 ? (
              <PipelineView initialBookings={bookings} fieldLabelMap={fieldLabelMap} pipelineSettings={pipelineSettings} />
            ) : (
              <div className="rounded-xl border border-dashed border-outline-variant/30 p-12 text-center">
                <p className="text-sm text-on-surface-variant">No bookings yet. Share your booking form to get started.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ActionCard({
  label, count, description, urgent, href, cta,
}: {
  label: string;
  count: number;
  description: string;
  urgent: boolean;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-xl border p-5 transition-all hover:shadow-sm ${
        urgent && count > 0
          ? "border-primary/30 bg-primary/5 hover:border-primary/50"
          : "border-outline-variant/20 bg-surface-container-lowest hover:border-outline-variant/40"
      }`}
    >
      <p className="text-sm font-medium text-on-surface-variant mb-1">{label}</p>
      <p className={`text-3xl font-heading font-bold ${urgent && count > 0 ? "text-primary" : "text-on-surface"}`}>
        {count}
      </p>
      <p className="text-sm text-on-surface-variant mt-2 line-clamp-2">{description}</p>
      {count > 0 && (
        <p className="text-sm font-medium text-primary mt-3 group-hover:underline">{cta} →</p>
      )}
    </Link>
  );
}
