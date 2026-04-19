# Database Schema

_Last updated: 2026-04-19_

---

## `artists`
Extends `auth.users`. One row per artist.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | References `auth.users(id)` |
| `name` | text | Artist display name |
| `email` | text unique | |
| `slug` | text unique | Public booking URL segment |
| `studio_name` | text | Optional |
| `deposit_policy` | jsonb | See shape below |
| `payment_links` | jsonb | `{ "Stripe": "url", "Venmo": "url" }` |
| `style_tags` | text[] | |
| `calendar_sync_enabled` | boolean | |
| `google_refresh_token` | text | Encrypted server-side only |
| `auto_process_inquiries` | boolean | Skip manual review step |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger |

### `deposit_policy` shape (JSONB)
```json
// Fixed dollar amount
{ "type": "fixed", "amount": 100 }

// Percentage of quoted price
{ "type": "percentage", "value": 25 }

// Freeform custom policy text
{ "type": "custom", "note": "Varies by size and placement" }
```

---

## `bookings`
Each row is one client inquiry or booking.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `artist_id` | uuid FK | → `artists.id` |
| `client_name` | text | |
| `client_email` | text | |
| `client_phone` | text | Optional |
| `description` | text | Tattoo idea description |
| `size` | text | Optional |
| `placement` | text | Optional |
| `budget` | numeric(10,2) | Optional |
| `reference_urls` | text[] | |
| `state` | booking_state enum | See below |
| `payment_link_sent` | text | Link sent to this specific client |
| `deposit_amount` | numeric(10,2) | Actual amount collected |
| `appointment_date` | timestamptz | |
| `last_email_sent_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Enum: `booking_state`**  
`inquiry` → `reviewed` → `deposit_sent` → `deposit_paid` → `confirmed` → `completed` | `cancelled`

---

## `email_templates`
Per-artist email templates for each pipeline state.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `artist_id` | uuid FK | → `artists.id` |
| `state` | booking_state enum | One template per state |
| `subject` | text | |
| `body` | text | |
| `auto_send` | boolean | Fire automatically on state change |

Unique constraint: `(artist_id, state)`

---

## `form_fields`
Controls which fields are shown on the artist's public booking form.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `artist_id` | uuid FK | → `artists.id` |
| `field_key` | text | e.g. `"phone"`, `"budget"`, `"reference_images"` |
| `enabled` | boolean | |
| `required` | boolean | |
| `sort_order` | int | |

Unique constraint: `(artist_id, field_key)`

---

## RLS Summary
All tables have Row Level Security enabled.  
Artists can only read and write their own rows (`id = auth.uid()` or `artist_id = auth.uid()`).
