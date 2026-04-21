alter table artists
  add column if not exists stripe_api_key text,
  add column if not exists calcom_api_key text;
