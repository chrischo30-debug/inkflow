import { NextResponse } from "next/server";
import { BookingState } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  refreshGoogleAccessToken,
} from "@/lib/google-calendar";

const STATE_FLOW: Partial<Record<BookingState, BookingState>> = {
  inquiry:   "accepted",
  follow_up: "accepted",
  accepted:  "confirmed",
  confirmed: "completed",
};

const VALID_STATES: BookingState[] = [
  "inquiry", "follow_up", "accepted", "confirmed", "completed", "rejected", "cancelled",
];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const action: string = body.action;

    if (!["advance", "cancel", "update_appointment", "confirm_appointment", "move", "complete", "edit_details", "mark_deposit_paid"].includes(action)) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    if (action === "mark_deposit_paid") {
      await supabase.from("bookings").update({ deposit_paid: true }).eq("id", id).eq("artist_id", user.id);
      return NextResponse.json({ success: true });
    }

    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("state, client_email, client_name, artist_id, appointment_date, description")
      .eq("id", id)
      .eq("artist_id", user.id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Fetch optional columns that may not exist in older DB instances
    const getExtraBookingFields = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("google_event_id, gmail_thread_id, sent_emails")
        .eq("id", id)
        .single();
      const row = data as { google_event_id?: string; gmail_thread_id?: string; sent_emails?: {label:string;sent_at:string}[] } | null;
      return {
        googleEventId: row?.google_event_id ?? null,
        gmailThreadId: row?.gmail_thread_id ?? null,
        sentEmails: (row?.sent_emails ?? []) as {label:string;sent_at:string}[],
      };
    };

    // Append a sent email entry — separate update so it degrades gracefully if column not yet migrated
    const appendSentEmail = async (label: string) => {
      try {
        const { data } = await supabase.from("bookings").select("sent_emails").eq("id", id).single();
        const row = data as { sent_emails?: {label:string;sent_at:string}[] } | null;
        const existing = row?.sent_emails ?? [];
        await supabase.from("bookings")
          .update({ sent_emails: [...existing, { label, sent_at: new Date().toISOString() }] })
          .eq("id", id).eq("artist_id", user.id);
      } catch { /* column may not exist yet */ }
    };

    // ── Edit details ──────────────────────────────────────────────────────────
    if (action === "edit_details") {
      const updates: Record<string, unknown> = {};
      if (body.description != null) updates.description = body.description;
      if (body.size !== undefined) updates.size = body.size || null;
      if (body.placement !== undefined) updates.placement = body.placement || null;
      if (body.total_amount !== undefined) updates.total_amount = body.total_amount != null && body.total_amount !== "" ? Number(body.total_amount) : null;
      if (body.tip_amount !== undefined) updates.tip_amount = body.tip_amount != null && body.tip_amount !== "" ? Number(body.tip_amount) : null;
      if (body.completion_notes !== undefined) updates.completion_notes = body.completion_notes || null;
      if (body.appointment_date !== undefined) updates.appointment_date = body.appointment_date || null;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }
      const { error: updateErr } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", id)
        .eq("artist_id", user.id);
      if (updateErr) return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── Move to any state ──────────────────────────────────────────────────────
    if (action === "move") {
      const targetState = body.target_state as BookingState;
      if (!VALID_STATES.includes(targetState)) {
        return NextResponse.json({ error: "Invalid target_state" }, { status: 400 });
      }
      const { error: updateErr } = await supabase
        .from("bookings")
        .update({ state: targetState, has_unread_reply: false })
        .eq("id", id)
        .eq("artist_id", user.id);
      if (updateErr) return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });

      if (targetState === "cancelled") {
        try {
          const { googleEventId } = await getExtraBookingFields();
          if (googleEventId) {
            const { data: artist } = await supabase.from("artists").select("google_refresh_token, calendar_sync_enabled").eq("id", user.id).single();
            if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
              const accessToken = await refreshGoogleAccessToken(artist.google_refresh_token);
              await deleteGoogleCalendarEvent({ accessToken, eventId: googleEventId });
            }
          }
        } catch (e) { console.error("Calendar delete on move-to-cancelled failed:", e); }
      }

      return NextResponse.json({ success: true, newState: targetState });
    }

    // ── Cancel ─────────────────────────────────────────────────────────────────
    if (action === "cancel") {
      await supabase.from("bookings").update({ state: "cancelled" }).eq("id", id);

      try {
        const { googleEventId } = await getExtraBookingFields();
        if (googleEventId) {
          const { data: artist } = await supabase.from("artists").select("google_refresh_token, calendar_sync_enabled").eq("id", user.id).single();
          if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
            const accessToken = await refreshGoogleAccessToken(artist.google_refresh_token);
            await deleteGoogleCalendarEvent({ accessToken, eventId: googleEventId });
          }
        }
      } catch (e) { console.error("Calendar event deletion failed:", e); }

      return NextResponse.json({ success: true, newState: "cancelled" });
    }

    // ── Update appointment date ────────────────────────────────────────────────
    if (action === "update_appointment") {
      const newDate: string | undefined = body.appointment_date;
      if (!newDate) return NextResponse.json({ error: "appointment_date required" }, { status: 400 });
      const durationMinutes: number = body.duration_minutes ?? 120;

      await supabase.from("bookings").update({ appointment_date: newDate }).eq("id", id);

      if (booking.state === "confirmed") {
        try {
          const { googleEventId } = await getExtraBookingFields();
          const { data: artist } = await supabase.from("artists").select("google_refresh_token, calendar_sync_enabled, name").eq("id", user.id).single();
          if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
            const accessToken = await refreshGoogleAccessToken(artist.google_refresh_token);
            const endDate = new Date(new Date(newDate).getTime() + durationMinutes * 60 * 1000).toISOString();
            if (googleEventId) {
              await updateGoogleCalendarEvent({
                accessToken,
                eventId: googleEventId,
                summary: `${booking.client_name} appointment`,
                description: booking.description ?? undefined,
                startDateTime: newDate,
                endDateTime: endDate,
              });
            } else {
              // No existing event — create one
              const newEventId = await createGoogleCalendarEvent({
                accessToken,
                summary: `${booking.client_name} appointment`,
                description: booking.description ?? undefined,
                startDateTime: newDate,
                endDateTime: endDate,
              });
              if (newEventId) {
                await supabase.from("bookings").update({ google_event_id: newEventId }).eq("id", id).eq("artist_id", user.id);
              }
            }
          }
        } catch (e) { console.error("Calendar event update failed:", e); }
      }

      return NextResponse.json({ success: true, appointment_date: newDate });
    }

    // ── Confirm appointment (accepted → confirmed) ─────────────────────────────
    if (action === "confirm_appointment") {
      const appointmentDate: string | undefined = body.appointment_date;
      if (!appointmentDate) return NextResponse.json({ error: "appointment_date required" }, { status: 400 });
      const durationMinutes: number = body.duration_minutes ?? 120;

      const updateFields: Record<string, unknown> = { state: "confirmed", appointment_date: appointmentDate };
      await supabase.from("bookings").update(updateFields).eq("id", id).eq("artist_id", user.id);

      // Google Calendar event creation
      let newEventId: string | null = null;
      try {
        const { data: artist } = await supabase
          .from("artists")
          .select("name, google_refresh_token, calendar_sync_enabled")
          .eq("id", user.id)
          .single();
        if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
          const accessToken = await refreshGoogleAccessToken(artist.google_refresh_token);
          const endDate = new Date(new Date(appointmentDate).getTime() + durationMinutes * 60 * 1000).toISOString();
          newEventId = await createGoogleCalendarEvent({
            accessToken,
            summary: `${booking.client_name} appointment`,
            description: booking.description ?? undefined,
            startDateTime: appointmentDate,
            endDateTime: endDate,
          });
          if (newEventId) {
            await supabase.from("bookings").update({ google_event_id: newEventId }).eq("id", id).eq("artist_id", user.id);
          }
        }
      } catch (e) { console.error("Google Calendar sync on confirm failed:", e); }

      return NextResponse.json({ success: true, newState: "confirmed", google_event_id: newEventId });
    }

    // ── Complete ───────────────────────────────────────────────────────────────
    if (action === "complete") {
      const updateFields: Record<string, unknown> = { state: "completed", has_unread_reply: false };
      if (body.total_amount != null) updateFields.total_amount = body.total_amount;
      if (body.tip_amount != null) updateFields.tip_amount = body.tip_amount;
      if (body.completion_notes != null) updateFields.completion_notes = body.completion_notes;

      await supabase.from("bookings").update(updateFields).eq("id", id).eq("artist_id", user.id);

      const [{ data: artist }, { data: templateRow }] = await Promise.all([
        supabase.from("artists").select("name, payment_links, calendar_sync_enabled, gmail_address, email").eq("id", booking.artist_id).single(),
        supabase.from("email_templates").select("*").eq("artist_id", booking.artist_id).eq("state", "completed").maybeSingle(),
      ]);

      if (!templateRow || templateRow.auto_send) {
        try {
          const { sendStateTransitionEmail } = await import("@/lib/email");
          const { normalizePaymentLinks } = await import("@/lib/pipeline-settings");
          const { subject: sentSubject } = await sendStateTransitionEmail({
            toEmail: booking.client_email,
            clientName: booking.client_name,
            newState: "completed",
            artistName: artist?.name ?? "Your Artist",
            paymentLinksList: normalizePaymentLinks(artist?.payment_links),
            calendarLinksList: [],
            template: templateRow ?? null,
            artistReplyTo: artist?.gmail_address ?? artist?.email ?? null,
          });
          await supabase.from("bookings").update({
            last_email_sent_at: new Date().toISOString(),
          }).eq("id", id);
          await appendSentEmail(sentSubject ?? "Appointment Completed");
        } catch (e) { console.error("Completion email failed:", e); }
      }

      return NextResponse.json({ success: true, newState: "completed" });
    }

    // ── Advance state ──────────────────────────────────────────────────────────
    const currentState = booking.state as BookingState;
    const nextState = STATE_FLOW[currentState];
    if (!nextState) {
      return NextResponse.json({ error: "Booking is already at a terminal state" }, { status: 400 });
    }

    const [{ data: artist }, { data: templateRow }] = await Promise.all([
      supabase.from("artists").select("name, payment_links, calendar_sync_enabled, gmail_address, email").eq("id", booking.artist_id).single(),
      supabase.from("email_templates").select("*").eq("artist_id", booking.artist_id).eq("state", nextState).maybeSingle(),
    ]);

    await supabase.from("bookings").update({ state: nextState, has_unread_reply: false }).eq("id", id).eq("artist_id", user.id);

    const SENT_EMAIL_LABELS: Partial<Record<string, string>> = {
      inquiry:   "Submission Received",
      follow_up: "Follow Up",
      accepted:  "Submission Accepted",
      confirmed: "Booking Confirmation",
      completed: "Appointment Completed",
      rejected:  "Submission Rejected",
    };

    const shouldAutoEmail = !templateRow || templateRow.auto_send;
    if (shouldAutoEmail) {
      try {
        const { sendStateTransitionEmail } = await import("@/lib/email");
        const { normalizePaymentLinks } = await import("@/lib/pipeline-settings");
        const { subject: sentSubject } = await sendStateTransitionEmail({
          toEmail: booking.client_email,
          clientName: booking.client_name,
          newState: nextState,
          artistName: artist?.name ?? "Your Artist",
          paymentLinksList: normalizePaymentLinks(artist?.payment_links),
          calendarLinksList: [],
          template: templateRow ?? null,
          artistReplyTo: artist?.gmail_address ?? artist?.email ?? null,
        });
        await supabase.from("bookings").update({
          last_email_sent_at: new Date().toISOString(),
        }).eq("id", id);
        await appendSentEmail(sentSubject ?? SENT_EMAIL_LABELS[nextState] ?? nextState);
      } catch (e) { console.error("Email transition failed:", e); }
    }

    return NextResponse.json({ success: true, newState: nextState });

  } catch (error: unknown) {
    console.error("Booking PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", id)
      .eq("artist_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Booking DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
