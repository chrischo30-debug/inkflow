// Types for FlashBooker Phase 1

export type BookingState =
  | 'inquiry'
  | 'follow_up'
  | 'accepted'
  | 'confirmed'
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
  deposit_paid?: boolean;
  stripe_payment_link_url?: string;
  total_amount?: number;
  tip_amount?: number;
  completion_notes?: string;
  completion_image_urls?: string[];
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
