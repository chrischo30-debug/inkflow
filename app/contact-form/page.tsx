import { Sidebar } from "@/components/layout/Sidebar";
import { ContactFormSettings } from "@/components/contact/ContactFormSettings";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

export default async function ContactFormPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  type ContactCols = {
    slug: string;
    contact_form_enabled?: boolean;
    contact_form_header?: string;
    contact_form_subtext?: string;
    contact_form_button_text?: string;
    contact_form_confirmation_message?: string;
    show_contact_on_closed?: boolean;
    contact_phone_enabled?: boolean;
    contact_phone_required?: boolean;
  };

  let settings: ContactCols = { slug: "" };
  try {
    const { data } = await supabase
      .from("artists")
      .select("slug, contact_form_enabled, contact_form_header, contact_form_subtext, contact_form_button_text, contact_form_confirmation_message, show_contact_on_closed, contact_phone_enabled, contact_phone_required")
      .eq("id", user.id)
      .single();
    settings = (data as ContactCols) ?? { slug: "" };
  } catch { /* migration not yet applied */ }

  const slug = settings.slug ?? "";

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl shrink-0">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Contact Form</h1>
          {slug && (
            <a
              href={`/${slug}/contact`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
              View Live Form
            </a>
          )}
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-xl space-y-2">
            <div className="mb-6">
              <h2 className="text-base font-semibold text-on-surface">Contact form setup</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                A simple form for visitors to reach you — separate from your booking form.
              </p>
            </div>
            <ContactFormSettings
              slug={slug}
              initialEnabled={settings.contact_form_enabled ?? false}
              initialHeader={settings.contact_form_header ?? ""}
              initialSubtext={settings.contact_form_subtext ?? ""}
              initialButtonText={settings.contact_form_button_text ?? ""}
              initialConfirmationMessage={settings.contact_form_confirmation_message ?? ""}
              initialShowOnClosed={settings.show_contact_on_closed ?? false}
              initialPhoneEnabled={settings.contact_phone_enabled ?? false}
              initialPhoneRequired={settings.contact_phone_required ?? false}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
