import { sendStateTransitionEmail } from "@/lib/email";
import { normalizePaymentLinks } from "@/lib/pipeline-settings";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_mock_key");
const SENDING_DOMAIN = process.env.FLASHBOOKER_SENDING_DOMAIN || "flashbooker.app";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `https://${SENDING_DOMAIN}`;

export async function sendInquiryAutoEmail(opts: {
  admin: SupabaseClient;
  artistId: string;
  bookingId: string;
  clientName: string;
  clientEmail: string;
}) {
  const { admin, artistId, bookingId, clientName, clientEmail } = opts;

  const [{ data: artist }, { data: templateRow }] = await Promise.all([
    admin.from("artists")
      .select("name, payment_links, gmail_address, email, logo_url, email_logo_enabled, email_logo_bg, auto_emails_enabled, studio_address")
      .eq("id", artistId)
      .single(),
    admin.from("email_templates")
      .select("*")
      .eq("artist_id", artistId)
      .eq("state", "inquiry")
      .maybeSingle(),
  ]);

  // Always notify the artist about the new submission regardless of auto-email settings
  const artistEmail = (artist as { email?: string | null } | null)?.email;
  if (artistEmail) {
    try {
      const bookingUrl = `${APP_URL}/bookings/${bookingId}`;
      const clientFirstName = clientName.split(" ")[0];
      const clientDisplay = clientEmail && !clientEmail.includes("no-email-provided")
        ? `${clientName} (${clientEmail})`
        : clientName;
      await resend.emails.send({
        from: `FlashBooker <noreply@${SENDING_DOMAIN}>`,
        to: [artistEmail],
        subject: `New submission from ${clientFirstName}`,
        html: `<div style="font-family:sans-serif;font-size:14px;color:#111;padding:24px">
<p style="margin:0 0 16px">You have a new booking submission.</p>
<table style="border-collapse:collapse;margin-bottom:16px">
<tr><td style="padding:3px 16px 3px 0;font-weight:600;white-space:nowrap">From</td><td>${clientDisplay}</td></tr>
</table>
<a href="${bookingUrl}" style="color:#4f46e5">View submission →</a>
</div>`,
      });
    } catch (e) {
      console.error("Artist new-submission notification failed:", e);
    }
  }

  // Client auto-email — respect per-stage kill switches
  if (!clientEmail || clientEmail.includes("no-email-provided")) return;

  const masterAutoOn = (artist as { auto_emails_enabled?: boolean | null } | null)?.auto_emails_enabled !== false;
  const stageAutoOn = templateRow ? templateRow.auto_send : true;
  const stageEnabled = templateRow ? (templateRow as { enabled?: boolean | null }).enabled !== false : true;
  if (!masterAutoOn || !stageEnabled || !stageAutoOn) return;

  const { subject: sentSubject, messageId: threadMessageId } = await sendStateTransitionEmail({
    toEmail: clientEmail,
    clientName,
    artistName: artist?.name ?? "Your Artist",
    newState: "inquiry",
    paymentLinksList: normalizePaymentLinks(artist?.payment_links),
    calendarLinksList: [],
    studioAddress: (artist as { studio_address?: string | null } | null)?.studio_address ?? undefined,
    template: templateRow ?? null,
    artistReplyTo: artist?.gmail_address ?? artist?.email ?? null,
    branding: {
      logoUrl: (artist as { logo_url?: string | null } | null)?.logo_url ?? null,
      logoEnabled: (artist as { email_logo_enabled?: boolean | null } | null)?.email_logo_enabled !== false,
      logoBg: ((artist as { email_logo_bg?: "light" | "dark" | null } | null)?.email_logo_bg ?? "light") as "light" | "dark",
    },
  });

  const nowIso = new Date().toISOString();
  const { data: existingRow } = await admin
    .from("bookings")
    .select("sent_emails")
    .eq("id", bookingId)
    .single();
  const existing = (existingRow as { sent_emails?: { label: string; sent_at: string }[] } | null)?.sent_emails ?? [];
  await admin.from("bookings")
    .update({
      last_email_sent_at: nowIso,
      sent_emails: [...existing, { label: sentSubject ?? "Submission Received", sent_at: nowIso }],
      ...(threadMessageId ? { thread_message_id: threadMessageId } : {}),
    })
    .eq("id", bookingId);
}
