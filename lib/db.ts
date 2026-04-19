import { supabase } from './supabase';
import type { Booking, BookingState } from './types';

// Example wrapper
export async function getBookingsByArtist(artistId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('artist_id', artistId);

  if (error) throw error;
  return data as Booking[];
}

export async function updateBookingState(bookingId: string, newState: BookingState) {
  const { error } = await supabase
    .from('bookings')
    .update({ state: newState })
    .eq('id', bookingId);
    
  if (error) throw error;
}

export async function createBooking(payload: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('bookings')
    .insert([payload])
    .select('id')
    .single();
    
  if (error) throw error;
  return data.id;
}

