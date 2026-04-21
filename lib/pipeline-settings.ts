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

export const ALL_BOOKING_STATES: BookingState[] = [
  "inquiry", "reviewed", "deposit_sent", "deposit_paid", "confirmed", "completed", "cancelled",
];

export const PIPELINE_COLUMNS: BookingState[] = [
  "inquiry", "reviewed", "deposit_sent", "deposit_paid", "confirmed", "completed",
];

export const CARD_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "size",        label: "Size" },
  { key: "placement",   label: "Placement" },
  { key: "budget",      label: "Budget" },
  { key: "phone",       label: "Phone" },
];

export interface NextAction {
  label: string;
  target: BookingState;
}

export interface PipelineSettings {
  card_fields: string[];
  column_labels: Partial<Record<BookingState, string>>;
  next_actions: Partial<Record<BookingState, NextAction>>;
  hidden_columns: BookingState[];
}

export const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  card_fields: ["description", "size", "placement", "budget"],
  column_labels: {
    inquiry:      "Inquiries",
    reviewed:     "Reviewed",
    deposit_sent: "Deposit Sent",
    deposit_paid: "Deposit Paid",
    confirmed:    "Confirmed",
    completed:    "Completed",
    cancelled:    "Cancelled",
  },
  next_actions: {
    inquiry:      { label: "Review",       target: "reviewed" },
    reviewed:     { label: "Send Deposit", target: "deposit_sent" },
    deposit_sent: { label: "Mark Paid",    target: "deposit_paid" },
    deposit_paid: { label: "Confirm",      target: "confirmed" },
    confirmed:    { label: "Complete",     target: "completed" },
  },
  hidden_columns: [],
};

export function mergePipelineSettings(saved: Partial<PipelineSettings>): PipelineSettings {
  return {
    card_fields:    saved.card_fields    ?? DEFAULT_PIPELINE_SETTINGS.card_fields,
    column_labels:  { ...DEFAULT_PIPELINE_SETTINGS.column_labels,  ...(saved.column_labels  ?? {}) },
    next_actions:   { ...DEFAULT_PIPELINE_SETTINGS.next_actions,   ...(saved.next_actions   ?? {}) },
    hidden_columns: saved.hidden_columns ?? DEFAULT_PIPELINE_SETTINGS.hidden_columns,
  };
}
