"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { DollarSign, X } from "lucide-react";

interface PaymentEvent {
  type: "payment_received";
  booking_id: string;
  client_name: string;
  session_type: string;
  amount_paid: number; // cents
  next_step: string;
}

interface Toast {
  id: number;
  event: PaymentEvent;
}

function fmt$(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function ToastNotification({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  return (
    <div className="flex items-start gap-3 bg-on-surface text-surface rounded-2xl shadow-xl px-4 py-3.5 w-80 pointer-events-auto">
      <div className="mt-0.5 shrink-0 w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
        <DollarSign className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-surface leading-snug">Payment received</p>
        <p className="text-xs text-surface/70 mt-0.5 truncate">
          {toast.event.client_name} — {toast.event.session_type}
        </p>
        <p className="text-xs font-semibold text-emerald-400 mt-0.5">
          {fmt$(toast.event.amount_paid)}
        </p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 mt-0.5 p-0.5 rounded-lg hover:bg-surface/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5 text-surface/50" />
      </button>
    </div>
  );
}

export function PaymentSSEListener({ artistId }: { artistId: string }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!artistId) return;

    const es = new EventSource(`/api/payments/events/${artistId}`);

    es.onmessage = (e) => {
      if (!e.data || e.data.startsWith(":")) return;
      try {
        const payload = JSON.parse(e.data) as PaymentEvent;
        if (payload.type !== "payment_received") return;

        const id = ++toastCounter.current;
        setToasts((prev) => [...prev, { id, event: payload }]);

        // Auto-dismiss after 8 s
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 8000);

        // Refresh server component data so booking card shows deposit_paid = true
        router.refresh();
      } catch {
        // non-JSON comment lines
      }
    };

    es.onerror = () => {
      // Browser will auto-reconnect; no action needed
    };

    return () => {
      es.close();
    };
  }, [artistId, router]);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastNotification key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>,
    document.body,
  );
}
