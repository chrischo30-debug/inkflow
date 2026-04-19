"use client";

import { Booking, BookingState } from "@/lib/types";
import { BookingCard } from "./BookingCard";
import { useState } from "react";

interface PipelineViewProps {
  initialBookings: Booking[];
  fieldLabelMap?: Record<string, string>;
}

const COLUMNS: { id: BookingState; title: string }[] = [
  { id: "inquiry", title: "Inquiries" },
  { id: "reviewed", title: "Reviewed" },
  { id: "deposit_sent", title: "Deposit Sent" },
  { id: "deposit_paid", title: "Deposit Paid" },
  { id: "confirmed", title: "Confirmed" },
  { id: "completed", title: "Completed" },
];

export function PipelineView({ initialBookings, fieldLabelMap = {} }: PipelineViewProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);

  // Quick demonstration logic for advancing state
  const handleAdvanceState = async (bookingId: string, currentState: BookingState) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", current_state: currentState }),
      });

      if (!res.ok) throw new Error("Failed to advance state");

      const { newState } = await res.json();
      
      setBookings((prev) => 
        prev.map(b => b.id === bookingId ? { ...b, state: newState } : b)
      );
    } catch (e) {
      console.error(e);
      alert("Failed to update booking status");
    }
  };

  return (
    <div className="flex h-full w-full overflow-x-auto gap-4 pb-4 snap-x">
      {COLUMNS.map((col) => {
        const colBookings = bookings.filter((b) => b.state === col.id);
        
        return (
          <div key={col.id} className="min-w-[300px] w-[300px] max-w-[300px] shrink-0 snap-start flex flex-col h-full bg-surface-container-low/50 rounded-xl pb-4">
            <div className="flex items-center justify-between p-3 border-b border-outline-variant/20 bg-surface-container-low rounded-t-xl mb-3">
              <h3 className="font-heading font-medium text-sm text-foreground">{col.title}</h3>
              <span className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full font-mono">
                {colBookings.length}
              </span>
            </div>
            
            <div className="flex flex-col gap-3 px-2 overflow-y-auto">
              {colBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} fieldLabelMap={fieldLabelMap} onAdvanceState={handleAdvanceState} />
              ))}
              {colBookings.length === 0 && (
                <div className="text-center p-4 border border-dashed border-outline-variant/40 rounded-xl text-xs text-on-surface-variant/60 mt-2">
                  No bookings in this state
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
