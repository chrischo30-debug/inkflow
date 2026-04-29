// Types for FlashBooker Phase 1

export type BookingState =
  | 'inquiry'
  | 'follow_up'
  | 'accepted'
  | 'sent_deposit'
  | 'sent_calendar'
  | 'booked'
  | 'confirmed'   // legacy — treated as 'booked' in the pipeline
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type DepositPolicyType = 'fixed' | 'percentage' | 'custom';

export type DepositPolicy =
  | { type: 'fixed';      amount: number }
  | { type: 'percentage'; value: number }
  | { type: 'custom';     note: string };

export interface SentEmailEntry {
  label: string;
  sent_at: string;
}

export interface SessionAppointment {
  appointment_date?: string;
  completed_at?: string;
  total_amount?: number;
  tip_amount?: number;
  payment_source?: string;
  notes?: string;
  google_event_id?: string;
}

export interface Booking {
  id: string;
  artist_id: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  description: string;
  size?: string;
  placement?: string;
  budget?: number;
  reference_urls?: string[];
  custom_answers?: Record<string, string | number | boolean | string[] | null>;
  state: BookingState;
  payment_link?: string;
  payment_link_sent?: string;
  google_event_id?: string;
  deposit_amount?: number;
  appointment_date?: string; // ISO 8601
  last_email_sent_at?: string;
  gmail_thread_id?: string;
  sent_emails?: SentEmailEntry[];
  has_unread_reply?: boolean;
  /** True if the public-form auto-confirm or artist notification email failed. */
  inquiry_email_failed?: boolean;
  /** Short failure description, set when inquiry_email_failed=true. */
  inquiry_email_error?: string;
  deposit_paid?: boolean;
  /** Provider-agnostic deposit link URL. Falls back to legacy stripe_payment_link_url. */
  deposit_link_url?: string;
  /** External order/payment id used by the provider for webhook reconciliation. */
  deposit_external_id?: string;
  /** Which provider issued the deposit link for this booking ('stripe' | 'square'). */
  payment_provider?: "stripe" | "square" | null;
  /** @deprecated Use deposit_link_url. Kept on the type so legacy reads still type-check. */
  stripe_payment_link_url?: string;
  scheduling_link_id?: string;
  /** How many sessions this booking covers (1 for single-session). */
  session_count?: number;
  /** Per-session durations in minutes (length = session_count - 1, sessions 2..N). Session 1 uses the scheduling link's duration. */
  session_durations?: number[];
  /** Per-session metadata indexed 0..session_count-1. Each entry can hold appointment_date, completed_at, total_amount, tip_amount, google_event_id. */
  session_appointments?: SessionAppointment[];
  /** How many sessions the artist has marked complete. When it equals session_count, booking moves to "completed". */
  completed_session_count?: number;
  total_amount?: number;
  tip_amount?: number;
  payment_source?: string;
  completion_notes?: string;
  completion_image_urls?: string[];
  sort_order?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Artist {
  id: string;
  name: string;
  email: string;
  slug: string;
  studio_name?: string;
  deposit_policy: DepositPolicy;
  payment_links: Record<string, string>; // e.g., { "Stripe": "...", "Venmo": "..." }
  calendar_sync_enabled: boolean;
}

export interface EmailTemplate {
  id?: string;
  artist_id?: string;
  state: BookingState | null;
  name?: string;
  subject: string;
  body: string;
  auto_send: boolean;
  // When false, the template is fully off: no auto-send, no modal pop on transition.
  // Defaults to true on the DB side so existing rows behave as before.
  enabled?: boolean;
}

export type StandardBookingField =
  | 'client_name'
  | 'client_email'
  | 'client_phone'
  | 'description'
  | 'size'
  | 'placement'
  | 'budget';

export interface WebhookSource {
  id: string;
  artist_id: string;
  name: string;
  token: string;
  /** Maps incoming form field keys to StandardBookingField or a custom_answers key */
  field_mappings: Record<string, string>;
  enabled: boolean;
  created_at: string;
}
