import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { PipelineView } from "@/components/booking/PipelineView";
import { BooksToggle } from "@/components/dashboard/BooksToggle";
import { AddBookingModal } from "@/components/booking/AddBookingModal";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Booking } from "@/lib/types";
import { isBooksOpen, booksStatusLabel } from "@/lib/books";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: artistData } = await supabase
    .from("artists")
    .select("name, slug, calendar_sync_enabled, books_open, books_open_at, books_close_at, payment_provider, stripe_api_key, square_access_token, square_location_id, scheduling_links")
    .eq("id", user.id)
    .single();

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("id, artist_id, client_name, client_email, client_phone, description, size, placement, budget, reference_urls, custom_answers, state, appointment_date, payment_link_sent, last_email_sent_at, sent_emails, deposit_paid, deposit_link_url, deposit_external_id, payment_provider, stripe_payment_link_url, sort_order, created_at, updated_at")
    .eq("artist_id", user.id)
    .neq("state", "cancelled")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const { data: baseFields } = await supabase.from("form_fields").select("field_key, label").eq("artist_id", user.id);
  const { data: customFields } = await supabase.from("custom_form_fields").select("field_key, label").eq("artist_id", user.id);

  const bookings: Booking[] = (bookingsData ?? []) as Booking[];
  const fieldLabelMap: Record<string, string> = {};
  for (const r of baseFields ?? []) { if (r.field_key && r.label) fieldLabelMap[r.field_key] = r.label; }
  for (const r of customFields ?? []) { if (r.field_key && r.label) fieldLabelMap[r.field_key] = r.label; }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const weekStart = monday.toISOString().slice(0, 10);
  const weekEnd = sunday.toISOString().slice(0, 10);

  const newInquiries = bookings.filter(b => b.state === "inquiry");
  const followUps = bookings.filter(b => b.state === "follow_up");
  const awaitingConfirmation = bookings.filter(b => b.state === "sent_deposit" || b.state === "accepted");
  const weekAppointments = bookings.filter(b => {
    const d = b.appointment_date?.slice(0, 10);
    return b.state === "confirmed" && d && d >= weekStart && d <= weekEnd;
  });

  const firstName = artistData?.name?.split(" ")[0] ?? "there";
  const artistRow = artistData as Record<string, unknown> | null;
  const paymentProvider = ((artistRow?.payment_provider as "stripe" | "square" | null | undefined) ?? null);
  const paymentsConnected =
    paymentProvider === "square"
      ? Boolean(artistRow?.square_access_token && artistRow?.square_location_id)
      : Boolean(artistRow?.stripe_api_key);
  const effectiveProvider = paymentsConnected
    ? (paymentProvider ?? (artistRow?.stripe_api_key ? "stripe" : null))
    : null;

  const booksStatus = {
    books_open: artistData?.books_open ?? true,
    books_open_at: (artistData as Record<string, unknown>)?.books_open_at as string ?? null,
    books_close_at: (artistData as Record<string, unknown>)?.books_close_at as string ?? null,
  };
  const booksOpen = isBooksOpen(booksStatus);
  const booksLabel = booksStatusLabel(booksStatus);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-6 xl:px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Dashboard</h1>
          <div className="flex items-center gap-2 md:gap-3">
            <BooksToggle initialOpen={booksOpen} statusLabel={booksLabel} />
            {artistData?.slug && (
              <a
                href={`/${artistData.slug}/book`}
                target="_blank"
                rel="noopener noreferrer"
                title="View live booking form"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Live form</span>
              </a>
            )}
            <Link href="/bookings?state=confirmed" className="hidden sm:block px-3 py-2 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors">
              All bookings
            </Link>
            <AddBookingModal />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Action items */}
          <div className="px-4 md:px-6 xl:px-8 pt-6 pb-4">
            <p className="text-base text-on-surface-variant mb-5">{greeting}, {firstName}.</p>

            {newInquiries.length === 0 && followUps.length === 0 && awaitingConfirmation.length === 0 && weekAppointments.length === 0 ? (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 text-center">
                <p className="text-sm font-medium text-on-surface">You&apos;re all caught up.</p>
                <p className="text-sm text-on-surface-variant mt-1">No action items right now.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <ActionCard
                  label="New inquiries"
                  count={newInquiries.length}
                  description={followUps.length > 0 ? `${followUps.length} follow-up${followUps.length > 1 ? "s" : ""} pending` : "Waiting for your review"}
                  urgent={newInquiries.length > 0}
                  href="/bookings?state=inquiry"
                  cta="Review now"
                  tooltip="Clients who submitted your booking form and are waiting for your review. Accept to request a deposit, or reject if it's not a good fit."
                />
                <ActionCard
                  label="Awaiting confirmation"
                  count={awaitingConfirmation.length}
                  description="Deposit sent — needs to schedule"
                  urgent={awaitingConfirmation.length > 0}
                  href="/bookings?state=accepted"
                  cta="Confirm"
                  tooltip="Clients you've accepted and requested a deposit from. Use 'Confirm Appointment' to set a date and send them a booking confirmation."
                />
                <ActionCard
                  label="This week"
                  count={weekAppointments.length}
                  description={weekAppointments.length === 0 ? "No appointments this week" : weekAppointments.map((b: Booking) => b.client_name).join(", ")}
                  urgent={false}
                  href="/bookings?state=confirmed"
                  cta="View"
                  tooltip="Confirmed tattoo appointments scheduled for this Mon–Sun. Mark as complete after the session to send a follow-up email."
                />
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div className="px-4 md:px-6 xl:px-8 pb-8">
            <div className="flex items-center gap-1.5 mb-3">
              <h2 className="text-sm font-heading font-semibold text-on-surface">Pipeline</h2>
              <HelpTooltip title="How the pipeline works">
                <div className="divide-y divide-outline-variant/15">
                  {[
                    { stage: "Submission", desc: "New inquiry just came in. Review and choose Accept, Reject, or Follow Up." },
                    { stage: "Follow Up", desc: "You sent a question to the client. Waiting on their reply before deciding." },
                    { stage: "Sent Deposit", desc: "Deposit email is out. When Stripe or Square is connected, moves to Sent Calendar automatically once they pay." },
                    { stage: "Sent Calendar", desc: "Deposit received. Client gets a link to pick their appointment time." },
                    { stage: "Booked", desc: "Appointment is locked in automatically when the client picks a time slot." },
                    { stage: "Completed", desc: "Session done. Record final payment and notes." },
                  ].map(({ stage, desc }) => (
                    <div key={stage} className="flex items-start gap-3 py-2.5">
                      <span className="shrink-0 text-[10px] font-semibold text-on-surface bg-surface-container-high px-1.5 py-0.5 rounded leading-tight mt-0.5 whitespace-nowrap">{stage}</span>
                      <p className="text-xs text-on-surface-variant leading-snug">{desc}</p>
                    </div>
                  ))}
                </div>
              </HelpTooltip>
            </div>
            {bookings.length > 0 ? (
              <PipelineView
                initialBookings={bookings}
                fieldLabelMap={fieldLabelMap}
                calendarSyncEnabled={Boolean(artistData?.calendar_sync_enabled)}
                paymentsConnected={paymentsConnected}
                paymentProvider={effectiveProvider}
                artistId={user.id}
                schedulingLinks={Array.isArray((artistData as Record<string,unknown>)?.scheduling_links) ? (artistData as Record<string,unknown>).scheduling_links as import("@/lib/pipeline-settings").SchedulingLink[] : []}
              />
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
  label, count, description, urgent, href, cta, tooltip,
}: {
  label: string;
  count: number;
  description: string;
  urgent: boolean;
  href: string;
  cta: string;
  tooltip?: string;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-xl border p-3.5 md:p-5 transition-all hover:shadow-sm ${
        urgent && count > 0
          ? "border-primary/30 bg-primary/5 hover:border-primary/50"
          : "border-outline-variant/20 bg-surface-container-lowest hover:border-outline-variant/40"
      }`}
    >
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs md:text-sm font-medium text-on-surface-variant leading-tight">{label}</p>
        {tooltip && <HelpTooltip body={tooltip} />}
      </div>
      <p className={`text-2xl md:text-3xl font-heading font-bold ${urgent && count > 0 ? "text-primary" : "text-on-surface"}`}>
        {count}
      </p>
      <p className="text-xs md:text-sm text-on-surface-variant mt-1.5 md:mt-2 line-clamp-2">{description}</p>
      {count > 0 && (
        <p className="text-xs md:text-sm font-medium text-primary mt-2 md:mt-3 group-hover:underline">{cta} →</p>
      )}
    </Link>
  );
}
