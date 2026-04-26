import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { normalizeCustomFormFields, normalizeFormFields } from "@/lib/form-fields";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FormBuilderPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { s } = await searchParams;
  if (!s) return redirect("/form-builder/settings");

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(atob(s));
  } catch {
    return redirect("/form-builder/settings");
  }

  const [{ data: artist }, { data: rawFields }, { data: rawCustomFields }] = await Promise.all([
    supabase
      .from("artists")
      .select("*")
      .eq("id", user.id)
      .single(),
    supabase
      .from("form_fields")
      .select("field_key, label, enabled, required, sort_order, placeholder, description, input_type, options")
      .eq("artist_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("custom_form_fields")
      .select("id, field_key, label, type, enabled, required, sort_order, placeholder, description, options")
      .eq("artist_id", user.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!artist) return redirect("/login");

  const artistName = artist.name;

  return (
    <div className="relative">
      {/* Preview banner */}
      <div className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
            Preview
          </span>
          Unsaved changes — this is a preview only.
        </div>
        <Link
          href="/form-builder/settings"
          className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to editor
        </Link>
      </div>

      <BookingPageShell
        artistId={artist.id}
        formFields={normalizeFormFields(rawFields ?? [])}
        customFormFields={normalizeCustomFormFields(rawCustomFields ?? [])}
        formHeader={(settings.form_header as string) ?? artist.form_header ?? `Book with ${artistName}`}
        formSubtext={(settings.form_subtext as string) ?? artist.form_subtext ?? `Fill out the form below to request an appointment.<br />I'll review your idea and get back to you.`}
        buttonText={(settings.form_button_text as string) ?? artist.form_button_text ?? "Submit Inquiry"}
        layout={(settings.booking_layout as "centered" | "banner" | "minimal" | "full") ?? artist.booking_layout ?? "centered"}
        font={(settings.booking_font as string) ?? artist.booking_font ?? "Manrope"}
        fontScale={(settings.booking_font_scale as string) ?? artist.booking_font_scale ?? "17"}
        headerSize={(settings.booking_header_size as string) ?? artist.booking_header_size ?? "36"}
        headerAlign={(settings.booking_header_align as "left" | "center") ?? artist.booking_header_align ?? "left"}
        textColor={(settings.booking_text_color as string) ?? artist.booking_text_color ?? undefined}
        buttonColor={(settings.booking_button_color as string) ?? artist.booking_button_color ?? undefined}
        labelColor={(settings.booking_label_color as string) ?? artist.booking_label_color ?? undefined}
        bgColor={(settings.booking_bg_color as string) ?? artist.booking_bg_color ?? "#ffffff"}
        bgImageUrl={(settings.booking_bg_image_url as string | null) ?? artist.booking_bg_image_url ?? null}
        logoUrl={(settings.logo_url as string | null) ?? artist.logo_url ?? null}
        websiteUrl={(settings.website_url as string) ?? artist.website_url ?? ""}
        socialLinks={Array.isArray(settings.social_links) ? settings.social_links : (Array.isArray(artist.social_links) ? artist.social_links : [])}
        showSocialOnBooking={(settings.show_social_on_booking as boolean) ?? artist.show_social_on_booking ?? false}
        confirmationMessage={(settings.form_confirmation_message as string) ?? artist.form_confirmation_message ?? undefined}
        successRedirectUrl={undefined}
      />
    </div>
  );
}
