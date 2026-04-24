import { BooksClosedPage } from "@/components/booking/BooksClosedPage";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BooksClosedPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { s } = await searchParams;
  if (!s) return redirect("/form-builder/books");

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(atob(s));
  } catch {
    return redirect("/form-builder/books");
  }

  const { data: artist } = await supabase
    .from("artists")
    .select("name, slug, logo_url, website_url, social_links, show_social_on_booking, booking_bg_color, accent_theme, contact_form_enabled, show_contact_on_closed, contact_form_header, contact_form_subtext, contact_form_button_text, contact_form_confirmation_message, contact_phone_enabled, contact_phone_required, newsletter_form_enabled, show_newsletter_on_closed, kit_api_key, kit_form_id, newsletter_form_header, newsletter_form_subtext, newsletter_form_button_text, newsletter_form_confirmation_message")
    .eq("id", user.id)
    .single();

  if (!artist) return redirect("/login");

  const closedHeader = (settings.books_closed_header as string | undefined) ?? null;
  const closedMessage = (settings.books_closed_message as string | undefined) ?? null;

  const showContact = artist.show_contact_on_closed && artist.contact_form_enabled;
  const showNewsletter = artist.show_newsletter_on_closed && artist.newsletter_form_enabled && artist.kit_api_key && artist.kit_form_id;

  return (
    <div className="relative">
      <div className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
            Preview
          </span>
          Previewing closed books page — unsaved changes not reflected on your live form.
        </div>
        <Link
          href="/form-builder/books"
          className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to editor
        </Link>
      </div>

      <BooksClosedPage
        artistName={artist.name}
        closedHeader={closedHeader}
        logoUrl={artist.logo_url ?? null}
        message={closedMessage}
        websiteUrl={artist.website_url ?? null}
        socialLinks={Array.isArray(artist.social_links) ? artist.social_links : []}
        showSocialOnBooking={artist.show_social_on_booking ?? false}
        bgColor={artist.booking_bg_color ?? "#ffffff"}
        accentTheme={(artist.accent_theme as "crimson" | "blue") ?? "crimson"}
        contactForm={showContact ? {
          artistSlug: artist.slug,
          header: artist.contact_form_header ?? "",
          subtext: artist.contact_form_subtext ?? "",
          buttonText: artist.contact_form_button_text ?? "",
          confirmationMessage: artist.contact_form_confirmation_message ?? "",
          phoneEnabled: artist.contact_phone_enabled ?? false,
          phoneRequired: artist.contact_phone_required ?? false,
        } : null}
        newsletter={showNewsletter ? {
          artistSlug: artist.slug,
          header: artist.newsletter_form_header ?? "",
          subtext: artist.newsletter_form_subtext ?? "",
          buttonText: artist.newsletter_form_button_text ?? "",
          confirmationMessage: artist.newsletter_form_confirmation_message ?? "",
        } : null}
      />
    </div>
  );
}
