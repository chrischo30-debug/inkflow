import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleDepositReceived } from "@/lib/payments/deposit-received";
import { fetchSquareOrder, verifySquareSignature } from "@/lib/payments/square";
import { readArtistPaymentConfig } from "@/lib/payments";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ artistId: string }> },
) {
  const { artistId } = await params;
  const rawBody = await req.text();
  const sig = req.headers.get("x-square-hmacsha256-signature");

  const supabase = createAdminClient();
  const { data: artistRow } = await supabase
    .from("artists")
    .select("*")
    .eq("id", artistId)
    .single();

  const sigKey =
    (artistRow as { square_webhook_signature_key?: string | null } | null)
      ?.square_webhook_signature_key ?? null;
  const accessToken =
    (artistRow as { square_access_token?: string | null } | null)?.square_access_token ?? null;
  if (!sigKey || !accessToken) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  // Square signs against the exact URL that Square calls. We get the same URL
  // back from the request, but proxies/Next can mangle it; rebuild it.
  const reqUrl = new URL(req.url);
  const notificationUrl = `${reqUrl.origin}${reqUrl.pathname}`;
  if (!verifySquareSignature(rawBody, sig, notificationUrl, sigKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type ?? "";
  // Square fires payment.created and payment.updated; we only care about completion.
  if (eventType === "payment.created" || eventType === "payment.updated") {
    const payment = (event.data?.object as { payment?: Record<string, unknown> } | undefined)
      ?.payment;
    const status = (payment?.status as string | undefined) ?? "";
    if (status !== "COMPLETED") return NextResponse.json({ received: true });

    const orderId = (payment?.order_id as string | undefined) ?? null;
    const paymentId = (payment?.id as string | undefined) ?? null;
    const amount = payment?.amount_money as { amount?: number } | undefined;
    const amountCents = typeof amount?.amount === "number" ? amount.amount : 0;

    if (!orderId) return NextResponse.json({ received: true });

    let bookingId: string | null = null;
    try {
      const order = await fetchSquareOrder(
        readArtistPaymentConfig(artistRow as Record<string, unknown>),
        orderId,
      );
      bookingId = order.bookingId;
    } catch {
      // Fall through; we'll try a deposit_external_id lookup as a fallback.
    }

    if (!bookingId) {
      const { data: byOrderId } = await supabase
        .from("bookings")
        .select("id")
        .eq("artist_id", artistId)
        .eq("deposit_external_id", orderId)
        .maybeSingle();
      bookingId = (byOrderId as { id?: string } | null)?.id ?? null;
    }

    if (!bookingId) return NextResponse.json({ received: true });

    await handleDepositReceived({
      supabase,
      artistId,
      bookingId,
      amountCents,
      externalPaymentId: paymentId,
      appOrigin: reqUrl.origin,
    });
  }

  return NextResponse.json({ received: true });
}
