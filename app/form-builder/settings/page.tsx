import { Sidebar } from "@/components/layout/Sidebar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { BookingPageSettingsLayout } from "@/components/settings/BookingPageSettingsLayout";

export default async function FormBuilderSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Try extended select first; fall back to base columns if new ones don't exist yet
  let artist: Record<string, unknown> | null = null;
  const { data: extended } = await supabase
    .from("artists")
    .select("slug, booking_bg_color, booking_bg_image_url, booking_layout, booking_font, booking_text_color, booking_button_color, booking_label_color, booking_font_scale, booking_header_size, booking_header_align, logo_url, website_url, social_links, show_social_on_booking")
    .eq("id", user.id)
    .single();

  if (extended) {
    artist = extended as Record<string, unknown>;
  } else {
    const { data: base } = await supabase
      .from("artists")
      .select("slug, booking_bg_color, booking_bg_image_url, booking_layout, booking_font, booking_text_color, logo_url, website_url, social_links, show_social_on_booking")
      .eq("id", user.id)
      .single();
    artist = base as Record<string, unknown> | null;
  }

  if (!artist?.slug) return redirect("/login");

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <BookingPageSettingsLayout
        slug={artist.slug as string}
        initial={{
          booking_bg_color: (artist.booking_bg_color as string) ?? "#ffffff",
          booking_bg_image_url: (artist.booking_bg_image_url as string | null) ?? null,
          booking_layout: (artist.booking_layout as "centered" | "banner" | "minimal" | "full") ?? "centered",
          booking_font: (artist.booking_font as string) ?? "Manrope",
          booking_text_color: (artist.booking_text_color as string) ?? "dark",
          booking_button_color: (artist.booking_button_color as string) ?? undefined,
          booking_label_color: (artist.booking_label_color as string) ?? undefined,
          booking_font_scale: (artist.booking_font_scale as "small" | "base" | "large") ?? "base",
          booking_header_size: (artist.booking_header_size as "sm" | "md" | "lg" | "xl" | "2xl") ?? "md",
          booking_header_align: (artist.booking_header_align as "left" | "center") ?? "left",
          logo_url: (artist.logo_url as string | null) ?? null,
          website_url: (artist.website_url as string) ?? "",
          social_links: Array.isArray(artist.social_links) ? artist.social_links : [],
          show_social_on_booking: (artist.show_social_on_booking as boolean) ?? false,
        }}
      />
    </div>
  );
}
