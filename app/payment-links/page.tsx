import { Sidebar } from "@/components/layout/Sidebar";
import { LinksView } from "@/components/links/LinksView";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { normalizePaymentLinks } from "@/lib/pipeline-settings";
import type { CalendarLink } from "@/lib/pipeline-settings";

export default async function LinksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const [{ data: artist }, { data: extended }] = await Promise.all([
    supabase.from("artists").select("payment_links").eq("id", user.id).single(),
    supabase.from("artists").select("calendar_links, calcom_api_key").eq("id", user.id).single(),
  ]);

  const ext = (extended as { calendar_links?: CalendarLink[]; calcom_api_key?: string } | null);
  const calcomConnected = Boolean(ext?.calcom_api_key);

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Links</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <LinksView
            initialPaymentLinks={normalizePaymentLinks(artist?.payment_links)}
            initialCalendarLinks={(ext?.calendar_links ?? [])}
            calcomConnected={calcomConnected}
          />
        </div>
      </main>
    </div>
  );
}
