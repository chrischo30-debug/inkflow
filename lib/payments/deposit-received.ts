import type { SupabaseClient } from "@supabase/supabase-js";
import { pushSseEvent } from "@/lib/sse-registry";
import { sendEmail, buildTemplateVars, DEFAULT_EMAIL_TEMPLATES } from "@/lib/email";
import type { SchedulingLink } from "@/lib/pipeline-settings";

const CALENDAR_EMAIL_NO_LINK_TEMPLATE = {
  subject: `Deposit received`,
  body: `Hi {clientFirstName},

Got your deposit, thanks. I'll reach out shortly to lock in a time.

{artistName}`,
};

export interface DepositReceivedOpts {
  supabase: SupabaseClient;
  artistId: string;
  bookingId: string;
  amountCents: number;
  externalPaymentId?: string | null;
  appOrigin: string;
}

/**
 * Shared side effect for "client paid the deposit", regardless of provider.
 * - Marks booking as paid (records amount + external id).
 * - If state was sent_deposit, advances to sent_calendar.
 * - Sends the artist's sent_calendar email (or a fallback) with the scheduling link.
 * - Pushes an SSE event to the dashboard.
 */
export async function handleDepositReceived(opts: DepositReceivedOpts): Promise<void> {
  const { supabase, artistId, bookingId, amountCents, externalPaymentId, appOrigin } = opts;

  const { data: artist } = await supabase
    .from("artists")
    .select(
      "name, scheduling_links, gmail_address, email, logo_url, email_logo_enabled, email_logo_bg, auto_emails_enabled, studio_address",
    )
    .eq("id", artistId)
    .single();

  if (!artist) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("client_email, client_name, state, scheduling_link_id, thread_message_id")
    .eq("id", bookingId)
    .eq("artist_id", artistId)
    .single();

  const threadMessageId =
    (booking as { thread_message_id?: string | null } | null)?.thread_message_id ?? undefined;

  const updates: Record<string, unknown> = {
    deposit_paid: true,
    ...(externalPaymentId
      ? { deposit_external_id: externalPaymentId, stripe_payment_id: externalPaymentId }
      : {}),
    ...(amountCents ? { amount_paid: amountCents } : {}),
  };
  if (booking?.state === "sent_deposit") {
    updates.state = "sent_calendar";
  }
  await supabase.from("bookings").update(updates).eq("id", bookingId).eq("artist_id", artistId);

  const clientEmail = booking?.client_email ?? "";
  const clientName = booking?.client_name ?? "";
  const artistName =
    (artist as { name?: string | null }).name ?? "Your artist";
  const artistReplyTo =
    (artist as { gmail_address?: string | null; email?: string | null }).gmail_address ||
    (artist as { gmail_address?: string | null; email?: string | null }).email ||
    null;

  const schedulingLinkId = booking?.scheduling_link_id;
  const allLinks: SchedulingLink[] = Array.isArray(
    (artist as { scheduling_links?: unknown }).scheduling_links,
  )
    ? ((artist as { scheduling_links?: SchedulingLink[] }).scheduling_links ?? [])
    : [];
  const link = schedulingLinkId ? allLinks.find((l) => l.id === schedulingLinkId) : null;
  const schedulingUrl = link
    ? `${appOrigin}/schedule/${artistId}/${link.id}?bid=${bookingId}`
    : null;

  const autoEmailsOn =
    (artist as { auto_emails_enabled?: boolean | null }).auto_emails_enabled !== false;

  if (clientEmail && clientName && autoEmailsOn) {
    const branding = {
      logoUrl: (artist as { logo_url?: string | null }).logo_url ?? null,
      logoEnabled:
        (artist as { email_logo_enabled?: boolean | null }).email_logo_enabled !== false,
      logoBg: ((artist as { email_logo_bg?: "light" | "dark" | null }).email_logo_bg ??
        "light") as "light" | "dark",
    };

    const { data: savedTpl } = await supabase
      .from("email_templates")
      .select("subject, body, auto_send, enabled")
      .eq("artist_id", artistId)
      .eq("state", "sent_calendar")
      .maybeSingle();

    const stageAutoOn = savedTpl ? savedTpl.auto_send : true;
    const stageEnabled = savedTpl
      ? (savedTpl as { enabled?: boolean | null }).enabled !== false
      : true;

    if (stageEnabled && stageAutoOn) {
      const studioAddress = (artist as { studio_address?: string | null }).studio_address ?? "";
      const sendOpts = schedulingUrl
        ? {
            vars: buildTemplateVars({
              clientName,
              artistName,
              paymentLinksList: [],
              calendarLinksList: [],
              schedulingLink: schedulingUrl,
              studioAddress,
            }),
            template: savedTpl
              ? { subject: savedTpl.subject, body: savedTpl.body }
              : DEFAULT_EMAIL_TEMPLATES.sent_calendar,
          }
        : {
            vars: buildTemplateVars({
              clientName,
              artistName,
              paymentLinksList: [],
              calendarLinksList: [],
              studioAddress,
            }),
            template: CALENDAR_EMAIL_NO_LINK_TEMPLATE,
          };

      const { messageId } = await sendEmail({
        toEmail: clientEmail,
        artistReplyTo,
        branding,
        threadMessageId,
        ...sendOpts,
      });
      if (messageId && !threadMessageId) {
        await supabase
          .from("bookings")
          .update({ thread_message_id: messageId })
          .eq("id", bookingId)
          .eq("artist_id", artistId);
      }
    }
  }

  pushSseEvent(artistId, {
    type: "payment_received",
    booking_id: bookingId,
    client_name: clientName,
    amount_paid: amountCents,
    next_step: schedulingUrl ? "calendar_link_sent" : "contact_client",
  });
}
