import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

  const [{ data: artist }, { data: booking }] = await Promise.all([
    supabase.from("artists").select("stripe_api_key, name, studio_name").eq("id", user.id).single(),
    supabase.from("bookings").select("id, client_name, artist_id").eq("id", bookingId).eq("artist_id", user.id).single(),
  ]);

  if (!artist?.stripe_api_key) return NextResponse.json({ error: "Stripe not connected" }, { status: 400 });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(artist.stripe_api_key);

    const product = await stripe.products.create({
      name: `Tattoo deposit — ${booking.client_name}`,
      metadata: { booking_id: bookingId, artist_id: user.id },
    });

    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: amount_cents,
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { booking_id: bookingId, artist_id: user.id },
    });

    await supabase
      .from("bookings")
      .update({ stripe_payment_link_url: paymentLink.url })
      .eq("id", bookingId);

    return NextResponse.json({ url: paymentLink.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
