import { NextResponse } from "next/server";
import { BookingState } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  refreshGoogleAccessToken,
} from "@/lib/google-calendar";

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const action: string = body.action;

    if (!["advance", "cancel", "update_appointment", "move"].includes(action)) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    // Select only columns guaranteed in the base schema
    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("state, client_email, client_name, artist_id, appointment_date, description, payment_link_sent")
      .eq("id", id)
      .eq("artist_id", user.id)
      .single();

    if (fetchErr || !booking) {
      console.error("Booking fetch error:", fetchErr);
      return NextResponse.json({ error: "Booking not found", detail: fetchErr?.message }, { status: 404 });
    }

    // google_event_id and gmail_thread_id are migration-gated — fetch separately
    let googleEventId: string | null = null;
    let gmailThreadId: string | null = null;
    {
      const { data: extRow } = await supabase
        .from("bookings")
        .select("google_event_id, gmail_thread_id")
        .eq("id", id)
        .single();
      const r = extRow as { google_event_id?: string; gmail_thread_id?: string } | null;
      googleEventId = r?.google_event_id ?? null;
      gmailThreadId = r?.gmail_thread_id ?? null;
    }

    // ── Move to any state ─────────────────────────────────────────────────────
    if (action === "move") {
      const targetState = body.target_state as BookingState;
      const validStates: BookingState[] = ["inquiry", "reviewed", "deposit_sent", "deposit_paid", "confirmed", "completed", "cancelled"];
      if (!validStates.includes(targetState)) {
        return NextResponse.json({ error: "Invalid target_state" }, { status: 400 });
      }
      await supabase.from("bookings").update({ state: targetState }).eq("id", id).eq("artist_id", user.id);

      // Delete calendar event if moving to cancelled
      if (targetState === "cancelled" && googleEventId) {
        try {
          const { data: artist } = await supabase.from("artists").select("google_refresh_token, calendar_sync_enabled").eq("id", user.id).single();
          if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
            const accessToken = await refreshGoogleAccessToken(artist.google_refresh_token);
            await deleteGoogleCalendarEvent({ accessToken, eventId: googleEventId });
          }
        } catch (e) { console.error("Calendar delete on move-to-cancelled failed:", e); }
      }

      return NextResponse.json({ success: true, newState: targetState });
    }

    // ── Cancel ────────────────────────────────────────────────────────────────
    if (action === "cancel") {
      await supabase.from("bookings").update({ state: "cancelled" }).eq("id", id);

      if (googleEventId) {
        try {
          const { data: artist } = await supabase
            .from("artists")
            .select("google_refresh_token, calendar_sync_enabled")
            .eq("id", user.id)
            .single();
          if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
            const accessToken = await refreshGoogleAccessToken(artist.google_refresh_token);
            await deleteGoogleCalendarEvent({ accessToken, eventId: googleEventId });
          }
        } catch (e) {
          console.error("Calendar event deletion failed:", e);
        }
      }

      return NextResponse.json({ success: true, newState: "cancelled" });
    }

    // ── Update appointment date ────────────────────────────────────────────────
    if (action === "update_appointment") {
      const newDate: string | undefined = body.appointment_date;
      if (!newDate) return NextResponse.json({ error: "appointment_date required" }, { status: 400 });

      await supabase.from("bookings").update({ appointment_date: newDate }).eq("id", id);

      if (googleEventId && booking.state === "confirmed") {
        try {
          const { data: artist } = await supabase
            .from("artists")
            .select("google_refresh_token, calendar_sync_enabled, name")
            .eq("id", user.id)
            .single();
          if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
            const accessToken = await refreshGoogleAccessToken(artist.google_refresh_token);
            const endDate = new Date(new Date(newDate).getTime() + 1000 * 60 * 60 * 2).toISOString();
            await updateGoogleCalendarEvent({
              accessToken,
              eventId: googleEventId,
              summary: `${booking.client_name} appointment`,
              description: booking.description ?? undefined,
              startDateTime: newDate,
              endDateTime: endDate,
            });
          }
        } catch (e) {
          console.error("Calendar event update failed:", e);
        }
      }

      return NextResponse.json({ success: true, appointment_date: newDate });
    }

    // ── Advance state ─────────────────────────────────────────────────────────
    const currentState = booking.state as BookingState;
    const nextState = STATE_FLOW[currentState];
    if (!nextState) {
      return NextResponse.json({ error: "Booking is already at a terminal state" }, { status: 400 });
    }

    let paymentLinkToSend: string | undefined;
    let artistName = "FlashBook Artist";

    const [{ data: artist }, { data: templateRow }] = await Promise.all([
      supabase
        .from("artists")
        .select("name, payment_links, calendar_sync_enabled, google_refresh_token")
        .eq("id", booking.artist_id)
        .single(),
      supabase
        .from("email_templates")
        .select("*")
        .eq("artist_id", booking.artist_id)
        .eq("state", nextState)
        .maybeSingle(),
    ]);

    // gmail_connected / gmail_address added by migration — fetch separately
    let gmailConnected = false;
    let gmailAddress: string | null = null;
    try {
      const { data: gmailRow } = await supabase
        .from("artists")
        .select("gmail_connected, gmail_address")
        .eq("id", booking.artist_id)
        .single();
      const row = gmailRow as { gmail_connected?: boolean; gmail_address?: string } | null;
      gmailConnected = row?.gmail_connected ?? false;
      gmailAddress = row?.gmail_address ?? null;
    } catch { /* column may not exist yet */ }

    if (artist?.name) artistName = artist.name;

    if (nextState === "deposit_sent") {
      const paymentLinks = (artist?.payment_links ?? {}) as Record<string, string>;
      paymentLinkToSend = Object.values(paymentLinks).find((l) => typeof l === "string" && l.length > 0);

      const { error: updateErr } = await supabase
        .from("bookings")
        .update({ state: nextState, payment_link_sent: paymentLinkToSend ?? null })
        .eq("id", id)
        .eq("artist_id", user.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: updateErr } = await supabase
        .from("bookings")
        .update({ state: nextState })
        .eq("id", id)
        .eq("artist_id", user.id);
      if (updateErr) throw updateErr;

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
          await supabase
            .from("bookings")
            .update({ google_event_id: googleEventId })
            .eq("id", id)
            .eq("artist_id", user.id);
        } catch (e) {
          console.error("Google Calendar sync on confirm failed:", e);
        }
      }
    }

    const shouldSendEmail = !templateRow || templateRow.auto_send;
    if (shouldSendEmail) {
      try {
        const { sendStateTransitionEmail } = await import('@/lib/email');
        const gmailContext =
          gmailConnected && artist?.google_refresh_token && gmailAddress
            ? { refreshToken: artist.google_refresh_token, gmailAddress }
            : null;

        const { normalizePaymentLinks } = await import('@/lib/pipeline-settings');
        const paymentLinksList = normalizePaymentLinks(artist?.payment_links);
        const { threadId } = await sendStateTransitionEmail({
          toEmail: booking.client_email,
          clientName: booking.client_name,
          newState: nextState,
          artistName,
          paymentLinksList,
          calendarLinksList: [],
          primaryPaymentLink: paymentLinkToSend,
          appointmentDate: booking.appointment_date ?? undefined,
          template: templateRow ?? null,
          gmailContext,
          existingThreadId: gmailThreadId,
        });

        await supabase
          .from("bookings")
          .update({
            last_email_sent_at: new Date().toISOString(),
            ...(threadId ? { gmail_thread_id: threadId } : {}),
          })
          .eq("id", id);
      } catch (e) {
        console.error("Email transition failed:", e);
      }
    }

    return NextResponse.json({ success: true, newState: nextState }, { status: 200 });

  } catch (error: unknown) {
    console.error("Booking PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
