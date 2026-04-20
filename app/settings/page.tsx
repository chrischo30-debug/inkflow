import { Sidebar } from "@/components/layout/Sidebar";
import { ExternalLink } from "lucide-react";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: artist } = await supabase
    .from("artists")
    .select("name, slug, studio_name, accent_theme")
    .eq("id", user.id)
    .single();

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Settings</h1>
          {artist?.slug && (
            <a
              href={`/${artist.slug}/book`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
              View Live Form
            </a>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section>
            <ThemeSettings initialTheme={(artist?.accent_theme as "crimson" | "blue") ?? "crimson"} />
          </section>

          <section>
            <AccountSettings
              initialValues={{
                name: artist?.name ?? "",
                slug: artist?.slug ?? "",
                studio_name: artist?.studio_name ?? "",
                email: user.email ?? "",
              }}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
