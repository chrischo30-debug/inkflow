import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import type { SchedulingLink } from "@/lib/pipeline-settings";

export const dynamic = "force-dynamic";

const SENDING_DOMAIN = process.env.FLASHBOOKER_SENDING_DOMAIN || "flashbooker.app";
const resend = new Resend(process.env.RESEND_API_KEY || "re_mock_key");

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
    .select("scheduling_links, email, name")
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

  // If a booking ID was provided, update it — verify it belongs to this artist first
  if (body.bid) {
    const { data: booking } = await admin
      .from("bookings")
      .select("id, state, artist_id")
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
    }
  }

  const formattedDate = formatDate(body.date);
  const formattedStart = formatTime(body.start);
  const formattedEnd = formatTime(body.end);

  const tzLabel = new Intl.DateTimeFormat("en-US", { timeZone: link.timezone, timeZoneName: "short" })
    .formatToParts(new Date())
    .find(p => p.type === "timeZoneName")?.value ?? link.timezone;

  const emailText = [
    `A client has selected a time for: ${link.label}`,
    ``,
    `Date: ${formattedDate}`,
    `Time: ${formattedStart} – ${formattedEnd} (${tzLabel})`,
    ``,
    body.bid
      ? `Their booking has been moved to Booked and the appointment date has been set automatically.`
      : `Log in to FlashBooker to update the appointment date on their booking card.`,
  ].join("\n");

  try {
    if (process.env.NODE_ENV === "production" || process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: `FlashBooker <noreply@${SENDING_DOMAIN}>`,
        to: [artist.email],
        subject: `Time selected: ${link.label} – ${formattedDate}`,
        text: emailText,
      });
    } else {
      console.log("[MOCK SCHEDULING EMAIL]", { to: artist.email, text: emailText });
    }
  } catch (err) {
    console.error("Scheduling notification email failed:", err);
  }

  return NextResponse.json({ success: true });
}
