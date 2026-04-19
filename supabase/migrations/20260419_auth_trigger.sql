-- ============================================================
-- InkFlow Phase 1 Setup: Auth Trigger
-- Automatically inserts a row into `artists` when a user signs up.
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create or replace function public.handle_new_user()
returns trigger 
language plpgsql 
security definer set search_path = public
as $$
declare
  default_name text;
  default_slug text;
begin
  -- Use their full_name from metadata if they signed up with OAuth (like Google), 
  -- otherwise generate a placeholder name based on their user ID.
  default_name := coalesce(new.raw_user_meta_data->>'full_name', 'Artist ' || substr(new.id::text, 1, 6));
  
  -- Create a default, unique slug that they will be asked to change during onboarding.
  default_slug := 'artist-' || substr(new.id::text, 1, 8);

  insert into public.artists (id, email, name, slug)
  values (
    new.id, 
    new.email, 
    default_name,
    default_slug
  );
  
  return new;
end;
$$;

-- Drop the trigger if it already exists, then create it
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
