import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";
import { ClientsTable } from "@/components/booking/ClientsTable";
import type { Booking } from "@/lib/types";

export default async function PastClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const [{ data: bookingsData }, { data: artistData }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, artist_id, client_name, client_email, client_phone, description, size, placement, budget, reference_urls, custom_answers, state, appointment_date, payment_link_sent, last_email_sent_at, sent_emails, total_amount, tip_amount, completion_notes, completion_image_urls, created_at, updated_at")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("artists").select("slug").eq("id", user.id).single(),
  ]);

  const bookings: Booking[] = (bookingsData ?? []) as Booking[];
  const artistSlug: string = (artistData as { slug?: string } | null)?.slug ?? "";

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center gap-2 px-4 md:px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <MobileNavToggle />
          <h1 className="text-xl font-heading font-semibold text-on-surface truncate">Clients</h1>
        </header>
        <div className="flex-1 overflow-hidden">
          <Suspense>
            <ClientsTable bookings={bookings} artistSlug={artistSlug} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
