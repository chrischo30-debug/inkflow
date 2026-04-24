import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { BooksClosedPage } from "@/components/booking/BooksClosedPage";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCustomFormFields, normalizeFormFields } from "@/lib/form-fields";
import { isBooksOpen } from "@/lib/books";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BookPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId: artistSlug } = await params;
  if (!artistSlug) notFound();

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("*")
    .eq("slug", artistSlug)
    .single();

  if (!artist) notFound();

  // Gate: check if books are currently open
  if (!isBooksOpen({
    books_open: artist.books_open ?? true,
    books_open_at: artist.books_open_at ?? null,
    books_close_at: artist.books_close_at ?? null,
  })) {
    const showContact = artist.show_contact_on_closed && artist.contact_form_enabled;
    const showNewsletter = artist.show_newsletter_on_closed && artist.newsletter_form_enabled && artist.kit_api_key && artist.kit_form_id;
    return (
      <BooksClosedPage
        artistName={artist.name}
        closedHeader={(artist as Record<string, unknown>).books_closed_header as string ?? null}
        logoUrl={artist.logo_url ?? null}
        message={artist.books_closed_message ?? null}
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
    );
  }

  const artistName = artist.name;

  const [{ data: rawFields }, { data: rawCustomFields }] = await Promise.all([
    admin
      .from("form_fields")
      .select("field_key, label, enabled, required, sort_order, placeholder, description, input_type, options")
      .eq("artist_id", artist.id)
      .order("sort_order", { ascending: true }),
    admin
      .from("custom_form_fields")
      .select("id, field_key, label, type, enabled, required, sort_order, placeholder, description, options")
      .eq("artist_id", artist.id)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <BookingPageShell
      artistId={artist.id}
      formFields={normalizeFormFields(rawFields ?? [])}
      customFormFields={normalizeCustomFormFields(rawCustomFields ?? [])}
      formHeader={artist.form_header || `Book with ${artistName}`}
      formSubtext={artist.form_subtext || `Fill out the form below to request an appointment. ${artistName} will review your idea and get back to you.`}
      buttonText={artist.form_button_text || "Submit Inquiry"}
      layout={(artist.booking_layout as "centered" | "banner" | "minimal" | "full") || "centered"}
      font={(artist.booking_font as string) || "Manrope"}
      fontScale={(artist.booking_font_scale as string) || "17"}
      headerSize={(artist.booking_header_size as string) || "36"}
      headerAlign={(artist.booking_header_align as "left" | "center") || "left"}
      textColor={(artist.booking_text_color as string) || undefined}
      buttonColor={(artist.booking_button_color as string) || undefined}
      labelColor={(artist.booking_label_color as string) || undefined}
      bgColor={artist.booking_bg_color || "#ffffff"}
      bgImageUrl={artist.booking_bg_image_url || null}
      logoUrl={artist.logo_url || null}
      websiteUrl={artist.website_url || ""}
      socialLinks={Array.isArray(artist.social_links) ? artist.social_links : []}
      showSocialOnBooking={artist.show_social_on_booking ?? false}
      confirmationMessage={artist.form_confirmation_message || undefined}
      successRedirectUrl={artist.form_success_redirect_url || undefined}
    />
  );
}
