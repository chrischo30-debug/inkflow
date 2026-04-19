import { createClient } from "@/utils/supabase/server";
import { SidebarNav } from "@/components/layout/SidebarNav";

export async function Sidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let artistName = "FlashBook";
  let artistSubtitle = "Booking Dashboard";

  if (user) {
    const { data: artist } = await supabase
      .from("artists")
      .select("name, studio_name")
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
  }

  return <SidebarNav artistName={artistName} artistSubtitle={artistSubtitle} />;
}
