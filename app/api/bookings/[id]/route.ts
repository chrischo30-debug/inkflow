import { NextResponse } from "next/server";
import { BookingState } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  getGoogleAccessToken,
} from "@/lib/google-calendar";

const STATE_FLOW: Partial<Record<BookingState, BookingState>> = {
  inquiry:       "sent_deposit",
  follow_up:     "sent_deposit",
  accepted:      "sent_deposit", // legacy — treat as sent_deposit
  sent_deposit:  "sent_calendar",
  sent_calendar: "booked",
  booked:        "completed",
  confirmed:     "completed", // legacy
};

const VALID_STATES: BookingState[] = [
  "inquiry", "follow_up", "accepted", "sent_deposit", "sent_calendar",
  "booked", "confirmed", "completed", "rejected", "cancelled",
];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const action: string = body.action;

    if (!["advance", "cancel", "update_appointment", "confirm_appointment", "move", "complete", "complete_session", "edit_details", "mark_deposit_paid", "unmark_deposit_paid"].includes(action)) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    if (action === "mark_deposit_paid") {
      await supabase.from("bookings").update({ deposit_paid: true }).eq("id", id).eq("artist_id", user.id);
      return NextResponse.json({ success: true });
    }

    if (action === "unmark_deposit_paid") {
      await supabase.from("bookings").update({ deposit_paid: false }).eq("id", id).eq("artist_id", user.id);
      return NextResponse.json({ success: true });
    }

    // Mark a single session of a multi-session booking complete. Bumps
    // completed_session_count by 1 and stamps the per-session entry with any
    // totals / tip / payment source / notes the artist supplied. When the
    // count reaches session_count, the booking moves to "completed".
    if (action === "complete_session") {
      const { data: row } = await supabase
        .from("bookings")
        .select("session_count, completed_session_count, session_appointments")
        .eq("id", id)
        .eq("artist_id", user.id)
        .single();
      if (!row) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      type Row = { session_count?: number | null; completed_session_count?: number | null; session_appointments?: unknown };
      const r = row as Row;
      const sessionCount = r.session_count ?? 1;
      const currentDone = r.completed_session_count ?? 0;
      if (currentDone >= sessionCount) {
        return NextResponse.json({ error: "All sessions already complete" }, { status: 400 });
      }
      const idx = currentDone; // mark the next session done (zero-indexed)
      const apps = Array.isArray(r.session_appointments) ? [...(r.session_appointments as Record<string, unknown>[])] : [];
      while (apps.length <= idx) apps.push({});
      const totalAmount = body.total_amount != null && body.total_amount !== "" ? Number(body.total_amount) : null;
      const tipAmount = body.tip_amount != null && body.tip_amount !== "" ? Number(body.tip_amount) : null;
      const paymentSource = typeof body.payment_source === "string" && body.payment_source.trim() ? body.payment_source.trim() : null;
      const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
      apps[idx] = {
        ...(apps[idx] ?? {}),
        completed_at: new Date().toISOString(),
        ...(totalAmount != null ? { total_amount: totalAmount } : {}),
        ...(tipAmount != null ? { tip_amount: tipAmount } : {}),
        ...(paymentSource ? { payment_source: paymentSource } : {}),
        ...(notes ? { notes } : {}),
      };
      const nextDone = currentDone + 1;
      const updates: Record<string, unknown> = {
        completed_session_count: nextDone,
        session_appointments: apps,
      };
      if (nextDone >= sessionCount) updates.state = "completed";
      const { error: updErr } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", id)
        .eq("artist_id", user.id);
      if (updErr) return NextResponse.json({ error: "Failed to complete session" }, { status: 500 });
      return NextResponse.json({ success: true, completed_session_count: nextDone, allDone: nextDone >= sessionCount });
    }

    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("state, client_email, client_name, artist_id, appointment_date, description, thread_message_id, google_event_id, gmail_thread_id, sent_emails, scheduling_link_id")
      .eq("id", id)
      .eq("artist_id", user.id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const bookingExt = booking as {
      thread_message_id?: string | null;
      google_event_id?: string | null;
      gmail_thread_id?: string | null;
      sent_emails?: { label: string; sent_at: string }[];
    };
    const threadMessageId = bookingExt.thread_message_id ?? undefined;

    // Read the already-fetched row instead of re-querying — was running 3×
    // per PATCH (P1-1).
    const getExtraBookingFields = async () => ({
      googleEventId: bookingExt.google_event_id ?? null,
      gmailThreadId: bookingExt.gmail_thread_id ?? null,
      sentEmails: (bookingExt.sent_emails ?? []) as { label: string; sent_at: string }[],
    });

    // Store thread_message_id on the booking if this is the first threaded email we've sent
    const storeThreadRoot = async (messageId: string | undefined) => {
      if (!messageId || threadMessageId) return;
      try {
        await supabase.from("bookings").update({ thread_message_id: messageId }).eq("id", id).eq("artist_id", user.id);
      } catch { /* column may not exist yet */ }
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
      if (body.scheduling_link_id !== undefined) updates.scheduling_link_id = body.scheduling_link_id || null;
      if (body.session_count !== undefined) updates.session_count = Number(body.session_count) || 1;
      if (body.session_durations !== undefined) updates.session_durations = Array.isArray(body.session_durations) ? body.session_durations : null;

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
      // Guardrail: a booking in "booked" / "confirmed" must have an
      // appointment_date. Reject the move so the caller knows to set one
      // (UI typically pops the ConfirmAppointmentModal in this case).
      if ((targetState === "booked" || targetState === "confirmed") && !booking.appointment_date) {
        return NextResponse.json({ error: "Booked appointments require a date — set one first." }, { status: 400 });
      }
      const moveFields: Record<string, unknown> = { state: targetState, has_unread_reply: false };
      if (body.scheduling_link_id) moveFields.scheduling_link_id = body.scheduling_link_id;
      const { error: updateErr } = await supabase
        .from("bookings")
        .update(moveFields)
        .eq("id", id)
        .eq("artist_id", user.id);
      if (updateErr) return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });

      if (targetState === "cancelled") {
        try {
          const { googleEventId } = await getExtraBookingFields();
          if (googleEventId) {
            const { data: artist } = await supabase.from("artists").select("google_refresh_token, calendar_sync_enabled").eq("id", user.id).single();
            if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
              const accessToken = await getGoogleAccessToken(supabase, user.id, artist.google_refresh_token);
              if (accessToken) await deleteGoogleCalendarEvent({ accessToken, eventId: googleEventId });
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
            const accessToken = await getGoogleAccessToken(supabase, user.id, artist.google_refresh_token);
            if (accessToken) await deleteGoogleCalendarEvent({ accessToken, eventId: googleEventId });
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

      const oldDate = booking.appointment_date;
      const dateChanged = oldDate && new Date(oldDate).getTime() !== new Date(newDate).getTime();
      const isBookedState = booking.state === "booked" || booking.state === "confirmed";

      if (isBookedState) {
        try {
          const { googleEventId } = await getExtraBookingFields();
          const { data: artist } = await supabase.from("artists").select("google_refresh_token, calendar_sync_enabled, name").eq("id", user.id).single();
          if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
            const accessToken = await getGoogleAccessToken(supabase, user.id, artist.google_refresh_token);
            if (accessToken) {
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
                const calResult = await createGoogleCalendarEvent({
                  accessToken,
                  summary: `${booking.client_name} appointment`,
                  description: booking.description ?? undefined,
                  startDateTime: newDate,
                  endDateTime: endDate,
                });
                if (calResult.id) {
                  await supabase.from("bookings").update({ google_event_id: calResult.id }).eq("id", id).eq("artist_id", user.id);
                }
              }
            }
          }
        } catch (e) { console.error("Calendar event update failed:", e); }
      }

      // Reschedule email — only when an existing booked/confirmed appointment moves
      // to a different time. First-time date sets go through confirm_appointment,
      // which has its own client confirmation path.
      if (isBookedState && dateChanged && booking.client_email) {
        try {
          const { data: artist } = await supabase
            .from("artists")
            .select("name, gmail_address, email, studio_name, studio_address, logo_url, email_logo_enabled, email_logo_bg, auto_emails_enabled, scheduling_links, notify_reschedule")
            .eq("id", user.id)
            .single();
          if (artist && (artist as { auto_emails_enabled?: boolean | null }).auto_emails_enabled !== false) {
            const { sendEmail, buildTemplateVars } = await import("@/lib/email");
            const studioAddress = (artist as { studio_address?: string | null }).studio_address ?? null;
            const mapsUrl = studioAddress
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(studioAddress)}`
              : null;
            const artistName = artist.name || "Your artist";
            const venueLine = (artist as { studio_name?: string | null }).studio_name || artistName;
            const replyTo = (artist as { gmail_address?: string | null }).gmail_address || (artist as { email?: string | null }).email || null;

            // Format dates in the artist's scheduling-link timezone, not the
            // server's UTC default — otherwise the email shows times shifted
            // by the server-vs-artist offset.
            const bookingSchedulingLinkId = (booking as { scheduling_link_id?: string | null }).scheduling_link_id;
            type SLink = { id: string; timezone?: string };
            const allLinks = ((artist as { scheduling_links?: unknown }).scheduling_links ?? []) as SLink[];
            const matchedLink = bookingSchedulingLinkId
              ? allLinks.find(l => l.id === bookingSchedulingLinkId)
              : allLinks[0];
            const tz = matchedLink?.timezone || "America/New_York";

            const fmtDateTime = (iso: string) => {
              const d = new Date(iso);
              return `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}`;
            };

            const bodyLines = [
              `Hi ${booking.client_name.split(" ")[0]},`,
              ``,
              `Your appointment with ${artistName} has been moved.`,
              ``,
              `New time: ${fmtDateTime(newDate)}`,
            ];
            if (oldDate) bodyLines.push(`Was: ${fmtDateTime(oldDate)}`);
            if (studioAddress && mapsUrl) {
              bodyLines.push(``, `Where: ${venueLine}`, studioAddress, mapsUrl);
            }
            bodyLines.push(``, `Reply to this email if the new time doesn't work.`, ``, artistName);

            const sendDateLabel = new Date(newDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: tz });
            const { subject: sentSubject, messageId: reschedMsgId } = await sendEmail({
              toEmail: booking.client_email,
              vars: buildTemplateVars({
                clientName: booking.client_name,
                artistName,
                paymentLinksList: [],
                calendarLinksList: [],
              }),
              template: {
                subject: `Appointment rescheduled – ${sendDateLabel}`,
                body: bodyLines.join("\n"),
              },
              artistReplyTo: replyTo,
              branding: {
                logoUrl: (artist as { logo_url?: string | null }).logo_url ?? null,
                logoEnabled: (artist as { email_logo_enabled?: boolean | null }).email_logo_enabled !== false,
                logoBg: ((artist as { email_logo_bg?: "light" | "dark" | null }).email_logo_bg ?? "light") as "light" | "dark",
              },
              threadMessageId,
            });
            await supabase
              .from("bookings")
              .update({ last_email_sent_at: new Date().toISOString() })
              .eq("id", id);
            await appendSentEmail(sentSubject ?? "Appointment rescheduled");
            await storeThreadRoot(reschedMsgId);

            // Notify the artist too — gated on the per-artist preference.
            try {
              const artistEmail = (artist as { email?: string | null }).email;
              const notifyReschedule = (artist as { notify_reschedule?: boolean | null }).notify_reschedule !== false;
              if (artistEmail && notifyReschedule) {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `https://${process.env.FLASHBOOKER_SENDING_DOMAIN || "flashbooker.app"}`;
                const bookingUrl = `${appUrl}/bookings?expand=${id}`;
                const fmtDt = (iso: string) => {
                  const d = new Date(iso);
                  return `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}`;
                };
                const { Resend } = await import("resend");
                const r = new Resend(process.env.RESEND_API_KEY || "re_mock_key");
                const sendingDomain = process.env.FLASHBOOKER_SENDING_DOMAIN || "flashbooker.app";
                await r.emails.send({
                  from: `FlashBooker <noreply@${sendingDomain}>`,
                  to: [artistEmail],
                  subject: `Appointment rescheduled: ${booking.client_name}`,
                  html: `<div style="font-family:sans-serif;font-size:14px;color:#111;padding:24px">
<p style="margin:0 0 16px"><strong>${booking.client_name}</strong>'s appointment has been moved.</p>
<table style="border-collapse:collapse;margin-bottom:16px">
<tr><td style="padding:3px 16px 3px 0;font-weight:600;white-space:nowrap">New time</td><td>${fmtDt(newDate)}</td></tr>
${oldDate ? `<tr><td style="padding:3px 16px 3px 0;font-weight:600;white-space:nowrap;color:#888">Was</td><td style="color:#888">${fmtDt(oldDate)}</td></tr>` : ""}
</table>
<a href="${bookingUrl}" style="color:#4f46e5">View booking →</a>
</div>`,
                });
              }
            } catch (e) { console.error("Reschedule artist notification failed:", e); }
          }
        } catch (e) { console.error("Reschedule email failed:", e); }
      }

      return NextResponse.json({ success: true, appointment_date: newDate });
    }

    // ── Confirm appointment (accepted → confirmed) ─────────────────────────────
    if (action === "confirm_appointment") {
      const appointmentDate: string | undefined = body.appointment_date;
      if (!appointmentDate) return NextResponse.json({ error: "appointment_date required" }, { status: 400 });
      const durationMinutes: number = body.duration_minutes ?? 120;

      const updateFields: Record<string, unknown> = { state: "booked", appointment_date: appointmentDate };
      await supabase.from("bookings").update(updateFields).eq("id", id).eq("artist_id", user.id);

      // Google Calendar event creation
      let newEventId: string | null = null;
      let calHtmlLink: string | null = null;
      try {
        const { data: artist } = await supabase
          .from("artists")
          .select("name, google_refresh_token, calendar_sync_enabled")
          .eq("id", user.id)
          .single();
        if (artist?.calendar_sync_enabled && artist.google_refresh_token) {
          const accessToken = await getGoogleAccessToken(supabase, user.id, artist.google_refresh_token);
          if (accessToken) {
            const endDate = new Date(new Date(appointmentDate).getTime() + durationMinutes * 60 * 1000).toISOString();
            const calResult = await createGoogleCalendarEvent({
              accessToken,
              summary: `${booking.client_name} appointment`,
              description: booking.description ?? undefined,
              startDateTime: appointmentDate,
              endDateTime: endDate,
            });
            newEventId = calResult.id;
            calHtmlLink = calResult.htmlLink;
            if (newEventId) {
              await supabase.from("bookings").update({ google_event_id: newEventId }).eq("id", id).eq("artist_id", user.id);
            }
          }
        }
      } catch (e) { console.error("Google Calendar sync on confirm failed:", e); }

      return NextResponse.json({ success: true, newState: "booked", google_event_id: newEventId, google_event_link: calHtmlLink });
    }

    // ── Complete ───────────────────────────────────────────────────────────────
    if (action === "complete") {
      const updateFields: Record<string, unknown> = { state: "completed", has_unread_reply: false };
      if (body.total_amount != null) updateFields.total_amount = body.total_amount;
      if (body.tip_amount != null) updateFields.tip_amount = body.tip_amount;
      if (body.payment_source != null) updateFields.payment_source = body.payment_source;
      if (body.completion_notes != null) updateFields.completion_notes = body.completion_notes;

      await supabase.from("bookings").update(updateFields).eq("id", id).eq("artist_id", user.id);

      const [{ data: artist }, { data: templateRow }] = await Promise.all([
        supabase.from("artists").select("name, payment_links, calendar_sync_enabled, gmail_address, email, logo_url, email_logo_enabled, email_logo_bg, auto_emails_enabled, studio_address").eq("id", booking.artist_id).single(),
        supabase.from("email_templates").select("*").eq("artist_id", booking.artist_id).eq("state", "completed").maybeSingle(),
      ]);

      const masterAutoOn = (artist as { auto_emails_enabled?: boolean | null } | null)?.auto_emails_enabled !== false;
      const { STAGE_AUTOSEND_DEFAULTS: COMPLETE_DEFAULTS } = await import("@/lib/email");
      const completeStageDefault = COMPLETE_DEFAULTS.completed ?? false;
      const completeEnabled = templateRow ? (templateRow as { enabled?: boolean | null }).enabled !== false : true;
      if (masterAutoOn && completeEnabled && (templateRow ? templateRow.auto_send : completeStageDefault)) {
        try {
          const { sendStateTransitionEmail } = await import("@/lib/email");
          const { normalizePaymentLinks } = await import("@/lib/pipeline-settings");
          const { subject: sentSubject, messageId: completeMsgId } = await sendStateTransitionEmail({
            toEmail: booking.client_email,
            clientName: booking.client_name,
            newState: "completed",
            artistName: artist?.name ?? "Your Artist",
            paymentLinksList: normalizePaymentLinks(artist?.payment_links),
            calendarLinksList: [],
            template: templateRow ?? null,
            artistReplyTo: artist?.gmail_address ?? artist?.email ?? null,
            branding: { logoUrl: (artist as { logo_url?: string | null } | null)?.logo_url ?? null, logoEnabled: (artist as { email_logo_enabled?: boolean | null } | null)?.email_logo_enabled !== false, logoBg: ((artist as { email_logo_bg?: "light" | "dark" | null } | null)?.email_logo_bg ?? "light") as "light" | "dark" },
            threadMessageId,
          });
          await supabase.from("bookings").update({
            last_email_sent_at: new Date().toISOString(),
          }).eq("id", id);
          await appendSentEmail(sentSubject ?? "Appointment Completed");
          await storeThreadRoot(completeMsgId);
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
      supabase.from("artists").select("name, payment_links, calendar_sync_enabled, gmail_address, email, logo_url, email_logo_enabled, email_logo_bg, auto_emails_enabled, studio_address").eq("id", booking.artist_id).single(),
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

    const masterAutoOn = (artist as { auto_emails_enabled?: boolean | null } | null)?.auto_emails_enabled !== false;
    const { STAGE_AUTOSEND_DEFAULTS } = await import("@/lib/email");
    const stageDefault = STAGE_AUTOSEND_DEFAULTS[nextState as keyof typeof STAGE_AUTOSEND_DEFAULTS] ?? false;
    const advanceEnabled = templateRow ? (templateRow as { enabled?: boolean | null }).enabled !== false : true;
    const shouldAutoEmail = masterAutoOn && advanceEnabled && (templateRow ? templateRow.auto_send : stageDefault);
    if (shouldAutoEmail) {
      try {
        const { sendStateTransitionEmail, THREADING_STATES } = await import("@/lib/email");
        const { normalizePaymentLinks } = await import("@/lib/pipeline-settings");
        const { subject: sentSubject, messageId: advanceMsgId } = await sendStateTransitionEmail({
          toEmail: booking.client_email,
          clientName: booking.client_name,
          newState: nextState,
          artistName: artist?.name ?? "Your Artist",
          paymentLinksList: normalizePaymentLinks(artist?.payment_links),
          calendarLinksList: [],
          studioAddress: (artist as { studio_address?: string | null } | null)?.studio_address ?? undefined,
          template: templateRow ?? null,
          artistReplyTo: artist?.gmail_address ?? artist?.email ?? null,
          branding: { logoUrl: (artist as { logo_url?: string | null } | null)?.logo_url ?? null, logoEnabled: (artist as { email_logo_enabled?: boolean | null } | null)?.email_logo_enabled !== false, logoBg: ((artist as { email_logo_bg?: "light" | "dark" | null } | null)?.email_logo_bg ?? "light") as "light" | "dark" },
          threadMessageId: THREADING_STATES.has(nextState) ? threadMessageId : undefined,
        });
        await supabase.from("bookings").update({
          last_email_sent_at: new Date().toISOString(),
        }).eq("id", id);
        await appendSentEmail(sentSubject ?? SENT_EMAIL_LABELS[nextState] ?? nextState);
        if (THREADING_STATES.has(nextState)) await storeThreadRoot(advanceMsgId);
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
