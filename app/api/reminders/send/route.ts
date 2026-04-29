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
  if (!secret) {
    // Missing CRON_SECRET in production = anyone can trigger a full reminder
    // cycle (mass email). Fail closed. Dev/preview only: allow.
    return process.env.NODE_ENV !== "production";
  }
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
    const nowIso = now.toISOString();
    const windowEndIso = windowEnd.toISOString();

    // Pull every still-active booking for the artist. Multi-session bookings
    // need per-session inspection (their session 2/3 dates live in
    // session_appointments[]), so we evaluate the window in JS rather than
    // SQL. State filter accepts both `booked` (pipeline_v2) and `confirmed`
    // (legacy) so reminders fire for new + old data.
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, client_name, client_email, appointment_date, payment_link_sent, reminder_sent_at, session_count, session_appointments")
      .eq("artist_id", artist.id)
      .in("state", ["booked", "confirmed"]);

    if (!bookings?.length) continue;

    const paymentLinksList = normalizePaymentLinks(artist.payment_links) as PaymentLink[];
    const calendarLinksList: CalendarLink[] = [];
    const artistReplyTo = (artist as { gmail_address?: string | null; email?: string | null }).gmail_address ?? (artist as { email?: string | null }).email ?? null;

    type BookingRow = {
      id: string;
      client_name: string;
      client_email: string;
      appointment_date?: string | null;
      reminder_sent_at?: string | null;
      session_count?: number | null;
      session_appointments?: Array<Record<string, unknown>> | null;
    };

    for (const booking of bookings as BookingRow[]) {
      const sessionCount = booking.session_count ?? 1;

      // Build the list of (sessionIndex, appointmentDate, alreadyReminded,
      // alreadyCompleted) tuples we need to consider.
      type Slot = { idx: number; date: string; reminded: boolean; completed: boolean };
      const slots: Slot[] = [];

      if (sessionCount > 1) {
        const apps = Array.isArray(booking.session_appointments) ? booking.session_appointments : [];
        for (let i = 0; i < sessionCount; i++) {
          const app = apps[i] as { appointment_date?: string; reminder_sent_at?: string; completed_at?: string } | undefined;
          if (!app?.appointment_date) continue;
          slots.push({
            idx: i,
            date: app.appointment_date,
            reminded: !!app.reminder_sent_at,
            completed: !!app.completed_at,
          });
        }
      } else if (booking.appointment_date) {
        slots.push({
          idx: 0,
          date: booking.appointment_date,
          reminded: !!booking.reminder_sent_at,
          completed: false,
        });
      }

      for (const slot of slots) {
        if (slot.reminded || slot.completed) continue;
        if (slot.date <= nowIso) continue;          // already in the past
        if (slot.date > windowEndIso) continue;     // outside the reminder window

        try {
          const vars = buildTemplateVars({
            clientName: booking.client_name,
            artistName: artist.name,
            paymentLinksList,
            calendarLinksList,
            appointmentDate: slot.date,
          });

          // Multi-session reminders prefix the session number so the client
          // knows which appointment is coming up.
          const isMulti = sessionCount > 1;
          const subjectPrefix = isMulti ? `Session ${slot.idx + 1} ` : "";
          const reminderTpl = {
            subject: `${subjectPrefix}${DEFAULT_REMINDER_TEMPLATE.subject}`,
            body: isMulti
              ? `Hi {clientName},\n\nQuick reminder you have session ${slot.idx + 1} of ${sessionCount} with {artistName} on {appointmentDate}.\n\nReply to this email if anything comes up.\n\n{artistName}`
              : DEFAULT_REMINDER_TEMPLATE.body,
          };

          await sendEmail({
            toEmail: booking.client_email,
            vars,
            template: reminderTpl,
            artistReplyTo,
            branding: {
              logoUrl: (artist as { logo_url?: string | null }).logo_url ?? null,
              logoEnabled: (artist as { email_logo_enabled?: boolean | null }).email_logo_enabled !== false,
              logoBg: ((artist as { email_logo_bg?: "light" | "dark" | null }).email_logo_bg ?? "light") as "light" | "dark",
            },
          });

          // Stamp the per-session reminder_sent_at for multi-session, and the
          // top-level reminder_sent_at for single-session (preserves existing
          // single-session behavior so legacy rows aren't re-reminded).
          const stamp = new Date().toISOString();
          if (isMulti) {
            const apps = Array.isArray(booking.session_appointments)
              ? [...booking.session_appointments]
              : [];
            while (apps.length <= slot.idx) apps.push({});
            apps[slot.idx] = { ...(apps[slot.idx] ?? {}), reminder_sent_at: stamp };
            await supabase
              .from("bookings")
              .update({ session_appointments: apps, last_email_sent_at: stamp })
              .eq("id", booking.id);
            // Update local copy so subsequent slots in this loop see the change.
            booking.session_appointments = apps;
          } else {
            await supabase
              .from("bookings")
              .update({ reminder_sent_at: stamp, last_email_sent_at: stamp })
              .eq("id", booking.id);
          }

          sent++;
        } catch (e) {
          const msg = `Booking ${booking.id} session ${slot.idx + 1}: ${e instanceof Error ? e.message : String(e)}`;
          errors.push(msg);
          console.error("Reminder send failed:", msg);
        }
      }
    }
  }

  return NextResponse.json({ sent, errors: errors.length ? errors : undefined });
}
