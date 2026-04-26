"use client";

import { Booking, BookingState } from "@/lib/types";
import { BookingCard } from "./BookingCard";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { PIPELINE_COLUMNS, COLUMN_LABELS } from "@/lib/pipeline-settings";
import type { SchedulingLink } from "@/lib/pipeline-settings";
import { EmailComposeModal, type ResolvedTemplate, type InsertLink } from "./EmailComposeModal";
import { AcceptModal } from "./AcceptModal";
import { ConfirmAppointmentModal } from "./ConfirmAppointmentModal";
import { SendDepositModal } from "./SendDepositModal";
import { CoachmarkSequence, useCoachmarks } from "@/components/coachmarks/Coachmark";
import { SendCalendarModal } from "./SendCalendarModal";

interface PipelineViewProps {
  initialBookings: Booking[];
  fieldLabelMap?: Record<string, string>;
  calendarSyncEnabled?: boolean;
  hasStripe?: boolean;
  artistId?: string;
  schedulingLinks?: SchedulingLink[];
}

type EmailCompose = {
  bookingId: string;
  subject: string;
  body: string;
  templates: ResolvedTemplate[];
  defaultTemplateState?: string | null;
  afterSendState?: BookingState;
  paymentLinks?: InsertLink[];
  calendarLinks?: InsertLink[];
  schedulingLinks?: { id: string; label: string }[];
  previewVars?: Record<string, string>;
};

type CompletionModal = { bookingId: string };

const PAYMENT_SOURCES = ["Cash", "Venmo", "PayPal", "Zelle", "Stripe", "Other"];

