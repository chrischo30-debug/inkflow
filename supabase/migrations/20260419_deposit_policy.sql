-- ============================================================
-- InkFlow: Replace deposit_amount with flexible deposit_policy
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Drop the old rigid column and add a flexible JSONB column
alter table public.artists
  drop column if exists deposit_amount,
  add column if not exists deposit_policy jsonb default '{"type": "fixed", "amount": 0}';

-- ============================================================
-- deposit_policy shape:
--   Fixed:      { "type": "fixed",      "amount": 100 }
--   Percentage: { "type": "percentage", "value": 25 }
--   Custom:     { "type": "custom",     "note": "Varies by size and placement" }
-- ============================================================
