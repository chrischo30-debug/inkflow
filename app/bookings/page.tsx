import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BookingsTable } from "@/components/booking/BookingsTable";
import { CopyFormLinkButton } from "@/components/booking/CopyFormLinkButton";
import type { Booking } from "@/lib/types";
import type { CalcomData } from "@/components/booking/BookingCard";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const params = await searchParams;
  const initialState = params.state ?? "all";

  const [{ data: bookingsData }, { data: baseFields }, { data: customFields }, { data: artistData }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, artist_id, client_name, client_email, client_phone, description, size, placement, budget, reference_urls, custom_answers, state, appointment_date, payment_link_sent, last_email_sent_at, gmail_thread_id, sent_emails, has_unread_reply, deposit_paid, stripe_payment_link_url, total_amount, tip_amount, completion_notes, created_at, updated_at")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("form_fields").select("field_key, label").eq("artist_id", user.id),
    supabase.from("custom_form_fields").select("field_key, label").eq("artist_id", user.id),
    supabase.from("artists").select("calendar_sync_enabled, slug, stripe_api_key, calcom_api_key").eq("id", user.id).single(),
  ]);

  const hasStripe = Boolean((artistData as Record<string, unknown>)?.stripe_api_key);

  let calcomData: CalcomData | null = null;
  const calcomApiKey = (artistData as Record<string, unknown>)?.calcom_api_key as string | undefined;
  if (calcomApiKey) {
    try {
      const calHeaders = { "Authorization": `Bearer ${calcomApiKey}`, "cal-api-version": "2024-08-13" };
      const [meRes, evRes] = await Promise.all([
        fetch("https://api.cal.com/v2/me", { headers: calHeaders }),
        fetch("https://api.cal.com/v2/event-types", { headers: calHeaders }),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        const username: string = me.data?.username ?? "";
        let events: CalcomData["events"] = [];
        if (evRes.ok) {
          const evData = await evRes.json();
          const raw: { slug?: string; title?: string }[] = evData.data?.eventTypeGroups?.[0]?.eventTypes ?? evData.data ?? [];
          events = raw.filter(e => e.slug && e.title).map(e => ({ slug: e.slug!, title: e.title! }));
        }
        if (username) calcomData = { username, events };
      }
    } catch { /* Cal.com unavailable */ }
  }

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
          <CopyFormLinkButton slug={artistData?.slug ?? ""} />
        </header>
        <div className="flex-1 overflow-hidden">
          <BookingsTable bookings={bookings} fieldLabelMap={fieldLabelMap} initialState={initialState} calendarSyncEnabled={artistData?.calendar_sync_enabled ?? false} hasStripe={hasStripe} calcomData={calcomData} />
        </div>
      </main>
    </div>
  );
}
