import { NextResponse } from "next/server";
import { BookingState } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import { createGoogleCalendarEvent, refreshGoogleAccessToken } from "@/lib/google-calendar";

// The strict state configuration as per AGENTS.md rules
const STATE_FLOW: Record<BookingState, BookingState | null> = {
  inquiry: "reviewed",
  reviewed: "deposit_sent",
  deposit_sent: "deposit_paid",
  deposit_paid: "confirmed",
  confirmed: "completed",
  completed: null,
  cancelled: null,
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    if (body.action !== "advance") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
    
    // In a real app we fetch directly from DB to prevent race conditions on state
    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("state, client_email, client_name, artist_id, appointment_date, description")
      .eq("id", id)
      .eq("artist_id", user.id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const currentState = booking.state as BookingState;
    const nextState = STATE_FLOW[currentState];

    if (!nextState) {
      return NextResponse.json({ error: "Booking is already completed" }, { status: 400 });
    }

    let paymentLinkToSend: string | undefined;
    let artistName = "FlashBook Artist";
    if (nextState === "deposit_sent") {
      const { data: artist } = await supabase
        .from("artists")
        .select("name, payment_links")
        .eq("id", booking.artist_id)
        .single();

      if (artist?.name) {
        artistName = artist.name;
      }
      const paymentLinks = (artist?.payment_links ?? {}) as Record<string, string>;
      paymentLinkToSend = Object.values(paymentLinks).find((link) => typeof link === "string" && link.length > 0);

      const { error: updateErr } = await supabase
        .from("bookings")
        .update({
          state: nextState,
          payment_link_sent: paymentLinkToSend ?? null,
        })
        .eq("id", id)
        .eq("artist_id", user.id);

      if (updateErr) {
        throw updateErr;
      }
    } else {
      const { data: artist } = await supabase
        .from("artists")
        .select("name, calendar_sync_enabled, google_refresh_token")
        .eq("id", booking.artist_id)
        .single();
      if (artist?.name) {
        artistName = artist.name;
      }

      const { error: updateErr } = await supabase
        .from("bookings")
        .update({ state: nextState })
        .eq("id", id)
        .eq("artist_id", user.id);
      if (updateErr) {
        throw updateErr;
      }

      if (
        nextState === "confirmed" &&
        artist?.calendar_sync_enabled &&
        artist.google_refresh_token &&
        booking.appointment_date
      ) {
        try {
          const accessToken = await refreshGoogleAccessToken(artist.google_refresh_token);
          const startDate = booking.appointment_date;
          const endDate = new Date(new Date(startDate).getTime() + 1000 * 60 * 60 * 2).toISOString();
          const googleEventId = await createGoogleCalendarEvent({
            accessToken,
            summary: `${booking.client_name} appointment`,
            description: booking.description ?? undefined,
            startDateTime: startDate,
            endDateTime: endDate,
          });
          const { error: googleUpdateErr } = await supabase
            .from("bookings")
            .update({ google_event_id: googleEventId })
            .eq("id", id)
            .eq("artist_id", user.id);
          if (googleUpdateErr) {
            throw googleUpdateErr;
          }
        } catch (googleErr: unknown) {
          console.error("Google sync on confirm failed:", googleErr);
        }
      }
    }

    try {
      // Assuming we have client_email and client_name coming from DB in reality. 
      // Using mock placeholders for the sake of the tutorial.
      await import('@/lib/email').then(m => m.sendStateTransitionEmail({
        toEmail: booking.client_email || 'client@example.com',
        clientName: booking.client_name || 'Client',
        newState: nextState,
        artistName,
        paymentLink: paymentLinkToSend,
      }));
    } catch (e) {
      console.error("Email transition failed:", e);
    }

    return NextResponse.json({ success: true, newState: nextState }, { status: 200 });

  } catch (error: unknown) {
    console.error("Booking transition API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
