import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendEmail, buildTemplateVars } from "@/lib/email";
import type { CalendarLink, PaymentLink } from "@/lib/pipeline-settings";
import { normalizePaymentLinks } from "@/lib/pipeline-settings";

const DEFAULT_REMINDER_TEMPLATE = {
  subject: "Reminder: Your appointment is coming up – {artistName}",
  body: `Hi {clientName},\n\nJust a friendly reminder that you have a tattoo appointment with {artistName} on {appointmentDate}.\n\nIf you have any questions, feel free to reply to this email.\n\nSee you soon!\n\n{artistName}`,
};

// Vercel Cron sends Authorization: Bearer $CRON_SECRET
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: no secret configured, allow all
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Fetch all artists with reminders enabled
  const { data: artists, error: artistErr } = await supabase
    .from("artists")
    .select("id, name, payment_links, calendar_sync_enabled, google_refresh_token, gmail_connected, gmail_address, reminder_hours_before")
    .eq("reminder_enabled", true);

  if (artistErr || !artists?.length) {
    return NextResponse.json({ sent: 0, message: "No artists with reminders enabled." });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const artist of artists) {
    const hoursWindow = (artist.reminder_hours_before as number) ?? 24;
    const now = new Date();
    const windowEnd = new Date(now.getTime() + hoursWindow * 60 * 60 * 1000);

    // Find confirmed bookings whose appointment falls within the window and haven't been reminded
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, client_name, client_email, appointment_date, payment_link_sent, gmail_thread_id")
      .eq("artist_id", artist.id)
      .eq("state", "confirmed")
      .is("reminder_sent_at", null)
      .gt("appointment_date", now.toISOString())
      .lte("appointment_date", windowEnd.toISOString());

    if (!bookings?.length) continue;

    const paymentLinksList = normalizePaymentLinks(artist.payment_links) as PaymentLink[];
    const calendarLinksList: CalendarLink[] = [];

    // Gmail context
    let gmailContext = null;
    try {
      const row = artist as { gmail_connected?: boolean; gmail_address?: string; google_refresh_token?: string };
      if (row.gmail_connected && row.google_refresh_token && row.gmail_address) {
        gmailContext = { refreshToken: row.google_refresh_token, gmailAddress: row.gmail_address };
      }
    } catch { /* no-op */ }

    for (const booking of bookings) {
      try {
        const vars = buildTemplateVars({
          clientName: booking.client_name,
          artistName: artist.name,
          paymentLinksList,
          calendarLinksList,
          appointmentDate: booking.appointment_date ?? undefined,
        });

        const { threadId } = await sendEmail({
          toEmail: booking.client_email,
          vars,
          template: DEFAULT_REMINDER_TEMPLATE,
          gmailContext,
          existingThreadId: booking.gmail_thread_id ?? null,
        });

        await supabase
          .from("bookings")
          .update({
            reminder_sent_at: new Date().toISOString(),
            last_email_sent_at: new Date().toISOString(),
            ...(threadId ? { gmail_thread_id: threadId } : {}),
          })
          .eq("id", booking.id);

        sent++;
      } catch (e) {
        const msg = `Booking ${booking.id}: ${e instanceof Error ? e.message : String(e)}`;
        errors.push(msg);
        console.error("Reminder send failed:", msg);
      }
    }
  }

  return NextResponse.json({ sent, errors: errors.length ? errors : undefined });
}
