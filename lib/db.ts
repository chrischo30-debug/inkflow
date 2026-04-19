import { supabase } from './supabase';
import { Booking, BookingState } from './types';

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
