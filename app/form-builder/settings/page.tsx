import { Sidebar } from "@/components/layout/Sidebar";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { BookingPageSettings } from "@/components/settings/BookingPageSettings";
import Link from "next/link";

export default async function FormBuilderSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("slug, booking_bg_color, booking_bg_image_url, booking_layout, booking_font, booking_text_color, logo_url, website_url, social_links, show_social_on_booking")
    .eq("id", user.id)
    .single();

  return (
    <div className="dashboard flex h-screen w-full bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <Link
              href="/form-builder"
              className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Form Builder
            </Link>
            <span className="text-outline-variant/40">/</span>
            <h1 className="text-xl font-heading font-semibold text-on-surface">Page Settings</h1>
          </div>
          {artist?.slug && (
            <a
              href={`/${artist.slug}/book`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium border border-outline-variant text-outline hover:text-on-surface hover:border-on-surface/40 transition-colors duration-150"
            >
              <ExternalLink className="w-3 h-3" />
              View Live Form
            </a>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <BookingPageSettings
            initial={{
              booking_bg_color: artist?.booking_bg_color ?? "#ffffff",
              booking_bg_image_url: artist?.booking_bg_image_url ?? null,
              booking_layout: (artist?.booking_layout as "centered" | "banner" | "minimal") ?? "centered",
              booking_font: (artist?.booking_font as "sans" | "serif" | "mono") ?? "sans",
              booking_text_color: (artist?.booking_text_color as "dark" | "light") ?? "dark",
              logo_url: artist?.logo_url ?? null,
              website_url: artist?.website_url ?? "",
              social_links: Array.isArray(artist?.social_links) ? artist.social_links : [],
              show_social_on_booking: artist?.show_social_on_booking ?? false,
            }}
          />
        </div>
      </main>
    </div>
  );
}
