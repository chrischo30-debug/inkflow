-- Step 1: Add new enum values only.
-- Must commit before new values can be used in DML (see next migration file).
ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'paid_calendar_link_sent';
ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE booking_state ADD VALUE IF NOT EXISTS 'follow_up';
