"use client";

import { Booking, BookingState } from "@/lib/types";
import { BookingCard, type CalcomData } from "./BookingCard";
import { useState } from "react";
import { createPortal } from "react-dom";
import { PIPELINE_COLUMNS, COLUMN_LABELS } from "@/lib/pipeline-settings";
import { EmailComposeModal, type ResolvedTemplate, type InsertLink } from "./EmailComposeModal";
import { AcceptModal } from "./AcceptModal";
import { ConfirmAppointmentModal } from "./ConfirmAppointmentModal";

interface PipelineViewProps {
  initialBookings: Booking[];
  fieldLabelMap?: Record<string, string>;
  calendarSyncEnabled?: boolean;
  hasStripe?: boolean;
  calcomData?: CalcomData | null;
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
  previewVars?: Record<string, string>;
};

type CompletionModal = { bookingId: string };

export function PipelineView({ initialBookings, fieldLabelMap = {}, calendarSyncEnabled = false, hasStripe = false, calcomData = null }: PipelineViewProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<BookingState | null>(null);

  // Modals
  const [acceptModal, setAcceptModal] = useState<{ bookingId: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ bookingId: string; initialAppointmentDate?: string } | null>(null);
  const [completionModal, setCompletionModal] = useState<CompletionModal | null>(null);
  const [completionData, setCompletionData] = useState({ total_amount: "", tip_amount: "", notes: "" });
  const [emailCompose, setEmailCompose] = useState<EmailCompose | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const moveTo = async (bookingId: string, targetState: BookingState) => {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", target_state: targetState }),
    });
    if (!res.ok) throw new Error("Failed to update booking status");
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, state: targetState } : b));
  };

  // Accept: opens AcceptModal which handles email + state move
  const handleAcceptInquiry = (bookingId: string) => {
    setAcceptModal({ bookingId });
  };

  const handleAcceptSent = (bookingId: string, threadId?: string) => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? { ...b, state: "accepted", last_email_sent_at: new Date().toISOString(), ...(threadId ? { gmail_thread_id: threadId } : {}) }
        : b
    ));
    setAcceptModal(null);
  };

  // Confirm appointment (accepted → confirmed)
  const handleConfirmAppointment = (bookingId: string) => {
    setConfirmModal({ bookingId });
  };

  const handleAppointmentConfirmed = (bookingId: string, appointmentDate: string, googleEventId?: string) => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? { ...b, state: "confirmed", appointment_date: appointmentDate, ...(googleEventId ? { google_event_id: googleEventId } : {}) }
        : b
    ));
    setConfirmModal(null);
  };

  // Complete
  const handleAdvanceState = async (bookingId: string, currentState: BookingState) => {
    if (currentState === "confirmed") {
      setCompletionData({ total_amount: "", tip_amount: "", notes: "" });
      setCompletionModal({ bookingId });
      return;
    }
  };

  const handleComplete = async () => {
    if (!completionModal) return;
    const { bookingId } = completionModal;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          total_amount: completionData.total_amount ? parseFloat(completionData.total_amount) : null,
          tip_amount: completionData.tip_amount ? parseFloat(completionData.tip_amount) : null,
          completion_notes: completionData.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      setBookings(prev => prev.map(b => b.id === bookingId ? {
        ...b,
        state: "completed",
        total_amount: completionData.total_amount ? parseFloat(completionData.total_amount) : undefined,
        tip_amount: completionData.tip_amount ? parseFloat(completionData.tip_amount) : undefined,
        completion_notes: completionData.notes || undefined,
      } : b));
      setCompletionModal(null);
    } catch {
      alert("Failed to complete booking");
    }
  };

  // Reject / follow-up open email compose then move state
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
        bookingId,
        subject,
        body,
        templates: data.templates ?? [],
        defaultTemplateState: defaultState ?? data.defaultTemplateState,
        paymentLinks: data.paymentLinks ?? [],
        calendarLinks: data.calendarLinks ?? [],
        previewVars: data.previewVars,
      });
    } finally {
      setEmailLoading(false);
    }
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) throw new Error();
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, state: "cancelled" } : b));
    } catch {
      alert("Failed to cancel booking");
    }
  };

  const handleMoveState = async (bookingId: string, targetState: BookingState) => {
    if (targetState === "follow_up") {
      await handleFollowUpInquiry(bookingId);
      return;
    }
    try {
      await moveTo(bookingId, targetState);
    } catch {
      alert("Failed to update booking status");
    }
  };

  const handleDrop = async (targetState: BookingState) => {
    setDropTargetId(null);
    if (!draggingId) return;
    const booking = bookings.find(b => b.id === draggingId);
    if (!booking || booking.state === targetState) { setDraggingId(null); return; }
    const bookingId = draggingId;
    setDraggingId(null);

    // Route to the appropriate modal for transitions that need user input
    if (targetState === "follow_up") {
      handleFollowUpInquiry(bookingId);
      return;
    }
    if (targetState === "accepted" && (booking.state === "inquiry" || booking.state === "follow_up")) {
      handleAcceptInquiry(bookingId);
      return;
    }
    if (targetState === "confirmed" && booking.state === "accepted") {
      handleConfirmAppointment(bookingId);
      return;
    }
    if (targetState === "completed" && booking.state === "confirmed") {
      setCompletionData({ total_amount: "", tip_amount: "", notes: "" });
      setCompletionModal({ bookingId });
      return;
    }

    // Direct move for all other transitions
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, state: targetState } : b));
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) throw new Error("Failed to send email");
    const data = await res.json();
    const nowIso = new Date().toISOString();
    const newEntry = { label: data.sentEmailLabel ?? subject.slice(0, 60), sent_at: nowIso };
    setBookings(prev => prev.map(b =>
      b.id === bookingId
        ? {
            ...b,
            last_email_sent_at: nowIso,
            ...(data.threadId ? { gmail_thread_id: data.threadId } : {}),
            sent_emails: [...(b.sent_emails ?? []), newEntry],
          }
        : b
    ));
    setEmailCompose(null);
    if (afterSendState) {
      try { await moveTo(bookingId, afterSendState); } catch { /* non-fatal */ }
    }
  };

  // Next action per state (for the primary card button)
  const nextActionLabel = (state: BookingState): string | null => {
    if (state === "accepted") return "Confirm Appointment";
    if (state === "confirmed") return "Complete";
    return null;
  };

  return (
    <>
      <div className="flex h-full w-full overflow-x-auto gap-3 pb-4 snap-x">
        {PIPELINE_COLUMNS.map(id => {
          const title = COLUMN_LABELS[id];
          const colBookings = bookings.filter(b => b.state === id);
          const isDropTarget = dropTargetId === id;

          return (
            <div
              key={id}
              onDragOver={e => { e.preventDefault(); setDropTargetId(id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTargetId(null); }}
              onDrop={() => handleDrop(id)}
              className={`min-w-[260px] w-[260px] md:min-w-[280px] md:w-[280px] xl:min-w-[300px] xl:w-[300px] max-w-[300px] shrink-0 snap-start flex flex-col h-full rounded-xl pb-4 transition-colors ${
                isDropTarget ? "bg-primary/5 ring-2 ring-primary/30" : "bg-surface-container-low/50"
              }`}
            >
              <div className={`flex items-center justify-between px-3 py-3 border-b border-outline-variant/20 rounded-t-xl mb-3 transition-colors ${isDropTarget ? "bg-primary/10" : "bg-surface-container-low"}`}>
                <h3 className="font-heading font-semibold text-base text-foreground">{title}</h3>
                <span className="text-sm bg-surface-container-high text-on-surface-variant px-2.5 py-0.5 rounded-full font-mono">
                  {colBookings.length}
                </span>
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
                    onConfirmAppointment={handleConfirmAppointment}
                    onOpenEmail={emailLoading ? undefined : openEmailCompose}
                    onCancel={handleCancel}
                    onMoveState={handleMoveState}
                    onEditAppointment={id => setConfirmModal({ bookingId: id, initialAppointmentDate: bookings.find(b => b.id === id)?.appointment_date })}
                    onDepositPaid={id => setBookings(prev => prev.map(b => b.id === id ? { ...b, deposit_paid: true } : b))}
                    dragging={draggingId === booking.id}
                    onDragStart={setDraggingId}
                    hasStripe={hasStripe}
                    calcomData={calcomData}
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
          onSent={(threadId) => handleAcceptSent(acceptModal.bookingId, threadId)}
          onClose={() => setAcceptModal(null)}
        />
      )}

      {/* Confirm appointment modal */}
      {confirmModal && (
        <ConfirmAppointmentModal
          bookingId={confirmModal.bookingId}
          calendarSyncEnabled={calendarSyncEnabled}
          initialAppointmentDate={confirmModal.initialAppointmentDate}
          existingAppointments={bookings
            .filter(b => b.state === "confirmed" && b.appointment_date && b.id !== confirmModal.bookingId)
            .map(b => ({ appointment_date: b.appointment_date!, client_name: b.client_name }))}
          onConfirmed={(date, eventId) => handleAppointmentConfirmed(confirmModal.bookingId, date, eventId)}
          onSkip={confirmModal.initialAppointmentDate ? undefined : async () => { await moveTo(confirmModal.bookingId, "confirmed"); setConfirmModal(null); }}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Completion modal */}
      {completionModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setCompletionModal(null)}>
          <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-on-surface mb-1">Complete booking</h2>
            <p className="text-sm text-on-surface-variant mb-5">Optionally record the final details for this appointment.</p>
            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Total amount ($)</label>
                <input type="number" min="0" step="0.01" placeholder="e.g. 350" value={completionData.total_amount} onChange={e => setCompletionData(d => ({ ...d, total_amount: e.target.value }))} className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Tip ($)</label>
                <input type="number" min="0" step="0.01" placeholder="e.g. 50" value={completionData.tip_amount} onChange={e => setCompletionData(d => ({ ...d, tip_amount: e.target.value }))} className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Notes</label>
                <textarea placeholder="Any notes about this client or session…" rows={3} value={completionData.notes} onChange={e => setCompletionData(d => ({ ...d, notes: e.target.value }))} className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={async () => { await moveTo(completionModal.bookingId, "completed"); setCompletionModal(null); }} className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors underline underline-offset-2">skip</button>
              <div className="flex gap-3">
                <button type="button" onClick={() => setCompletionModal(null)} className="px-5 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">Cancel</button>
                <button type="button" onClick={handleComplete} className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity">Mark Complete</button>
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
          previewVars={emailCompose.previewVars}
          onSend={sendComposedEmail}
          onSkip={emailCompose.afterSendState ? async () => {
            const { bookingId, afterSendState } = emailCompose;
            setEmailCompose(null);
            if (afterSendState) {
              try { await moveTo(bookingId, afterSendState); } catch { /* non-fatal */ }
            }
          } : undefined}
          onClose={() => setEmailCompose(null)}
        />
      )}
    </>
  );
}
