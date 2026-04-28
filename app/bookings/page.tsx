import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BookingsTable } from "@/components/booking/BookingsTable";
import { CopyFormLinkButton } from "@/components/booking/CopyFormLinkButton";
import { AddBookingModal } from "@/components/booking/AddBookingModal";
import type { Booking } from "@/lib/types";
import { PaymentSSEListener } from "@/components/booking/PaymentSSEListener";
import { CoachmarkSequence } from "@/components/coachmarks/Coachmark";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const params = await searchParams;
  const initialState = params.expand ? "all" : (params.state ?? "all");
  const initialExpandId = params.expand ?? null;

  const [{ data: bookingsData }, { data: baseFields }, { data: customFields }, { data: artistData }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, artist_id, client_name, client_email, client_phone, description, size, placement, budget, reference_urls, custom_answers, state, appointment_date, payment_link_sent, last_email_sent_at, sent_emails, inquiry_email_failed, deposit_paid, deposit_link_url, deposit_external_id, payment_provider, stripe_payment_link_url, total_amount, tip_amount, completion_notes, completion_image_urls, sort_order, created_at, updated_at")
      .eq("artist_id", user.id)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("form_fields").select("field_key, label").eq("artist_id", user.id),
    supabase.from("custom_form_fields").select("field_key, label").eq("artist_id", user.id),
    supabase.from("artists").select("calendar_sync_enabled, slug, payment_provider, stripe_api_key, square_access_token, square_location_id, name, studio_name, scheduling_links").eq("id", user.id).single(),
  ]);

  const artistRow = artistData as Record<string, unknown> | null;
  const paymentProvider = ((artistRow?.payment_provider as "stripe" | "square" | null | undefined) ?? null);
  const paymentsConnected =
    paymentProvider === "square"
      ? Boolean(artistRow?.square_access_token && artistRow?.square_location_id)
      : Boolean(artistRow?.stripe_api_key);
  const effectiveProvider = paymentsConnected
    ? (paymentProvider ?? (artistRow?.stripe_api_key ? "stripe" : null))
    : null;
  const schedulingLinks = (artistData as { scheduling_links?: unknown } | null)?.scheduling_links ?? [];

  const bookings: Booking[] = (bookingsData ?? []) as Booking[];
  const fieldLabelMap: Record<string, string> = {};
  for (const r of baseFields ?? []) { if (r.field_key && r.label) fieldLabelMap[r.field_key] = r.label; }
  for (const r of customFields ?? []) { if (r.field_key && r.label) fieldLabelMap[r.field_key] = r.label; }

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface" data-coachmark="page-bookings">Bookings</h1>
          <CoachmarkSequence tips={[{
            id: "page.bookings.intro",
            anchorSelector: '[data-coachmark="page-bookings"]',
            title: "Every booking in one list",
            body: <>
              <p>This is the full record of every client who&apos;s ever come through your form, alive or archived.</p>
              <p>Filter by stage at the top, click a row to expand details, or use the action button to move it forward.</p>
              <p>Use the dashboard if you want a column view instead.</p>
            </>,
          }]} />
          <div className="flex items-center gap-3">
            <CopyFormLinkButton slug={artistData?.slug ?? ""} />
            <AddBookingModal />
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <BookingsTable bookings={bookings} fieldLabelMap={fieldLabelMap} initialState={initialState} initialExpandId={initialExpandId} calendarSyncEnabled={artistData?.calendar_sync_enabled ?? false} paymentsConnected={paymentsConnected} paymentProvider={effectiveProvider} artistName={(artistData as Record<string,unknown>)?.name as string ?? (artistData as Record<string,unknown>)?.studio_name as string ?? ""} artistId={user.id} schedulingLinks={schedulingLinks as never} />
        </div>
      </main>
      <PaymentSSEListener artistId={user.id} />
    </div>
  );
}
