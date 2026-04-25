import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushSseEvent } from "@/lib/sse-registry";
import { sendEmail, buildTemplateVars } from "@/lib/email";
import type { SchedulingLink } from "@/lib/pipeline-settings";

const CALENDAR_EMAIL_TEMPLATE = {
  subject: `Your deposit is confirmed — book your appointment with {artistName}`,
  body: `Hi {clientFirstName},

Your deposit has been received — you're locked in!

Use this link to pick your appointment time:
{schedulingLink}

Looking forward to working with you.

{artistName}`,
};

const CALENDAR_EMAIL_NO_LINK_TEMPLATE = {
  subject: `Deposit confirmed — {artistName}`,
  body: `Hi {clientFirstName},

Your deposit has been received — you're all set!

{artistName} will be in touch shortly to confirm your appointment time.

{artistName}`,
};

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
    .select("stripe_webhook_secret, stripe_api_key, name, scheduling_links, gmail_address, email")
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
      const amountPaid = session.amount_total ?? 0;
      const stripePaymentId = session.payment_intent
        ? typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id
        : null;

      if (!bookingId) return NextResponse.json({ received: true });

      // Fetch the booking to get scheduling_link_id and current state
      const { data: booking } = await supabase
        .from("bookings")
        .select("client_email, client_name, state, scheduling_link_id")
        .eq("id", bookingId)
        .eq("artist_id", artistId)
        .single();

      // Mark deposit paid + move to sent_calendar if currently in sent_deposit
      const updates: Record<string, unknown> = {
        deposit_paid: true,
        ...(stripePaymentId ? { stripe_payment_id: stripePaymentId } : {}),
        ...(amountPaid ? { amount_paid: amountPaid } : {}),
      };
      if (booking?.state === "sent_deposit") {
        updates.state = "sent_calendar";
      }
      await supabase.from("bookings").update(updates).eq("id", bookingId).eq("artist_id", artistId);

      // Resolve client details
      const clientEmail = session.metadata?.client_email ?? session.customer_details?.email ?? booking?.client_email ?? "";
      const clientName = session.metadata?.client_name ?? session.customer_details?.name ?? booking?.client_name ?? "";
      const artistName = artist.name ?? "Your artist";
      const artistReplyTo = artist.gmail_address || artist.email || null;

      // Build scheduling link URL if artist set one for automation
      const schedulingLinkId = booking?.scheduling_link_id;
      const allSchedulingLinks: SchedulingLink[] = Array.isArray(artist.scheduling_links) ? artist.scheduling_links : [];
      const schedulingLink = schedulingLinkId ? allSchedulingLinks.find(l => l.id === schedulingLinkId) : null;
      const appOrigin = new URL(req.url).origin;
      const schedulingUrl = schedulingLink
        ? `${appOrigin}/schedule/${artistId}/${schedulingLink.id}?bid=${bookingId}`
        : null;

      if (clientEmail && clientName) {
        if (schedulingUrl) {
          const vars = {
            ...buildTemplateVars({ clientName, artistName, paymentLinksList: [], calendarLinksList: [] }),
            schedulingLink: schedulingUrl,
          };
          await sendEmail({ toEmail: clientEmail, vars, template: CALENDAR_EMAIL_TEMPLATE, artistReplyTo });
        } else {
          const vars = buildTemplateVars({ clientName, artistName, paymentLinksList: [], calendarLinksList: [] });
          await sendEmail({ toEmail: clientEmail, vars, template: CALENDAR_EMAIL_NO_LINK_TEMPLATE, artistReplyTo });
        }
      }

      pushSseEvent(artistId, {
        type: "payment_received",
        booking_id: bookingId,
        client_name: clientName,
        amount_paid: amountPaid,
        next_step: schedulingUrl ? "calendar_link_sent" : "contact_client",
      });
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const bookingId = intent.metadata?.booking_id;
      if (bookingId) {
        await supabase.from("bookings").update({ payment_failed: true }).eq("id", bookingId).eq("artist_id", artistId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
