import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { SidebarNav } from "@/components/layout/SidebarNav";

export async function Sidebar() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get("sidebar_collapsed")?.value === "true";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let artistName = "FlashBooker";
  let artistSubtitle = "Booking Dashboard";
  let adminUser = false;

  if (user) {
    const { data: artist } = await supabase
      .from("artists")
      .select("name, studio_name, is_superuser")
      .eq("id", user.id)
      .single();

    if (artist?.name) {
      artistName = artist.name;
    }
    if (artist?.studio_name) {
      artistSubtitle = artist.studio_name;
    } else if (user.email) {
      artistSubtitle = user.email;
    }
    if (artist?.is_superuser) {
      adminUser = true;
    }
  }

  return <SidebarNav artistName={artistName} artistSubtitle={artistSubtitle} isSuperUser={adminUser} initialCollapsed={initialCollapsed} />;
}
