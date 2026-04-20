alter table artists
  add column if not exists booking_bg_color    text    default '#ffffff',
  add column if not exists booking_bg_image_url text,
  add column if not exists booking_layout      text    default 'centered',
  add column if not exists booking_font        text    default 'sans',
  add column if not exists logo_url            text,
  add column if not exists website_url         text,
  add column if not exists social_links        jsonb   default '[]',
  add column if not exists show_social_on_booking boolean default false;
