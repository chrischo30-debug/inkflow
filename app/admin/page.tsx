import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperUser } from "@/lib/admin";
import { Sidebar } from "@/components/layout/Sidebar";
import Link from "next/link";

interface ArtistRow {
  id: string;
  name: string | null;
  email: string | null;
  slug: string | null;
  studio_name: string | null;
  created_at: string;
  is_superuser: boolean;
}

interface BookingStats {
  artist_id: string;
  total: number;
  inquiries: number;
  confirmed: number;
  completed: number;
  last_booking: string | null;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");
  if (!(await isSuperUser(user.id))) return redirect("/");

  const admin = createAdminClient();

  const { data: artists } = await admin
    .from("artists")
    .select("id, name, email, slug, studio_name, created_at, is_superuser")
    .order("created_at", { ascending: false });

  const { data: bookingRows } = await admin
    .from("bookings")
    .select("artist_id, state, created_at");

  const statsByArtist = new Map<string, BookingStats>();
  for (const row of bookingRows ?? []) {
    const existing = statsByArtist.get(row.artist_id) ?? {
      artist_id: row.artist_id,
      total: 0,
      inquiries: 0,
      confirmed: 0,
      completed: 0,
      last_booking: null,
    };
    existing.total++;
    if (row.state === "inquiry" || row.state === "follow_up") existing.inquiries++;
    if (row.state === "confirmed") existing.confirmed++;
    if (row.state === "completed") existing.completed++;
    if (!existing.last_booking || row.created_at > existing.last_booking) {
      existing.last_booking = row.created_at;
    }
    statsByArtist.set(row.artist_id, existing);
  }

  const rows = (artists ?? []) as ArtistRow[];

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Superuser — Artists</h1>
          <span className="ml-3 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {rows.length} artists
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="text-left py-3 pr-4 font-medium text-on-surface-variant">Artist</th>
                  <th className="text-left py-3 pr-4 font-medium text-on-surface-variant">Email</th>
                  <th className="text-right py-3 pr-4 font-medium text-on-surface-variant">Total</th>
                  <th className="text-right py-3 pr-4 font-medium text-on-surface-variant">Inquiries</th>
                  <th className="text-right py-3 pr-4 font-medium text-on-surface-variant">Confirmed</th>
                  <th className="text-right py-3 pr-4 font-medium text-on-surface-variant">Completed</th>
                  <th className="text-right py-3 font-medium text-on-surface-variant">Last Booking</th>
                  <th className="py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map((artist) => {
                  const stats = statsByArtist.get(artist.id);
                  return (
                    <tr key={artist.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-on-surface">{artist.name ?? "—"}</p>
                          {artist.is_superuser && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary">SU</span>
                          )}
                        </div>
                        {artist.studio_name && (
                          <p className="text-xs text-on-surface-variant">{artist.studio_name}</p>
                        )}
                        {artist.slug && (
                          <p className="text-xs text-on-surface-variant font-mono">/{artist.slug}</p>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-on-surface-variant">{artist.email ?? "—"}</td>
                      <td className="py-3.5 pr-4 text-right tabular-nums text-on-surface">
                        {stats?.total ?? 0}
                      </td>
                      <td className="py-3.5 pr-4 text-right tabular-nums text-on-surface-variant">
                        {stats?.inquiries ?? 0}
                      </td>
                      <td className="py-3.5 pr-4 text-right tabular-nums text-on-surface-variant">
                        {stats?.confirmed ?? 0}
                      </td>
                      <td className="py-3.5 pr-4 text-right tabular-nums text-on-surface-variant">
                        {stats?.completed ?? 0}
                      </td>
                      <td className="py-3.5 text-right text-on-surface-variant">
                        {stats?.last_booking
                          ? new Date(stats.last_booking).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="py-3.5 pl-4">
                        <Link
                          href={`/admin/artists/${artist.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {rows.length === 0 && (
              <p className="text-center text-on-surface-variant py-16">No artists yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
