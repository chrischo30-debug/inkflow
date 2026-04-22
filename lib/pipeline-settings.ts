import { BookingState } from "./types";

export interface CalendarLink {
  label: string;
  url: string;
}

export interface PaymentLink {
  label: string;
  url: string;
}

export function normalizePaymentLinks(raw: unknown): PaymentLink[] {
  if (Array.isArray(raw)) return raw as PaymentLink[];
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, string>)
      .filter(([, v]) => v)
      .map(([label, url]) => ({ label, url }));
  }
  return [];
}

export const PIPELINE_COLUMNS: BookingState[] = [
  "inquiry", "follow_up", "accepted", "confirmed", "completed",
];

export const COLUMN_LABELS: Record<BookingState, string> = {
  inquiry:   "Submissions",
  follow_up: "Follow Ups",
  accepted:  "Accepted",
  confirmed: "Booked",
  completed: "Completed",
  rejected:  "Rejected",
  cancelled: "Cancelled",
};

export const ALL_BOOKING_STATES: BookingState[] = [
  "inquiry", "follow_up", "accepted", "confirmed", "completed", "rejected", "cancelled",
];
