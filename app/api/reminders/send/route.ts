import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendEmail, buildTemplateVars } from "@/lib/email";
import type { CalendarLink, PaymentLink } from "@/lib/pipeline-settings";
import { normalizePaymentLinks } from "@/lib/pipeline-settings";

const DEFAULT_REMINDER_TEMPLATE = {
  subject: "Reminder: appointment with {artistName}",
  body: `Hi {clientName},\n\nQuick reminder you have an appointment with {artistName} on {appointmentDate}.\n\nReply to this email if anything comes up.\n\n{artistName}`,
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
    .select("id, name, email, payment_links, gmail_address, reminder_hours_before, logo_url, email_logo_enabled, email_logo_bg")
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
      .select("id, client_name, client_email, appointment_date, payment_link_sent")
      .eq("artist_id", artist.id)
      .eq("state", "confirmed")
      .is("reminder_sent_at", null)
      .gt("appointment_date", now.toISOString())
      .lte("appointment_date", windowEnd.toISOString());

    if (!bookings?.length) continue;

    const paymentLinksList = normalizePaymentLinks(artist.payment_links) as PaymentLink[];
    const calendarLinksList: CalendarLink[] = [];
    const artistReplyTo = (artist as { gmail_address?: string | null; email?: string | null }).gmail_address ?? (artist as { email?: string | null }).email ?? null;

    for (const booking of bookings) {
      try {
        const vars = buildTemplateVars({
          clientName: booking.client_name,
          artistName: artist.name,
          paymentLinksList,
          calendarLinksList,
          appointmentDate: booking.appointment_date ?? undefined,
        });

        await sendEmail({
          toEmail: booking.client_email,
          vars,
          template: DEFAULT_REMINDER_TEMPLATE,
          artistReplyTo,
          branding: {
            logoUrl: (artist as { logo_url?: string | null }).logo_url ?? null,
            logoEnabled: (artist as { email_logo_enabled?: boolean | null }).email_logo_enabled !== false,
            logoBg: ((artist as { email_logo_bg?: "light" | "dark" | null }).email_logo_bg ?? "light") as "light" | "dark",
          },
        });

        await supabase
          .from("bookings")
          .update({
            reminder_sent_at: new Date().toISOString(),
            last_email_sent_at: new Date().toISOString(),
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
