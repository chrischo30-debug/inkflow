import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ artistId: string }> },
) {
  const { artistId } = await params;
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: artist } = await supabase
    .from("artists")
    .select("stripe_webhook_secret, stripe_api_key")
    .eq("id", artistId)
    .single();

  if (!artist?.stripe_webhook_secret || !artist.stripe_api_key) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(artist.stripe_api_key);

    const event = stripe.webhooks.constructEvent(rawBody, sig, artist.stripe_webhook_secret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        await supabase
          .from("bookings")
          .update({ deposit_paid: true })
          .eq("id", bookingId)
          .eq("artist_id", artistId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
