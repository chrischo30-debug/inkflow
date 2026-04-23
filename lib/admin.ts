import { createAdminClient } from "@/lib/supabase/admin";

export async function isSuperUser(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("artists")
    .select("is_superuser")
    .eq("id", userId)
    .single();
  return data?.is_superuser === true;
}
