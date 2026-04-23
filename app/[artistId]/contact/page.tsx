import { ContactPage } from "@/components/contact/ContactPage";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContactRoute({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId: artistSlug } = await params;
  if (!artistSlug) notFound();

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("name, slug, logo_url, contact_form_enabled, contact_form_header, contact_form_subtext, contact_form_button_text, contact_form_confirmation_message, contact_phone_enabled, contact_phone_required")
    .eq("slug", artistSlug)
    .single();

  if (!artist) notFound();
  if (!artist.contact_form_enabled) notFound();

  return (
    <ContactPage
      artistSlug={artist.slug}
      artistName={artist.name}
      logoUrl={artist.logo_url ?? null}
      header={artist.contact_form_header ?? ""}
      subtext={artist.contact_form_subtext ?? ""}
      buttonText={artist.contact_form_button_text ?? ""}
      confirmationMessage={artist.contact_form_confirmation_message ?? ""}
      phoneEnabled={artist.contact_phone_enabled ?? false}
      phoneRequired={artist.contact_phone_required ?? false}
    />
  );
}
