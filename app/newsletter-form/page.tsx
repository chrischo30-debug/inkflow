import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";
import { NewsletterFormSettings } from "@/components/newsletter/NewsletterFormSettings";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

export default async function NewsletterFormPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  type NewsletterCols = {
    slug: string;
    kit_api_key?: string;
    kit_form_id?: string;
    newsletter_form_enabled?: boolean;
    newsletter_form_header?: string;
    newsletter_form_subtext?: string;
    newsletter_form_button_text?: string;
    newsletter_form_confirmation_message?: string;
    show_newsletter_on_closed?: boolean;
  };

  let settings: NewsletterCols = { slug: "" };
  try {
    const { data } = await supabase
      .from("artists")
      .select("slug, kit_api_key, kit_form_id, newsletter_form_enabled, newsletter_form_header, newsletter_form_subtext, newsletter_form_button_text, newsletter_form_confirmation_message, show_newsletter_on_closed")
      .eq("id", user.id)
      .single();
    settings = (data as NewsletterCols) ?? { slug: "" };
  } catch { /* migration not yet applied */ }

  const slug = settings.slug ?? "";
  const kitConnected = Boolean(settings.kit_api_key?.trim() && settings.kit_form_id?.trim());

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MobileNavToggle />
            <h1 className="text-xl font-heading font-semibold text-on-surface truncate">Newsletter</h1>
          </div>
          {slug && kitConnected && settings.newsletter_form_enabled && (
            <a
              href={`/${slug}/newsletter`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
              View Live Form
            </a>
          )}
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-xl space-y-2">
            <div className="mb-6">
              <h2 className="text-base font-semibold text-on-surface">Newsletter signup</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Collect email subscribers via Kit — show the form on your books-closed page or share it as a standalone link.
              </p>
            </div>
            <NewsletterFormSettings
              slug={slug}
              kitConnected={kitConnected}
              initialEnabled={settings.newsletter_form_enabled ?? false}
              initialHeader={settings.newsletter_form_header ?? ""}
              initialSubtext={settings.newsletter_form_subtext ?? ""}
              initialButtonText={settings.newsletter_form_button_text ?? ""}
              initialConfirmationMessage={settings.newsletter_form_confirmation_message ?? ""}
              initialShowOnClosed={settings.show_newsletter_on_closed ?? false}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
