import { Sidebar } from "@/components/layout/Sidebar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { BookingPageSettingsLayout } from "@/components/settings/BookingPageSettingsLayout";

export default async function FormBuilderSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("slug, booking_bg_color, booking_bg_image_url, booking_layout, booking_font, booking_text_color, logo_url, website_url, social_links, show_social_on_booking")
    .eq("id", user.id)
    .single();

  if (!artist?.slug) return redirect("/login");

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <BookingPageSettingsLayout
        slug={artist.slug}
        initial={{
          booking_bg_color: artist.booking_bg_color ?? "#ffffff",
          booking_bg_image_url: artist.booking_bg_image_url ?? null,
          booking_layout: (artist.booking_layout as "centered" | "banner" | "minimal") ?? "centered",
          booking_font: (artist.booking_font as "sans" | "serif" | "mono") ?? "sans",
          booking_text_color: (artist.booking_text_color as "dark" | "light") ?? "dark",
          logo_url: artist.logo_url ?? null,
          website_url: artist.website_url ?? "",
          social_links: Array.isArray(artist.social_links) ? artist.social_links : [],
          show_social_on_booking: artist.show_social_on_booking ?? false,
        }}
      />
    </div>
  );
}
