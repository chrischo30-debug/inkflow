import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import type { SchedulingLink } from "@/lib/pipeline-settings";
import { sendEmail, buildTemplateVars } from "@/lib/email";
import { getGoogleAccessToken, createGoogleCalendarEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const SENDING_DOMAIN = process.env.FLASHBOOKER_SENDING_DOMAIN || "flashbooker.app";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `https://${SENDING_DOMAIN}`;
const resend = new Resend(process.env.RESEND_API_KEY || "re_mock_key");

function buildMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  bid: z.string().uuid().optional(),
  /** 1-based session index for multi-session bookings; defaults to 1. */
  session: z.number().int().min(1).optional(),
});

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const dt = new Date(Date.UTC(2000, 0, 1, h, m));
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

// Build an ISO timestamp for date+time in the given timezone
function toAppointmentISO(dateStr: string, timeStr: string, tz: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  // Approximate UTC by adjusting for the tz offset at that moment
  const naive = new Date(Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10)),
    h, m, 0,
  ));
  const utcDate = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  const localDate = new Date(naive.toLocaleString("en-US", { timeZone: tz }));
  const offsetMs = localDate.getTime() - utcDate.getTime();
  return new Date(naive.getTime() - offsetMs).toISOString();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ artistId: string; linkId: string }> },
) {
  const { artistId, linkId } = await params;

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("scheduling_links, email, name, gmail_address, studio_name, studio_address, logo_url, email_logo_enabled, email_logo_bg, auto_emails_enabled, google_refresh_token, calendar_sync_enabled, notify_new_booking")
    .eq("id", artistId)
    .single();

  if (!artist) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const links: SchedulingLink[] = Array.isArray(artist.scheduling_links) ? artist.scheduling_links : [];
  const link = links.find(l => l.id === linkId);
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Defense in depth: re-check the slot against existing bookings server-side
  // so a crafted request can't bypass the buffer/overlap rules enforced by
  // the slots endpoint. Buffer is symmetric — applies before and after each
  // existing booking.
  {
    const buffer = Math.max(0, link.buffer_minutes ?? 0);
    const slotStart = new Date(toAppointmentISO(body.date, body.start, link.timezone));
    const slotEnd = new Date(toAppointmentISO(body.date, body.end, link.timezone));
    const dayStartISO = `${body.date}T00:00:00.000Z`;
    const nextDate = new Date(body.date);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const dayEndISO = `${nextDate.toISOString().slice(0, 10)}T00:00:00.000Z`;

    const { data: dayBookings } = await admin
      .from("bookings")
      .select("id, appointment_date")
      .eq("artist_id", artistId)
      .not("state", "in", '("cancelled","rejected")')
      .gte("appointment_date", dayStartISO)
      .lt("appointment_date", dayEndISO);

    const fallbackDuration = link.is_half_day
      ? (link.half_day_minutes ?? 240)
      : link.duration_minutes;
    const conflict = (dayBookings ?? [])
      .filter(b => b.appointment_date && b.id !== body.bid)
      .some(b => {
        const bStart = new Date(b.appointment_date as string);
        const bEnd = new Date(bStart.getTime() + fallbackDuration * 60000);
        const inflStart = new Date(bStart.getTime() - buffer * 60000);
        const inflEnd = new Date(bEnd.getTime() + buffer * 60000);
        return slotStart < inflEnd && slotEnd > inflStart;
      });

    if (conflict) {
      return NextResponse.json(
        { error: "That time conflicts with another booking. Please pick a different slot." },
        { status: 409 },
      );
    }
  }

  // If a booking ID was provided, update it — verify it belongs to this artist first.
  // Also capture client details so we can send them a confirmation email below.
  let clientEmailToConfirm: string | null = null;
  let clientNameToConfirm: string | null = null;
  let scheduleThreadMessageId: string | undefined = undefined;
  if (body.bid) {
    const { data: booking } = await admin
      .from("bookings")
      .select("id, state, artist_id, client_email, client_name, thread_message_id, session_count, session_appointments, appointment_date")
      .eq("id", body.bid)
      .eq("artist_id", artistId)
      .single();

    if (booking) {
      const appointmentISO = toAppointmentISO(body.date, body.start, link.timezone);

      type Br = { session_count?: number | null; session_appointments?: unknown; appointment_date?: string | null };
      const br = booking as Br;
      const sessionCount = br.session_count ?? 1;
      const sessionIdxParam = body.session && body.session > 0 ? body.session : 1;
      const sessionIdx0 = sessionIdxParam - 1;

      // Guardrail: a per-client booking link is single-use per session.
      // If the booking is already booked / completed / cancelled / rejected, or
      // if the targeted session already has a date, reject the request so the
      // client can't overwrite the appointment by reopening the same email link.
      const terminalStates = ["completed", "cancelled", "rejected"];
      if (terminalStates.includes(booking.state)) {
        return NextResponse.json(
          { error: "This booking is no longer accepting scheduling. Reach out to your artist if you need to change the time." },
          { status: 409 },
        );
      }

      if (sessionCount > 1) {
        const apps = Array.isArray(br.session_appointments)
          ? (br.session_appointments as Record<string, unknown>[])
          : [];
        const existingDate = (apps[sessionIdx0] as { appointment_date?: string } | undefined)?.appointment_date;
        if (existingDate) {
          return NextResponse.json(
            { error: `Session ${sessionIdxParam} is already booked. Reach out to your artist if you need to change the time.` },
            { status: 409 },
          );
        }
      } else if (br.appointment_date || booking.state === "booked" || booking.state === "confirmed") {
        return NextResponse.json(
          { error: "This booking already has an appointment. Reach out to your artist if you need to change the time." },
          { status: 409 },
        );
      }

      const updates: Record<string, unknown> = {};

      if (sessionCount > 1) {
        // Multi-session: slot the picked date into session_appointments[idx]
        // and only set the top-level appointment_date when session 1 is booked
        // (so the upcoming-appointment / reminders still target the next session).
        const apps = Array.isArray(br.session_appointments)
          ? [...(br.session_appointments as Record<string, unknown>[])]
          : [];
        while (apps.length <= sessionIdx0) apps.push({});
        apps[sessionIdx0] = { ...(apps[sessionIdx0] ?? {}), appointment_date: appointmentISO };
        updates.session_appointments = apps;
        if (sessionIdxParam === 1) updates.appointment_date = appointmentISO;
        if (booking.state !== "booked" && booking.state !== "confirmed") updates.state = "booked";
      } else {
        updates.appointment_date = appointmentISO;
        updates.state = "booked";
      }

      await admin.from("bookings").update(updates).eq("id", body.bid);

      clientEmailToConfirm = booking.client_email;
      clientNameToConfirm = booking.client_name;
      scheduleThreadMessageId = (booking as { thread_message_id?: string | null }).thread_message_id ?? undefined;
    }
  }

  const formattedDate = formatDate(body.date);
  const formattedStart = formatTime(body.start);
  const formattedEnd = formatTime(body.end);

  const tzLabel = new Intl.DateTimeFormat("en-US", { timeZone: link.timezone, timeZoneName: "short" })
    .formatToParts(new Date())
    .find(p => p.type === "timeZoneName")?.value ?? link.timezone;

  // Create Google Calendar event if connected
  let calHtmlLink: string | null = null;
  if (body.bid && (artist as { calendar_sync_enabled?: boolean | null }).calendar_sync_enabled && (artist as { google_refresh_token?: string | null }).google_refresh_token) {
    try {
      const accessToken = await getGoogleAccessToken(admin, artistId, (artist as { google_refresh_token: string }).google_refresh_token);
      if (accessToken) {
        const startISO = toAppointmentISO(body.date, body.start, link.timezone);
        const endISO = toAppointmentISO(body.date, body.end, link.timezone);
        const calResult = await createGoogleCalendarEvent({
          accessToken,
          summary: `${clientNameToConfirm ?? "Client"} – ${link.label}`,
          startDateTime: startISO,
          endDateTime: endISO,
        });
        calHtmlLink = calResult.htmlLink;
        if (calResult.id) {
          await admin.from("bookings").update({ google_event_id: calResult.id }).eq("id", body.bid);
        }
      }
    } catch (e) { console.error("Calendar event creation on schedule failed:", e); }
  }

  const bookingUrl = body.bid ? `${APP_URL}/bookings?expand=${body.bid}` : null;
  const clientDisplay = clientNameToConfirm ?? "A client";

  const notifyNewBooking = (artist as { notify_new_booking?: boolean | null }).notify_new_booking !== false;
  try {
    if (notifyNewBooking && (process.env.NODE_ENV === "production" || process.env.RESEND_API_KEY)) {
      const linksHtml = [
        bookingUrl ? `<a href="${bookingUrl}" style="color:#4f46e5">View booking →</a>` : null,
        calHtmlLink ? `<a href="${calHtmlLink}" style="color:#4f46e5">View in Google Calendar →</a>` : null,
      ].filter(Boolean).join(" &nbsp;·&nbsp; ");

      await resend.emails.send({
        from: `FlashBooker <noreply@${SENDING_DOMAIN}>`,
        to: [artist.email],
        subject: `New booking: ${clientDisplay} – ${link.label}`,
        html: `<div style="font-family:sans-serif;font-size:14px;color:#111;padding:24px">
<p style="margin:0 0 16px"><strong>${clientDisplay}</strong> booked a session.</p>
<table style="border-collapse:collapse;margin-bottom:16px">
<tr><td style="padding:3px 16px 3px 0;font-weight:600;white-space:nowrap">Type</td><td>${link.label}</td></tr>
<tr><td style="padding:3px 16px 3px 0;font-weight:600;white-space:nowrap">Date</td><td>${formattedDate}</td></tr>
<tr><td style="padding:3px 16px 3px 0;font-weight:600;white-space:nowrap">Time</td><td>${formattedStart} – ${formattedEnd} (${tzLabel})</td></tr>
</table>
${linksHtml ? `<p style="margin:0">${linksHtml}</p>` : ""}
</div>`,
      });
    } else {
      console.log("[MOCK SCHEDULING EMAIL]", { to: artist.email, clientDisplay, link: link.label, formattedDate });
    }
  } catch (err) {
    console.error("Scheduling notification email failed:", err);
  }

  // Confirmation email to the client (if we have their address from the booking)
  const autoEmailsOn = (artist as { auto_emails_enabled?: boolean | null }).auto_emails_enabled !== false;
  if (clientEmailToConfirm && clientNameToConfirm && autoEmailsOn) {
    try {
      const studioAddress = (artist as { studio_address?: string | null }).studio_address;
      const mapsUrl = studioAddress ? buildMapsUrl(studioAddress) : null;
      const artistName = artist.name || "Your artist";
      const venueLine = (artist as { studio_name?: string | null }).studio_name || artistName;
      const replyTo = (artist as { gmail_address?: string | null }).gmail_address || artist.email || null;

      const bodyLines = [
        `Hi ${clientNameToConfirm.split(" ")[0]},`,
        ``,
        `You're booked with ${artistName}.`,
        ``,
        `When: ${formattedDate}`,
        `Time: ${formattedStart} to ${formattedEnd} (${tzLabel})`,
      ];
      if (studioAddress && mapsUrl) {
        bodyLines.push(``, `Where: ${venueLine}`, studioAddress, mapsUrl);
      }
      bodyLines.push(``, `Reply to this email if you need to reschedule.`, ``, artistName);

      const { messageId: schedMsgId } = await sendEmail({
        toEmail: clientEmailToConfirm,
        vars: buildTemplateVars({
          clientName: clientNameToConfirm,
          artistName,
          paymentLinksList: [],
          calendarLinksList: [],
        }),
        template: {
          subject: `Appointment confirmed – ${formattedDate}`,
          body: bodyLines.join("\n"),
        },
        artistReplyTo: replyTo,
        branding: {
          logoUrl: (artist as { logo_url?: string | null }).logo_url ?? null,
          logoEnabled: (artist as { email_logo_enabled?: boolean | null }).email_logo_enabled !== false,
          logoBg: ((artist as { email_logo_bg?: "light" | "dark" | null }).email_logo_bg ?? "light") as "light" | "dark",
        },
        threadMessageId: scheduleThreadMessageId,
      });
      if (schedMsgId && !scheduleThreadMessageId && body.bid) {
        await admin.from("bookings").update({ thread_message_id: schedMsgId }).eq("id", body.bid);
      }
    } catch (err) {
      console.error("Client confirmation email failed:", err);
    }
  }

  return NextResponse.json({ success: true });
}
