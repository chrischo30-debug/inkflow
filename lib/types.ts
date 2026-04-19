// Types for InkFlow Phase 1

export type BookingState = 
  | 'inquiry' 
  | 'reviewed' 
  | 'deposit_sent' 
  | 'deposit_paid' 
  | 'confirmed' 
  | 'completed';

export interface Booking {
  id: string;
  artist_id: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  description: string;
  state: BookingState;
  payment_link?: string;
  appointment_date?: string; // ISO 8601
  created_at: string;
  updated_at: string;
}

export interface Artist {
  id: string;
  name: string;
  email: string;
  payment_links: Record<string, string>; // e.g., { "Stripe": "...", "Venmo": "..." }
  calendar_sync_enabled: boolean;
}
