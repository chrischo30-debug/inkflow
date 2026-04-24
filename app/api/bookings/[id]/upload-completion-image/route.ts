import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, completion_image_urls")
    .eq("id", id)
    .eq("artist_id", user.id)
    .single();

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${user.id}/${id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("completion-images")
    .upload(fileName, file, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from("completion-images").getPublicUrl(fileName);

  const existing = (booking.completion_image_urls as string[] | null) ?? [];
  const updated = [...existing, publicUrl].slice(0, 2);

  await supabase
    .from("bookings")
    .update({ completion_image_urls: updated })
    .eq("id", id)
    .eq("artist_id", user.id);

  return NextResponse.json({ url: publicUrl, urls: updated });
}
