"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { EmailComposeModal, type InsertLink, type ResolvedTemplate } from "./EmailComposeModal";

interface Props {
  bookingId: string;
  onSent: (threadId?: string) => void;
  onClose: () => void;
}

interface EmailData {
  subject: string;
  body: string;
  templates: ResolvedTemplate[];
  paymentLinks: InsertLink[];
  calendarLinks: InsertLink[];
  previewVars?: Record<string, string>;
}

export function AcceptModal({ bookingId, onSent, onClose }: Props) {
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/send-email`);
        if (!res.ok) return;
        const d: EmailData = await res.json();
        const acceptedTmpl = d.templates.find(t => t.state === "accepted");
        setData({
          ...d,
          subject: acceptedTmpl?.subject ?? d.subject,
          body: acceptedTmpl?.body ?? d.body,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bookingId]);

  const handleSend = async (subject: string, body: string) => {
    const res = await fetch(`/api/bookings/${bookingId}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) throw new Error("Failed to send email");
    const result = await res.json();

    await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", target_state: "accepted" }),
    });

    onSent(result.threadId);
  };

  const handleSkip = async () => {
    await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", target_state: "accepted" }),
    });
    onSent();
  };

  if (loading) return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-2xl shadow-xl px-8 py-6 text-sm text-on-surface-variant">Loading…</div>
    </div>,
    document.body
  );

  if (!data) return null;

  return (
    <EmailComposeModal
      templates={data.templates}
      initialSubject={data.subject}
      initialBody={data.body}
      defaultTemplateState="accepted"
      paymentLinks={data.paymentLinks}
      calendarLinks={data.calendarLinks}
      previewVars={data.previewVars}
      onSend={handleSend}
      onSkip={handleSkip}
      onClose={onClose}
    />
  );
}
