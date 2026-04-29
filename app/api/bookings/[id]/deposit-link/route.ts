import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdapter, readArtistPaymentConfig } from "@/lib/payments";
import { normalizePaymentLinks, type PaymentLink } from "@/lib/pipeline-settings";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: bookingId } = await params;
  const body = await req.json();
  const amount_cents: unknown = body.amount_cents;

  if (typeof amount_cents !== "number" || amount_cents < 100) {
    return NextResponse.json({ error: "amount_cents must be at least 100" }, { status: 400 });
  }

  const [{ data: artistRow }, { data: booking }] = await Promise.all([
    supabase.from("artists").select("payment_provider, stripe_api_key, square_access_token, square_location_id, square_environment, payment_links").eq("id", user.id).single(),
    supabase
      .from("bookings")
      .select("id, client_name, artist_id, deposit_link_url")
      .eq("id", bookingId)
      .eq("artist_id", user.id)
      .single(),
  ]);

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!artistRow) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const config = readArtistPaymentConfig(artistRow as Record<string, unknown>);
  const adapter = getAdapter(config);
  if (!adapter) {
    return NextResponse.json({ error: "No payment provider connected" }, { status: 400 });
  }

  try {
    const created = await adapter.createDepositLink({
      bookingId,
      artistId: user.id,
      clientName: booking.client_name,
      amountCents: amount_cents,
    });

    const updates: Record<string, unknown> = {
      deposit_link_url: created.url,
      payment_provider: adapter.provider,
    };
    if (adapter.provider === "stripe") {
      // Keep legacy column populated so older read paths still work.
      updates.stripe_payment_link_url = created.url;
    }
    if (created.externalOrderId) {
      updates.deposit_external_id = created.externalOrderId;
    }

    await supabase.from("bookings").update(updates).eq("id", bookingId);

    // Persist the link to the artist's payment_links list. Square links are
    // single-use, so we store {id, provider, amount_cents} as template markers
    // — refreshPaymentLinkTemplates uses these to regenerate a fresh URL on
    // each subsequent send. Reuse the prior entry's id (matched by the
    // booking's previous deposit URL) so we replace in place rather than
    // accumulating dead URLs every Generate click.
    const existing = normalizePaymentLinks(
      (artistRow as Record<string, unknown>).payment_links,
    );
    const priorUrl = (booking as { deposit_link_url?: string | null }).deposit_link_url ?? null;
    const priorIndex = priorUrl ? existing.findIndex(l => l.url === priorUrl) : -1;
    const depositLabel = `Deposit — ${booking.client_name ?? "Client"}`;
    const reuseId = priorIndex >= 0 ? existing[priorIndex].id : undefined;
    const newEntry: PaymentLink = {
      id: reuseId ?? randomUUID(),
      label: depositLabel,
      url: created.url,
      provider: adapter.provider,
      amount_cents,
    };
    let updatedLinks: PaymentLink[];
    if (priorIndex >= 0) {
      updatedLinks = existing.map((l, i) => (i === priorIndex ? newEntry : l));
    } else if (existing.some(l => l.url === created.url)) {
      updatedLinks = existing;
    } else {
      updatedLinks = [...existing, newEntry];
    }
    await supabase.from("artists").update({ payment_links: updatedLinks }).eq("id", user.id);

    return NextResponse.json({ url: created.url, provider: adapter.provider, id: newEntry.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment provider error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
