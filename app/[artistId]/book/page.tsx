import { InquiryForm } from "@/components/booking/InquiryForm";
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

  if (!artistSlug) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("id, name, slug")
    .eq("slug", artistSlug)
    .single();

  if (!artist) {
    notFound();
  }

  const artistName = artist.name;
  const { data: rawFields } = await admin
    .from("form_fields")
    .select("field_key, label, enabled, required, sort_order, placeholder, input_type, options")
    .eq("artist_id", artist.id)
    .order("sort_order", { ascending: true });
  const formFields = normalizeFormFields(rawFields ?? []);
  const { data: rawCustomFields } = await admin
    .from("custom_form_fields")
    .select("id, field_key, label, type, enabled, required, sort_order, placeholder, options")
    .eq("artist_id", artist.id)
    .order("sort_order", { ascending: true });
  const customFormFields = normalizeCustomFormFields(rawCustomFields ?? []);

  return (
    <main className="min-h-screen py-16 px-4 md:px-8 max-w-3xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-heading font-bold tracking-tight mb-3">
          Book with {artistName}
        </h1>
        <p className="text-muted-foreground">
          Fill out the form below to request an appointment. {artistName} will review your idea and get back to you.
        </p>
      </div>

      <div className="bg-card border border-border rounded-md p-6 md:p-8 shadow-sm">
        <InquiryForm artistId={artist.id} formFields={formFields} customFormFields={customFormFields} />
      </div>
    </main>
  );
}
