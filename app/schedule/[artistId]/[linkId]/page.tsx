import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SchedulingLink } from "@/lib/pipeline-settings";
import { SchedulingPicker } from "./SchedulingPicker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ artistId: string; linkId: string }>;
  searchParams?: Promise<{ bid?: string }>;
}) {
  const { artistId, linkId } = await params;
  const { bid } = searchParams ? await searchParams : {};

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("name, scheduling_links")
    .eq("id", artistId)
    .single();

  if (!artist) notFound();

  const links: SchedulingLink[] = Array.isArray(artist.scheduling_links) ? artist.scheduling_links : [];
  const link = links.find(l => l.id === linkId);
  if (!link) notFound();

  return (
    <SchedulingPicker
      artistId={artistId}
      linkId={linkId}
      artistName={artist.name}
      link={link}
      bid={bid}
    />
  );
}
