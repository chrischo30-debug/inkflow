import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperUser } from "@/lib/admin";
import { Sidebar } from "@/components/layout/Sidebar";
import Link from "next/link";
import { AdminActions } from "@/components/admin/AdminActions";

const STATE_LABELS: Record<string, string> = {
  inquiry: "Inquiry",
  follow_up: "Follow Up",
  accepted: "Accepted",
  deposit_sent: "Deposit Sent",
  paid_calendar_link_sent: "Calendar Sent",
  confirmed: "Confirmed",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default async function AdminArtistPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");
  if (!(await isSuperUser(user.id))) return redirect("/");

  const admin = createAdminClient();

  const { data: artist, error: artistError } = await admin
    .from("artists")
    .select("id, name, email, slug, studio_name, created_at, books_open, calendar_sync_enabled, is_superuser")
    .eq("id", artistId)
    .single();

  // PGRST116 = "no rows found" — genuine 404. Anything else is a DB error.
  if (artistError && artistError.code !== "PGRST116") {
    throw new Error(`Failed to load artist: ${artistError.message}`);
  }
  if (!artist) return notFound();

  const { data: bookingsData } = await admin
    .from("bookings")
    .select("id, client_name, client_email, state, appointment_date, total_amount, created_at")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .limit(50);

  const bookings = bookingsData ?? [];

  const stateCounts: Record<string, number> = {};
  for (const b of bookings) {
    stateCounts[b.state] = (stateCounts[b.state] ?? 0) + 1;
  }

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <Link href="/admin" className="text-sm text-on-surface-variant hover:text-on-surface mr-3">
            ← Artists
          </Link>
          <h1 className="text-xl font-heading font-semibold text-on-surface">
            {artist.name ?? "Unnamed Artist"}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            {artist.slug && (
              <Link
                href={`/${artist.slug}/book`}
                target="_blank"
                className="text-sm px-3.5 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                View Booking Form
              </Link>
            )}
            <AdminActions artistId={artist.id} artistEmail={artist.email ?? ""} targetIsSuperUser={artist.is_superuser ?? false} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Profile */}
            <section className="bg-surface-container-low rounded-xl border border-outline-variant/20 p-6">
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-4">Profile</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-on-surface-variant">Email</dt>
                  <dd className="text-on-surface mt-0.5">{artist.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Slug</dt>
                  <dd className="text-on-surface mt-0.5 font-mono">{artist.slug ? `/${artist.slug}` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Studio</dt>
                  <dd className="text-on-surface mt-0.5">{artist.studio_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Joined</dt>
                  <dd className="text-on-surface mt-0.5">
                    {new Date(artist.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Books Open</dt>
                  <dd className="mt-0.5">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${artist.books_open ? "bg-green-100 text-green-800" : "bg-surface-container text-on-surface-variant"}`}>
                      {artist.books_open ? "Open" : "Closed"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Google Calendar</dt>
                  <dd className="mt-0.5">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${artist.calendar_sync_enabled ? "bg-green-100 text-green-800" : "bg-surface-container text-on-surface-variant"}`}>
                      {artist.calendar_sync_enabled ? "Connected" : "Not connected"}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            {/* Booking state summary */}
            <section className="bg-surface-container-low rounded-xl border border-outline-variant/20 p-6">
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-4">Booking Summary</h2>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stateCounts).map(([state, count]) => (
                  <div key={state} className="flex items-center gap-2 bg-surface-container rounded-lg px-3 py-2">
                    <span className="text-sm text-on-surface-variant">{STATE_LABELS[state] ?? state}</span>
                    <span className="text-sm font-semibold text-on-surface tabular-nums">{count}</span>
                  </div>
                ))}
                {Object.keys(stateCounts).length === 0 && (
                  <p className="text-sm text-on-surface-variant">No bookings yet.</p>
                )}
              </div>
            </section>

            {/* Recent bookings */}
            <section>
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-3">
                Recent Bookings
                <span className="ml-2 font-normal normal-case text-on-surface-variant/60">
                  ({bookings.length}{bookings.length === 50 ? "+" : ""})
                </span>
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    <th className="text-left py-3 pr-4 font-medium text-on-surface-variant">Client</th>
                    <th className="text-left py-3 pr-4 font-medium text-on-surface-variant">State</th>
                    <th className="text-left py-3 pr-4 font-medium text-on-surface-variant">Appointment</th>
                    <th className="text-right py-3 font-medium text-on-surface-variant">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-on-surface">{b.client_name}</p>
                        <p className="text-xs text-on-surface-variant">{b.client_email}</p>
                      </td>
                      <td className="py-3 pr-4 text-on-surface-variant">
                        {STATE_LABELS[b.state] ?? b.state}
                      </td>
                      <td className="py-3 pr-4 text-on-surface-variant">
                        {b.appointment_date
                          ? new Date(b.appointment_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="py-3 text-right text-on-surface-variant">
                        {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bookings.length === 0 && (
                <p className="text-center text-on-surface-variant py-10">No bookings.</p>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
