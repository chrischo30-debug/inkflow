import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import type { SchedulingLink } from "@/lib/pipeline-settings";
import { sendEmail, buildTemplateVars } from "@/lib/email";

export const dynamic = "force-dynamic";

const SENDING_DOMAIN = process.env.FLASHBOOKER_SENDING_DOMAIN || "flashbooker.app";
const resend = new Resend(process.env.RESEND_API_KEY || "re_mock_key");

function buildMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  bid: z.string().uuid().optional(),
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
    .select("scheduling_links, email, name, gmail_address, studio_name, studio_address, logo_url, email_logo_enabled, email_logo_bg, auto_emails_enabled")
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

  // If a booking ID was provided, update it — verify it belongs to this artist first.
  // Also capture client details so we can send them a confirmation email below.
  let clientEmailToConfirm: string | null = null;
  let clientNameToConfirm: string | null = null;
  if (body.bid) {
    const { data: booking } = await admin
      .from("bookings")
      .select("id, state, artist_id, client_email, client_name")
      .eq("id", body.bid)
      .eq("artist_id", artistId)
      .single();

    if (booking) {
      const appointmentISO = toAppointmentISO(body.date, body.start, link.timezone);
      const terminalStates = ["booked", "confirmed", "completed", "cancelled", "rejected"];
      const shouldBook = !terminalStates.includes(booking.state);

      await admin
        .from("bookings")
        .update({
          appointment_date: appointmentISO,
          ...(shouldBook ? { state: "booked" } : {}),
        })
        .eq("id", body.bid);

      clientEmailToConfirm = booking.client_email;
      clientNameToConfirm = booking.client_name;
    }
  }

  const formattedDate = formatDate(body.date);
  const formattedStart = formatTime(body.start);
  const formattedEnd = formatTime(body.end);

  const tzLabel = new Intl.DateTimeFormat("en-US", { timeZone: link.timezone, timeZoneName: "short" })
    .formatToParts(new Date())
    .find(p => p.type === "timeZoneName")?.value ?? link.timezone;

  const emailText = [
    `A client booked: ${link.label}`,
    ``,
    `Date: ${formattedDate}`,
    `Time: ${formattedStart} to ${formattedEnd} (${tzLabel})`,
    ``,
    body.bid
      ? `The booking is now in Booked.`
      : `Log in to FlashBooker to find the booking.`,
  ].join("\n");

  try {
    if (process.env.NODE_ENV === "production" || process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: `FlashBooker <noreply@${SENDING_DOMAIN}>`,
        to: [artist.email],
        subject: `New booking confirmed: ${link.label} – ${formattedDate}`,
        text: emailText,
      });
    } else {
      console.log("[MOCK SCHEDULING EMAIL]", { to: artist.email, text: emailText });
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

      await sendEmail({
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
      });
    } catch (err) {
      console.error("Client confirmation email failed:", err);
    }
  }

  return NextResponse.json({ success: true });
}
