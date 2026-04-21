"use client";

import { Booking, BookingState } from "@/lib/types";
import { BookingCard } from "./BookingCard";
import { useState } from "react";
import { PipelineSettings, PIPELINE_COLUMNS, DEFAULT_PIPELINE_SETTINGS } from "@/lib/pipeline-settings";
import { EmailComposeModal, type ResolvedTemplate } from "./EmailComposeModal";

interface PipelineViewProps {
  initialBookings: Booking[];
  fieldLabelMap?: Record<string, string>;
  pipelineSettings?: PipelineSettings;
}

const EMAIL_ACTION_LABELS: Partial<Record<BookingState, string>> = {
  reviewed:     "Send a review notification email to the client?",
  deposit_sent: "Send the deposit request email to the client?",
  deposit_paid: "Send a deposit received confirmation to the client?",
  confirmed:    "Send an appointment confirmation email to the client?",
  completed:    "Send a thank-you email to the client?",
};

type PostDropPrompt = { bookingId: string; targetState: BookingState; clientName: string };
type EmailCompose = { bookingId: string; subject: string; body: string; templates: ResolvedTemplate[]; defaultTemplateState?: string | null };

export function PipelineView({ initialBookings, fieldLabelMap = {}, pipelineSettings }: PipelineViewProps) {
  const ps = pipelineSettings ?? DEFAULT_PIPELINE_SETTINGS;
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<BookingState | null>(null);
  const [postDrop, setPostDrop] = useState<PostDropPrompt | null>(null);
  const [emailCompose, setEmailCompose] = useState<EmailCompose | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const handleAdvanceState = async (bookingId: string, currentState: BookingState) => {
    const action = ps.next_actions[currentState];
    if (!action) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", target_state: action.target }),
      });
      if (!res.ok) throw new Error();
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, state: action.target } : b));
      if (EMAIL_ACTION_LABELS[action.target]) {
        const booking = bookings.find(b => b.id === bookingId);
        if (booking) setPostDrop({ bookingId, targetState: action.target, clientName: booking.client_name });
      }
    } catch {
      alert("Failed to update booking status");
    }
  };

  const handleSendEmail = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/send-email`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBookings(prev => prev.map(b =>
        b.id === bookingId
          ? { ...b, last_email_sent_at: new Date().toISOString(), ...(data.threadId ? { gmail_thread_id: data.threadId } : {}) }
          : b
      ));
    } catch {
      alert("Failed to send email");
    }
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
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", target_state: targetState }),
      });
      if (!res.ok) throw new Error();
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, state: targetState } : b));
    } catch {
      alert("Failed to update booking status");
    }
  };

  const handleDrop = async (targetState: BookingState) => {
    setDropTargetId(null);
    if (!draggingId) return;

    const booking = bookings.find(b => b.id === draggingId);
    if (!booking || booking.state === targetState) {
      setDraggingId(null);
      return;
    }

    // Optimistic update
    setBookings(prev => prev.map(b => b.id === draggingId ? { ...b, state: targetState } : b));
    setDraggingId(null);

    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", target_state: targetState }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Rollback
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, state: booking.state } : b));
      alert("Failed to move booking");
      return;
    }

    // Prompt for email if this state has one
    if (EMAIL_ACTION_LABELS[targetState]) {
      setPostDrop({ bookingId: booking.id, targetState, clientName: booking.client_name });
    }
  };

  const openEmailCompose = async (bookingId: string) => {
    setEmailLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/send-email`);
      if (!res.ok) return;
      const data = await res.json();
      setEmailCompose({ bookingId, subject: data.subject, body: data.body, templates: data.templates ?? [], defaultTemplateState: data.defaultTemplateState });
    } finally {
      setEmailLoading(false);
    }
  };

  const sendComposedEmail = async (subject: string, body: string) => {
    if (!emailCompose) return;
    const res = await fetch(`/api/bookings/${emailCompose.bookingId}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) throw new Error("Failed to send email");
    const data = await res.json();
    setBookings(prev => prev.map(b =>
      b.id === emailCompose.bookingId
        ? { ...b, last_email_sent_at: new Date().toISOString(), ...(data.threadId ? { gmail_thread_id: data.threadId } : {}) }
        : b
    ));
    setEmailCompose(null);
  };

  return (
    <>
      <div className="flex h-full w-full overflow-x-auto gap-4 pb-4 snap-x">
        {PIPELINE_COLUMNS.filter(id => !ps.hidden_columns.includes(id)).map(id => {
          const col = { id, title: ps.column_labels[id] ?? DEFAULT_PIPELINE_SETTINGS.column_labels[id] ?? id };
          const colBookings = bookings.filter(b => b.state === col.id);
          const isDropTarget = dropTargetId === col.id;

          return (
            <div
              key={col.id}
              onDragOver={e => { e.preventDefault(); setDropTargetId(col.id); }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTargetId(null);
              }}
              onDrop={() => handleDrop(col.id)}
              className={`min-w-[300px] w-[300px] max-w-[300px] shrink-0 snap-start flex flex-col h-full rounded-xl pb-4 transition-colors ${
                isDropTarget
                  ? "bg-primary/5 ring-2 ring-primary/30"
                  : "bg-surface-container-low/50"
              }`}
            >
              <div className={`flex items-center justify-between p-4 border-b border-outline-variant/20 rounded-t-xl mb-3 transition-colors ${isDropTarget ? "bg-primary/10" : "bg-surface-container-low"}`}>
                <h3 className="font-heading font-semibold text-base text-foreground">{col.title}</h3>
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
                    cardFields={ps.card_fields}
                    nextAction={ps.next_actions[booking.state]}
                    onAdvanceState={handleAdvanceState}
                    onSendEmail={handleSendEmail}
                    onCancel={handleCancel}
                    onMoveState={handleMoveState}
                    dragging={draggingId === booking.id}
                    onDragStart={setDraggingId}
                  />
                ))}
                {colBookings.length === 0 && (
                  <div className={`text-center p-4 border border-dashed rounded-xl text-xs text-on-surface-variant/60 mt-2 transition-colors ${isDropTarget ? "border-primary/40 text-primary/60" : "border-outline-variant/40"}`}>
                    {isDropTarget ? "Drop here" : "No bookings in this state"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Post-drop email prompt */}
      {postDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPostDrop(null)}>
          <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-on-surface mb-1">Booking moved</h2>
            <p className="text-sm text-on-surface-variant mb-5">
              {EMAIL_ACTION_LABELS[postDrop.targetState]}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPostDrop(null)}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={emailLoading}
                onClick={async () => {
                  const id = postDrop.bookingId;
                  setPostDrop(null);
                  await openEmailCompose(id);
                }}
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {emailLoading ? "Loading…" : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {emailCompose && (
        <EmailComposeModal
          templates={emailCompose.templates}
          initialSubject={emailCompose.subject}
          initialBody={emailCompose.body}
          defaultTemplateState={emailCompose.defaultTemplateState}
          onSend={sendComposedEmail}
          onClose={() => setEmailCompose(null)}
        />
      )}
    </>
  );
}