export function PipelineView({
  initialBookings, fieldLabelMap = {}, calendarSyncEnabled = false,
  hasStripe = false, artistId, schedulingLinks = [],
}: PipelineViewProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<BookingState | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'above' | 'below'>('below');
  const [columnOrder, setColumnOrder] = useState<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {};
    PIPELINE_COLUMNS.forEach(col => {
      const colBookings = col === "booked"
        ? initialBookings.filter(b => b.state === "booked" || b.state === "confirmed")
        : col === "sent_deposit"
          ? initialBookings.filter(b => b.state === "sent_deposit" || b.state === "accepted")
          : initialBookings.filter(b => b.state === col);
      result[col] = colBookings.map(b => b.id);
    });
    return result;
  });
  // Tracks the column the user just dropped a card into, so the first-drag
  // coachmark has something to point at.
  const [firstDropColumn, setFirstDropColumn] = useState<BookingState | null>(null);

  const normalizeCol = (state: BookingState): BookingState =>
    state === "confirmed" ? "booked" : state;

  // Keep columnOrder in sync when bookings change columns. Preserves manual
  // reorder within columns; appends newly arrived bookings at the end.
  useEffect(() => {
    setColumnOrder(prev => {
      const next = { ...prev };
      PIPELINE_COLUMNS.forEach(col => {
        const colIds = new Set(
          (col === "booked"
            ? bookings.filter(b => b.state === "booked" || b.state === "confirmed")
            : col === "sent_deposit"
              ? bookings.filter(b => b.state === "sent_deposit" || b.state === "accepted")
              : bookings.filter(b => b.state === col)
          ).map(b => b.id)
        );
        const existing = (prev[col] ?? []).filter(id => colIds.has(id));
        const added = [...colIds].filter(id => !existing.includes(id));
        next[col] = [...existing, ...added];
      });
      return next;
    });
  }, [bookings]);
  const { hasSeen } = useCoachmarks();

  // Modals
  const [acceptModal, setAcceptModal] = useState<{ bookingId: string } | null>(null);
  const [bookModal, setBookModal] = useState<{ bookingId: string; initialAppointmentDate?: string } | null>(null);
  const [completionModal, setCompletionModal] = useState<CompletionModal | null>(null);
  const [completionData, setCompletionData] = useState({ total_amount: "", tip_amount: "", payment_source: "", notes: "" });
  const [emailCompose, setEmailCompose] = useState<EmailCompose | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [sendDepositModal, setSendDepositModal] = useState<{ bookingId: string } | null>(null);
  const [sendCalendarModal, setSendCalendarModal] = useState<{ bookingId: string } | null>(null);

  const moveTo = async (bookingId: string, targetState: BookingState) => {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", target_state: targetState }),
    });
    if (!res.ok) throw new Error("Failed to update booking status");
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, state: targetState } : b));
  };

  // ── Inquiry phase ──────────────────────────────────────────────────────────
  const handleAcceptInquiry = (bookingId: string) => setAcceptModal({ bookingId });

  const handleAcceptSent = (bookingId: string) => {
    // AcceptModal now collects scheduling link + deposit upfront and moves directly
    // to sent_deposit; the rest is automatic via Stripe webhook + scheduling page.
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, state: "sent_deposit", last_email_sent_at: new Date().toISOString() } : b
    ));
    setAcceptModal(null);
  };

  // ── Send Deposit (accepted → sent_deposit) ─────────────────────────────────
  const handleSendDeposit = (bookingId: string) => setSendDepositModal({ bookingId });

  const handleDepositSent = (bookingId: string, schedulingLinkId?: string) => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? { ...b, state: "sent_deposit", scheduling_link_id: schedulingLinkId, last_email_sent_at: new Date().toISOString() }
        : b
    ));
    setSendDepositModal(null);
  };

  // ── Send Calendar (sent_deposit → sent_calendar) ───────────────────────────
  const handleSendCalendar = (bookingId: string) => setSendCalendarModal({ bookingId });

  const handleCalendarSent = (bookingId: string) => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, state: "sent_calendar", last_email_sent_at: new Date().toISOString() } : b
    ));
    setSendCalendarModal(null);
  };

  // ── Book (sent_calendar → booked) — manual via ConfirmAppointmentModal ─────
  const handleMarkBooked = (bookingId: string) => {
    setBookModal({ bookingId });
  };

  const handleBookingConfirmed = (bookingId: string, appointmentDate: string, googleEventId?: string) => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? { ...b, state: "booked", appointment_date: appointmentDate, ...(googleEventId ? { google_event_id: googleEventId } : {}) }
        : b
    ));
    setBookModal(null);
  };

  // ── Complete (booked → completed) ─────────────────────────────────────────
  const handleAdvanceState = (bookingId: string, currentState: BookingState) => {
    if (currentState === "sent_deposit") { handleSendCalendar(bookingId); return; }
    if (currentState === "sent_calendar") { handleMarkBooked(bookingId); return; }
    if (currentState === "booked" || currentState === "confirmed") {
      setCompletionData({ total_amount: "", tip_amount: "", payment_source: "", notes: "" });
      setCompletionModal({ bookingId });
      return;
    }
  };

  const handleComplete = async () => {
    if (!completionModal) return;
    const { bookingId } = completionModal;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          total_amount: completionData.total_amount ? parseFloat(completionData.total_amount) : null,
          tip_amount: completionData.tip_amount ? parseFloat(completionData.tip_amount) : null,
          payment_source: completionData.payment_source || null,
          completion_notes: completionData.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      setBookings(prev => prev.map(b => b.id === bookingId ? {
        ...b,
        state: "completed",
        total_amount: completionData.total_amount ? parseFloat(completionData.total_amount) : undefined,
        tip_amount: completionData.tip_amount ? parseFloat(completionData.tip_amount) : undefined,
        payment_source: completionData.payment_source || undefined,
        completion_notes: completionData.notes || undefined,
      } : b));
      setCompletionModal(null);
    } catch { alert("Failed to complete booking"); }
  };

  // ── Email compose (ad-hoc) ─────────────────────────────────────────────────
  const openEmailCompose = async (bookingId: string, defaultState?: string) => {
    setEmailLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/send-email`);
      if (!res.ok) return;
      const data = await res.json();
      let subject = data.subject;
      let body = data.body;
      if (defaultState && data.templates) {
        const t = data.templates.find((t: ResolvedTemplate) => t.state === defaultState);
        if (t) { subject = t.subject; body = t.body; }
      }
      setEmailCompose({
        bookingId, subject, body,
        templates: data.templates ?? [],
        defaultTemplateState: defaultState ?? data.defaultTemplateState,
        paymentLinks: data.paymentLinks ?? [],
        calendarLinks: data.calendarLinks ?? [],
        schedulingLinks: data.schedulingLinks ?? [],
        previewVars: data.previewVars,
      });
    } finally { setEmailLoading(false); }
  };

  const handleRejectInquiry = async (bookingId: string) => {
    await openEmailCompose(bookingId, "rejected");
    setEmailCompose(prev => prev ? { ...prev, afterSendState: "rejected" } : null);
  };

  const handleFollowUpInquiry = async (bookingId: string) => {
    await openEmailCompose(bookingId, "follow_up");
    setEmailCompose(prev => prev ? { ...prev, afterSendState: "follow_up" } : null);
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Cancel this booking? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) throw new Error();
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, state: "cancelled" } : b));
    } catch { alert("Failed to cancel booking"); }
  };

  const handleMoveState = async (bookingId: string, targetState: BookingState) => {
    if (targetState === "follow_up") { await handleFollowUpInquiry(bookingId); return; }
    if (targetState === "sent_deposit") { handleSendDeposit(bookingId); return; }
    if (targetState === "sent_calendar") { handleSendCalendar(bookingId); return; }
    try { await moveTo(bookingId, targetState); }
    catch { alert("Failed to update booking status"); }
  };

  const handleDragOverCard = (targetId: string, position: 'above' | 'below') => {
    setDragOverCardId(targetId);
    setDragPosition(position);
  };

  const handleDropOnCard = (targetId: string, position: 'above' | 'below') => {
    setDragOverCardId(null);
    if (!draggingId || draggingId === targetId) { setDraggingId(null); return; }
    const draggedBooking = bookings.find(b => b.id === draggingId);
    const targetBooking = bookings.find(b => b.id === targetId);
    if (!draggedBooking || !targetBooking) { setDraggingId(null); return; }
    const draggedCol = normalizeCol(draggedBooking.state);
    const targetCol = normalizeCol(targetBooking.state);
    if (draggedCol !== targetCol) {
      handleDrop(targetCol);
      return;
    }
    // Build the full ordered list for this column synchronously so we can save it.
    const colBookingIds = (draggedCol === "booked"
      ? bookings.filter(b => b.state === "booked" || b.state === "confirmed")
      : bookings.filter(b => b.state === draggedCol)
    ).map(b => b.id);
    const prev = columnOrder[draggedCol] ?? [];
    const base = [...prev.filter(id => colBookingIds.includes(id)), ...colBookingIds.filter(id => !prev.includes(id))];
    const from = base.indexOf(draggingId!);
    if (from !== -1) base.splice(from, 1);
    const to = base.indexOf(targetId);
    base.splice(to === -1 ? base.length : position === 'above' ? to : to + 1, 0, draggingId!);
    setColumnOrder(prev => ({ ...prev, [draggedCol]: base }));
    setDraggingId(null);
    fetch('/api/bookings/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: base }),
    }).catch(() => {});
  };

  const handleDrop = async (targetState: BookingState) => {
    setDropTargetId(null);
    setDragOverCardId(null);
    if (!draggingId) return;
    const booking = bookings.find(b => b.id === draggingId);
    if (!booking || booking.state === targetState) { setDraggingId(null); return; }
    const bookingId = draggingId;
    setDraggingId(null);

    // Fire the first-drag explainer the first time someone moves a card.
    if (!hasSeen("pipeline.first-drag")) {
      setFirstDropColumn(targetState);
    }

    if (targetState === "follow_up") { handleFollowUpInquiry(bookingId); return; }
    if (targetState === "sent_deposit") { handleSendDeposit(bookingId); return; }
    if (targetState === "sent_calendar") { handleSendCalendar(bookingId); return; }
    if (targetState === "booked" && booking.state === "sent_calendar") { handleMarkBooked(bookingId); return; }
    if (targetState === "completed") {
      setCompletionData({ total_amount: "", tip_amount: "", payment_source: "", notes: "" });
      setCompletionModal({ bookingId });
      return;
    }

    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, state: targetState } : b));
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", target_state: targetState }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, state: booking.state } : b));
      alert("Failed to move booking");
    }
  };

  const sendComposedEmail = async (subject: string, body: string) => {
    if (!emailCompose) return;
    const { bookingId, afterSendState } = emailCompose;
    const res = await fetch(`/api/bookings/${bookingId}/send-email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) throw new Error("Failed to send email");
    const data = await res.json();
    const nowIso = new Date().toISOString();
    const newEntry = { label: data.sentEmailLabel ?? subject.slice(0, 60), sent_at: nowIso };
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, last_email_sent_at: nowIso, sent_emails: [...(b.sent_emails ?? []), newEntry] } : b
    ));
    setEmailCompose(null);
    if (afterSendState) {
      try { await moveTo(bookingId, afterSendState); } catch { /* non-fatal */ }
    }
  };

  const nextActionLabel = (state: BookingState): string | null => {
    if (state === "sent_deposit") return "Send Calendar";
    if (state === "sent_calendar") return "Mark Booked";
    if (state === "booked" || state === "confirmed") return "Complete";
    return null;
  };

  // "booked" column shows both booked + legacy confirmed bookings, ordered by columnOrder
  const columnBookings = (colId: BookingState) => {
    const order = columnOrder[colId] ?? [];
    const all = colId === "booked"
      ? bookings.filter(b => b.state === "booked" || b.state === "confirmed")
      : colId === "sent_deposit"
        ? bookings.filter(b => b.state === "sent_deposit" || b.state === "accepted")
        : bookings.filter(b => b.state === colId);
    const ordered = order.map(id => all.find(b => b.id === id)).filter((b): b is Booking => b != null);
    const unordered = all.filter(b => !order.includes(b.id));
    return [...ordered, ...unordered];
  };

  return (
    <>
      <CoachmarkSequence tips={[
        // First-drag explainer is prepended only when the user has actually
        // dropped a card, so it fires right after the move and not on page load.
        ...(firstDropColumn ? [{
          id: "pipeline.first-drag",
          anchorSelector: '[data-coachmark-drop="true"]',
          title: "Nice — you moved a booking",
          body: <>
            <p>Each card represents one client. Dragging a card to a new column changes its stage.</p>
            <p>If auto emails are on, the email for that stage just went out. If they&apos;re off, hit Send manually from the card.</p>
            <p>Made a mistake? Drag the card back to where it was.</p>
          </>,
        }] : []),
        {
          id: "dashboard.pipeline-flow",
          anchorSelector: '[data-coachmark="pipeline-first-column"]',
          title: "This is your pipeline",
          body: <>
            <p>Bookings move left to right: Submission, Accepted, Booked, Completed.</p>
            <p>Drag a card across, or use the action button on each card.</p>
            <p>Each stage has its own email, which sends automatically if you have auto emails on.</p>
          </>,
        },
        {
          id: "dashboard.add-booking",
          anchorSelector: '[data-coachmark="dashboard-add-booking"]',
          title: "Or add bookings manually",
          body: <>
            <p>You don&apos;t need any integrations to use FlashBooker.</p>
            <p>Click here any time to enter a client&apos;s details by hand. Same pipeline, same emails.</p>
          </>,
        },
        {
          id: "dashboard.card-actions",
          anchorSelector: '[data-coachmark="booking-card"]',
          title: "Each card has options",
          body: <>
            <p>The button on the bottom right advances the booking to the next stage without dragging.</p>
            <p>Click the <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">⋯</code> menu for more: send an email, cancel, or jump straight to any stage.</p>
            <p>If you took a deposit outside Stripe, mark it paid from that menu too.</p>
          </>,
        },
      ]} />
      <div className="flex h-full w-full overflow-x-auto gap-3 pb-4 snap-x">
        {PIPELINE_COLUMNS.map((id, colIdx) => {
          const title = COLUMN_LABELS[id];
          const colBookings = columnBookings(id);
          const isDropTarget = dropTargetId === id;

          return (
            <div key={id}
              {...(colIdx === 0 ? { "data-coachmark": "pipeline-first-column" } : {})}
              {...(firstDropColumn === id ? { "data-coachmark-drop": "true" } : {})}
              onDragOver={e => { e.preventDefault(); setDropTargetId(id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTargetId(null); }}
              onDrop={() => handleDrop(id)}
              className={`min-w-[260px] w-[260px] md:min-w-[280px] md:w-[280px] xl:min-w-[300px] xl:w-[300px] max-w-[300px] shrink-0 snap-start flex flex-col h-full rounded-xl pb-4 transition-colors ${isDropTarget ? "bg-primary/5 ring-2 ring-primary/30" : "bg-surface-container-low/50"}`}>
              <div className={`flex items-center justify-between px-3 py-3 border-b border-outline-variant/20 rounded-t-xl mb-3 transition-colors ${isDropTarget ? "bg-primary/10" : "bg-surface-container-low"}`}>
                <h3 className="font-heading font-semibold text-base text-foreground">{title}</h3>
                <span className="text-sm bg-surface-container-high text-on-surface-variant px-2.5 py-0.5 rounded-full font-mono">{colBookings.length}</span>
              </div>
              <div className="flex flex-col gap-3 px-2 overflow-y-auto">
                {colBookings.map(booking => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    fieldLabelMap={fieldLabelMap}
                    nextActionLabel={nextActionLabel(booking.state)}
                    onAdvanceState={handleAdvanceState}
                    onAcceptInquiry={handleAcceptInquiry}
                    onRejectInquiry={handleRejectInquiry}
                    onFollowUpInquiry={handleFollowUpInquiry}
                    onOpenEmail={emailLoading ? undefined : openEmailCompose}
                    onCancel={handleCancel}
                    onMoveState={handleMoveState}
                    onEditAppointment={bid => setBookModal({ bookingId: bid, initialAppointmentDate: bookings.find(b => b.id === bid)?.appointment_date })}
                    onDepositPaid={id => setBookings(prev => prev.map(b => b.id === id ? { ...b, deposit_paid: true } : b))}
                    dragging={draggingId === booking.id}
                    onDragStart={setDraggingId}
                    onDragEnd={() => { setDraggingId(null); setDragOverCardId(null); }}
                    dropIndicator={dragOverCardId === booking.id ? dragPosition : null}
                    onDragOverCard={handleDragOverCard}
                    onDropOnCard={handleDropOnCard}
                    hasStripe={hasStripe}
                    artistId={artistId}
                    schedulingLinks={schedulingLinks}
                  />
                ))}
                {colBookings.length === 0 && (
                  <div className={`text-center p-4 border border-dashed rounded-xl text-xs text-on-surface-variant/60 mt-2 transition-colors ${isDropTarget ? "border-primary/40 text-primary/60" : "border-outline-variant/40"}`}>
                    {isDropTarget ? "Drop here" : "No bookings"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Accept modal */}
      {acceptModal && (
        <AcceptModal
          bookingId={acceptModal.bookingId}
          clientName={bookings.find(b => b.id === acceptModal.bookingId)?.client_name}
          hasStripe={hasStripe}
          schedulingLinks={schedulingLinks}
          artistId={artistId ?? ""}
          isCalendarConnected={calendarSyncEnabled}
          onSent={() => handleAcceptSent(acceptModal.bookingId)}
          onClose={() => setAcceptModal(null)}
        />
      )}

      {/* Send Deposit modal */}
      {sendDepositModal && (
        <SendDepositModal
          bookingId={sendDepositModal.bookingId}
          clientName={bookings.find(b => b.id === sendDepositModal.bookingId)?.client_name ?? ""}
          existingDepositUrl={bookings.find(b => b.id === sendDepositModal.bookingId)?.stripe_payment_link_url ?? undefined}
          hasStripe={hasStripe}
          schedulingLinks={schedulingLinks}
          artistId={artistId ?? ""}
          onSent={linkId => handleDepositSent(sendDepositModal.bookingId, linkId)}
          onClose={() => setSendDepositModal(null)}
        />
      )}

      {/* Send Calendar modal */}
      {sendCalendarModal && (
        <SendCalendarModal
          bookingId={sendCalendarModal.bookingId}
          clientName={bookings.find(b => b.id === sendCalendarModal.bookingId)?.client_name ?? ""}
          schedulingLinks={schedulingLinks}
          artistId={artistId ?? ""}
          onSent={() => handleCalendarSent(sendCalendarModal.bookingId)}
          onClose={() => setSendCalendarModal(null)}
        />
      )}

      {/* Mark Booked modal (manual — set appointment date) */}
      {bookModal && (
        <ConfirmAppointmentModal
          bookingId={bookModal.bookingId}
          calendarSyncEnabled={calendarSyncEnabled}
          initialAppointmentDate={bookModal.initialAppointmentDate}
          existingAppointments={bookings
            .filter(b => (b.state === "booked" || b.state === "confirmed") && b.appointment_date && b.id !== bookModal.bookingId)
            .map(b => ({ appointment_date: b.appointment_date!, client_name: b.client_name }))}
          onConfirmed={(date, eventId) => handleBookingConfirmed(bookModal.bookingId, date, eventId)}
          onSkip={bookModal.initialAppointmentDate ? undefined : async () => { await moveTo(bookModal.bookingId, "booked"); setBookModal(null); }}
          onClose={() => setBookModal(null)}
        />
      )}

      {/* Completion modal */}
      {completionModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setCompletionModal(null)}>
          <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-on-surface mb-1">Complete booking</h2>
            <p className="text-sm text-on-surface-variant mb-5">Optionally record the final details.</p>
            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Total amount ($) <span className="normal-case font-normal">optional</span></label>
                <input type="number" min="0" step="0.01" placeholder="e.g. 350" value={completionData.total_amount}
                  onChange={e => setCompletionData(d => ({ ...d, total_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">How was balance paid? <span className="normal-case font-normal">optional</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_SOURCES.map(src => (
                    <button key={src} type="button"
                      onClick={() => setCompletionData(d => ({ ...d, payment_source: d.payment_source === src ? "" : src }))}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${completionData.payment_source === src ? "bg-on-surface text-surface border-on-surface" : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
                      {src}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Tip ($) <span className="normal-case font-normal">optional</span></label>
                <input type="number" min="0" step="0.01" placeholder="e.g. 50" value={completionData.tip_amount}
                  onChange={e => setCompletionData(d => ({ ...d, tip_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Notes <span className="normal-case font-normal">optional</span></label>
                <textarea placeholder="Any notes about this session…" rows={3} value={completionData.notes}
                  onChange={e => setCompletionData(d => ({ ...d, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button type="button"
                onClick={async () => { await moveTo(completionModal.bookingId, "completed"); setCompletionModal(null); }}
                className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors underline underline-offset-2">
                skip
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={() => setCompletionModal(null)}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={handleComplete}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity">
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {emailCompose && (
        <EmailComposeModal
          templates={emailCompose.templates}
          initialSubject={emailCompose.subject}
          initialBody={emailCompose.body}
          defaultTemplateState={emailCompose.defaultTemplateState}
          paymentLinks={emailCompose.paymentLinks}
          calendarLinks={emailCompose.calendarLinks}
          schedulingLinks={emailCompose.schedulingLinks}
          previewVars={emailCompose.previewVars}
          onSend={sendComposedEmail}
          onSkip={emailCompose.afterSendState ? async () => {
            const { bookingId, afterSendState } = emailCompose;
            setEmailCompose(null);
            if (afterSendState) { try { await moveTo(bookingId, afterSendState); } catch { /* non-fatal */ } }
          } : undefined}
          onClose={() => setEmailCompose(null)}
        />
      )}
    </>
  );
}
