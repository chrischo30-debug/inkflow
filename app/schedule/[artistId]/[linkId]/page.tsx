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
  searchParams?: Promise<{ bid?: string; session?: string }>;
}) {
  const { artistId, linkId } = await params;
  const { bid, session } = searchParams ? await searchParams : {};
  const sessionNum = session ? parseInt(session, 10) : undefined;

  const admin = createAdminClient();
  // Use select(*) so a single missing column (e.g. studio_address before migration) doesn't wipe the row
  const { data: artist } = await admin
    .from("artists")
    .select("*")
    .eq("id", artistId)
    .single();

  if (!artist) notFound();

  const links: SchedulingLink[] = Array.isArray(artist.scheduling_links) ? artist.scheduling_links : [];
  const link = links.find(l => l.id === linkId);
  if (!link) notFound();

  const blockedDatesRaw = (artist as { blocked_dates?: unknown }).blocked_dates;
  const blockedDates = Array.isArray(blockedDatesRaw) ? (blockedDatesRaw as string[]) : [];

  // If this is a per-client link, prefill name/email so the client only confirms.
  let prefillName: string | null = null;
  let prefillEmail: string | null = null;
  if (bid) {
    const { data: booking } = await admin
      .from("bookings")
      .select("client_name, client_email")
      .eq("id", bid)
      .eq("artist_id", artistId)
      .single();
    prefillName = booking?.client_name ?? null;
    prefillEmail = booking?.client_email ?? null;
  }

  return (
    <SchedulingPicker
      artistId={artistId}
      linkId={linkId}
      artistName={artist.name}
      studioName={(artist as { studio_name?: string | null }).studio_name ?? null}
      studioAddress={(artist as { studio_address?: string | null }).studio_address ?? null}
      blockedDates={blockedDates}
      link={link}
      bid={bid}
      session={Number.isFinite(sessionNum) && sessionNum && sessionNum > 0 ? sessionNum : undefined}
      prefillName={prefillName}
      prefillEmail={prefillEmail}
    />
  );
}
