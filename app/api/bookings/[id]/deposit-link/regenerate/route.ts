import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdapter, readArtistPaymentConfig } from "@/lib/payments";
import { normalizePaymentLinks, type PaymentLink } from "@/lib/pipeline-settings";

// Square quick_pay links are single-use — once paid, the URL serves a
// confirmation page. This endpoint produces a fresh URL for a booking's
// existing deposit by looking up the matching payment_links template entry
// (matched against booking.deposit_link_url) and recreating it with the same
// label/amount, then persisting the new URL on both the artist's payment_links
// list and the booking row.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: bookingId } = await params;

  const [{ data: artistRow }, { data: booking }] = await Promise.all([
    supabase.from("artists").select("payment_provider, stripe_api_key, square_access_token, square_location_id, square_environment, payment_links").eq("id", user.id).single(),
    supabase
      .from("bookings")
      .select("id, artist_id, deposit_link_url")
      .eq("id", bookingId)
      .eq("artist_id", user.id)
      .single(),
  ]);

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!artistRow) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const priorUrl = (booking as { deposit_link_url?: string | null }).deposit_link_url ?? null;
  if (!priorUrl) {
    return NextResponse.json({ error: "Booking has no deposit link to regenerate" }, { status: 400 });
  }

  const links = normalizePaymentLinks((artistRow as Record<string, unknown>).payment_links);
  const idx = links.findIndex(l => l.url === priorUrl);
  const existing = idx >= 0 ? links[idx] : null;
  if (!existing || typeof existing.amount_cents !== "number" || !existing.id) {
    return NextResponse.json({ error: "Deposit link is not a regenerable template" }, { status: 400 });
  }

  const config = readArtistPaymentConfig(artistRow as Record<string, unknown>);
  const adapter = getAdapter(config);
  if (!adapter) {
    return NextResponse.json({ error: "No payment provider connected" }, { status: 400 });
  }

  try {
    const created = await adapter.createGenericLink({
      label: existing.label,
      amountCents: existing.amount_cents,
    });

    const updatedLinks: PaymentLink[] = links.map((l, i) =>
      i === idx ? { ...l, url: created.url, provider: adapter.provider } : l,
    );
    const bookingUpdates: Record<string, unknown> = {
      deposit_link_url: created.url,
      payment_provider: adapter.provider,
    };
    if (adapter.provider === "stripe") {
      bookingUpdates.stripe_payment_link_url = created.url;
    }
    if (created.externalOrderId) {
      bookingUpdates.deposit_external_id = created.externalOrderId;
    }

    await Promise.all([
      supabase.from("artists").update({ payment_links: updatedLinks }).eq("id", user.id),
      supabase.from("bookings").update(bookingUpdates).eq("id", bookingId),
    ]);

    return NextResponse.json({ url: created.url, id: existing.id, provider: adapter.provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment provider error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
