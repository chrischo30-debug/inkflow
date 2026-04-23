import { NewsletterPage } from "@/components/newsletter/NewsletterPage";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewsletterRoute({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId: artistSlug } = await params;
  if (!artistSlug) notFound();

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("name, slug, logo_url, newsletter_form_enabled, kit_api_key, kit_form_id, newsletter_form_header, newsletter_form_subtext, newsletter_form_button_text, newsletter_form_confirmation_message")
    .eq("slug", artistSlug)
    .single();

  if (!artist) notFound();
  if (!artist.newsletter_form_enabled || !artist.kit_api_key || !artist.kit_form_id) notFound();

  return (
    <NewsletterPage
      artistSlug={artist.slug}
      artistName={artist.name}
      logoUrl={artist.logo_url ?? null}
      header={artist.newsletter_form_header ?? ""}
      subtext={artist.newsletter_form_subtext ?? ""}
      buttonText={artist.newsletter_form_button_text ?? ""}
      confirmationMessage={artist.newsletter_form_confirmation_message ?? ""}
    />
  );
}
