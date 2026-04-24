-- Condense pipeline states: migrate deposit_sent → accepted, paid_calendar_link_sent → confirmed
-- We cannot drop enum values in Postgres, so we just migrate existing data.

update bookings set state = 'accepted'   where state = 'deposit_sent';
update bookings set state = 'confirmed'  where state = 'paid_calendar_link_sent';
