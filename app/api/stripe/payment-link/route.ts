import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const label: unknown = body.label;
  const amount_cents: unknown = body.amount_cents;

  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (typeof amount_cents !== "number" || amount_cents < 100) {
    return NextResponse.json({ error: "amount_cents must be at least 100" }, { status: 400 });
  }

  const { data: artist } = await supabase
    .from("artists")
    .select("stripe_api_key")
    .eq("id", user.id)
    .single();

  if (!artist?.stripe_api_key) {
    return NextResponse.json({ error: "Stripe not connected" }, { status: 400 });
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(artist.stripe_api_key);

    const product = await stripe.products.create({ name: label.trim() });
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: amount_cents,
    });
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
    });

    return NextResponse.json({ url: paymentLink.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
