import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";
import { ContactFormSettings } from "@/components/contact/ContactFormSettings";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { CoachmarkSequence } from "@/components/coachmarks/Coachmark";

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
  const contactPath = slug ? `/${slug}/contact` : null;

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MobileNavToggle />
            <h1 className="text-xl font-heading font-semibold text-on-surface truncate" data-coachmark="page-contact-form">Contact Form</h1>
            <CoachmarkSequence tips={[{
              id: "page.contact-form.intro",
              anchorSelector: '[data-coachmark="page-contact-form"]',
              title: "A separate way for visitors to reach you",
              body: <>
                <p>Different from your booking form. Use this for general questions, collabs, or whatever doesn&apos;t fit the booking flow.</p>
                <p>Submissions land in your reply-to inbox so you can answer from anywhere.</p>
                <p>Toggle &quot;Show on closed books page&quot; to keep clients reachable even when your books are closed.</p>
              </>,
            }]} />
          </div>
          {contactPath && (
            <div className="flex items-center gap-2">
              <CopyLinkButton path={contactPath} />
              <a
                href={contactPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </a>
            </div>
          )}
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-xl space-y-2">
            <div className="mb-6">
              <h2 className="text-lg font-heading font-semibold text-on-surface">Contact form setup</h2>
              <p className="text-base text-on-surface-variant mt-1 leading-relaxed">
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
