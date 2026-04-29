import { sendStateTransitionEmail } from "@/lib/email";
import { normalizePaymentLinks } from "@/lib/pipeline-settings";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_mock_key");
const SENDING_DOMAIN = process.env.FLASHBOOKER_SENDING_DOMAIN || "flashbooker.app";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `https://${SENDING_DOMAIN}`;

export interface InquiryAutoEmailResult {
  // True if every email that *should* have fired actually went. False if any
  // attempt threw — the caller should mark the booking so the artist sees a
  // "email didn't send" badge.
  ok: boolean;
  // Short failure description (first error message, truncated). Stored on
  // the booking row for debugging; safe to surface in the dashboard if you
  // ever want to.
  error?: string;
}

export async function sendInquiryAutoEmail(opts: {
  admin: SupabaseClient;
  artistId: string;
  bookingId: string;
  clientName: string;
  clientEmail: string;
}): Promise<InquiryAutoEmailResult> {
  const { admin, artistId, bookingId, clientName, clientEmail } = opts;
  const errors: string[] = [];

  const [{ data: artist }, { data: templateRow }] = await Promise.all([
    admin.from("artists")
      .select("name, payment_links, gmail_address, email, logo_url, email_logo_enabled, email_logo_bg, auto_emails_enabled, studio_address, notify_new_submission")
      .eq("id", artistId)
      .single(),
    admin.from("email_templates")
      .select("*")
      .eq("artist_id", artistId)
      .eq("state", "inquiry")
      .maybeSingle(),
  ]);

  // Notify the artist about the new submission unless they've turned off the
  // "new submission" admin notification in Settings → Reminders.
  const artistEmail = (artist as { email?: string | null } | null)?.email;
  const notifySubmission = (artist as { notify_new_submission?: boolean | null } | null)?.notify_new_submission !== false;
  if (artistEmail && notifySubmission) {
    try {
      const bookingUrl = `${APP_URL}/bookings?expand=${bookingId}`;
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
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Artist new-submission notification failed:", e);
      errors.push(`artist notification: ${msg}`);
    }
  }

  // Client auto-email — respect per-stage kill switches
  if (!clientEmail || clientEmail.includes("no-email-provided")) {
    return { ok: errors.length === 0, error: errors[0] };
  }

  const masterAutoOn = (artist as { auto_emails_enabled?: boolean | null } | null)?.auto_emails_enabled !== false;
  const stageAutoOn = templateRow ? templateRow.auto_send : true;
  const stageEnabled = templateRow ? (templateRow as { enabled?: boolean | null }).enabled !== false : true;
  if (!masterAutoOn || !stageEnabled || !stageAutoOn) {
    // Intentionally skipped (artist disabled it) — not a failure.
    return { ok: errors.length === 0, error: errors[0] };
  }

  let sentSubject: string | undefined;
  let threadMessageId: string | undefined;
  try {
    const result = await sendStateTransitionEmail({
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
    sentSubject = result.subject;
    threadMessageId = result.messageId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Client inquiry auto-email failed:", e);
    errors.push(`client confirmation: ${msg}`);
    return { ok: errors.length === 0, error: errors[0] };
  }

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

  return { ok: errors.length === 0, error: errors[0] };
}
