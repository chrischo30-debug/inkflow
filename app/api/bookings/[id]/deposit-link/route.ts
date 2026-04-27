import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdapter, readArtistPaymentConfig } from "@/lib/payments";

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
    supabase.from("artists").select("*").eq("id", user.id).single(),
    supabase
      .from("bookings")
      .select("id, client_name, artist_id")
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

    return NextResponse.json({ url: created.url, provider: adapter.provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment provider error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
