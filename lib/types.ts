// Types for FlashBook Phase 1

export type BookingState = 
  | 'inquiry' 
  | 'reviewed' 
  | 'deposit_sent' 
  | 'deposit_paid' 
  | 'confirmed' 
  | 'completed'
  | 'cancelled';

export type DepositPolicyType = 'fixed' | 'percentage' | 'custom';

export type DepositPolicy =
  | { type: 'fixed';      amount: number }
  | { type: 'percentage'; value: number }
  | { type: 'custom';     note: string };

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
