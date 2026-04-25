import { BookingState } from "./types";

export interface CalendarLink {
  label: string;
  url: string;
}

export interface PaymentLink {
  label: string;
  url: string;
}

export interface SchedulingLink {
  id: string;
  label: string;
  duration_minutes: number;
  days: number[];        // 0=Sun 1=Mon … 6=Sat
  start_hour: number;    // 0–23
  end_hour: number;      // 0–23
  timezone: string;      // IANA tz identifier
  calendar_ids?: string[]; // which Google calendars to check; empty/undefined = all
  block_full_day?: boolean; // if true, once any booking exists for a day, block all slots
}

export function normalizeSchedulingLinks(raw: unknown): SchedulingLink[] {
  if (Array.isArray(raw)) return raw as SchedulingLink[];
  return [];
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
  "inquiry", "follow_up", "accepted", "sent_deposit", "sent_calendar", "booked", "completed",
];

export const COLUMN_LABELS: Record<BookingState, string> = {
  inquiry:       "Submissions",
  follow_up:     "Follow Ups",
  accepted:      "Accepted",
  sent_deposit:  "Sent Deposit",
  sent_calendar: "Sent Calendar",
  booked:        "Booked",
  confirmed:     "Booked",   // legacy label
  completed:     "Completed",
  rejected:      "Rejected",
  cancelled:     "Cancelled",
};

export const ALL_BOOKING_STATES: BookingState[] = [
  "inquiry", "follow_up", "accepted", "sent_deposit", "sent_calendar", "booked", "completed", "rejected", "cancelled",
];
