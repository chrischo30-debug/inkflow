import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCustomFormFields, normalizeFormFields } from "@/lib/form-fields";

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

  const artistName = artist.name;

  const [{ data: rawFields }, { data: rawCustomFields }] = await Promise.all([
    admin
      .from("form_fields")
      .select("field_key, label, enabled, required, sort_order, placeholder, input_type, options")
      .eq("artist_id", artist.id)
      .order("sort_order", { ascending: true }),
    admin
      .from("custom_form_fields")
      .select("id, field_key, label, type, enabled, required, sort_order, placeholder, options")
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
      layout={(artist.booking_layout as "centered" | "banner" | "minimal") || "centered"}
      font={(artist.booking_font as "sans" | "serif" | "mono") || "sans"}
      fontScale={(artist.booking_font_scale as "small" | "base" | "large") || "base"}
      textColor={(artist.booking_text_color as string) || undefined}
      buttonColor={(artist.booking_button_color as string) || undefined}
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
