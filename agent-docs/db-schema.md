# db-schema.md

## Tables

### artists
The main user/tenant table. One row per tattoo artist account.
| column              | type        | notes                                      |
|---------------------|-------------|--------------------------------------------|
| id                  | uuid PK     | Supabase auth user ID                      |
| email               | text        | login email                                |
| name                | text        | display name                               |
| slug                | text unique | used in public booking URL /book/[slug]    |
| studio_name         | text        | optional                                   |
| bio                 | text        | optional, shown on booking form            |
| deposit_amount      | numeric     | default deposit they charge                |
| payment_links       | jsonb       | { stripe: url, venmo: url, cashapp: url }  |
| google_calendar_id  | text        | connected Google Calendar ID               |
| google_tokens       | jsonb       | encrypted OAuth tokens — server only       |
| created_at          | timestamptz |                                            |

### bookings
One row per client inquiry/booking. The core pipeline record.
| column              | type        | notes                                                              |
|---------------------|-------------|--------------------------------------------------------------------|
| id                  | uuid PK     |                                                                    |
| artist_id           | uuid FK     | → artists.id (RLS enforced)                                        |
| state               | text        | inquiry, reviewed, deposit_sent, deposit_paid, confirmed, completed|
| client_name         | text        |                                                                    |
| client_email        | text        |                                                                    |
| client_phone        | text        | optional                                                           |
| tattoo_description  | text        |                                                                    |
| placement           | text        |                                                                    |
| size                | text        |                                                                    |
| budget              | text        | optional                                                           |
| reference_images    | text[]      | array of Supabase Storage URLs                                     |
| appointment_at      | timestamptz | set when state → confirmed                                         |
| google_event_id     | text        | Google Calendar event ID after sync                                |
| notes               | text        | artist's private notes                                             |
| created_at          | timestamptz |                                                                    |
| updated_at          | timestamptz |                                                                    |

### email_templates
Artist-editable email templates for each pipeline state transition.
| column        | type    | notes                                              |
|---------------|---------|----------------------------------------------------|
| id            | uuid PK |                                                    |
| artist_id     | uuid FK | → artists.id                                       |
| trigger_state | text    | the state that fires this email (e.g. "reviewed")  |
| subject       | text    |                                                    |
| body          | text    | supports {client_name}, {artist_name} variables    |
| auto_send     | boolean | true = fires automatically on state change         |
| created_at    | timestamptz |                                                |

### availability
Artist's available time blocks for scheduling.
| column      | type        | notes                          |
|-------------|-------------|--------------------------------|
| id          | uuid PK     |                                |
| artist_id   | uuid FK     | → artists.id                   |
| day_of_week | int         | 0=Sun, 1=Mon ... 6=Sat         |
| start_time  | time        |                                |
| end_time    | time        |                                |
| is_active   | boolean     |                                |

## Relationships
- artists ← bookings (one artist, many bookings)
- artists ← email_templates (one artist, many templates — one per trigger_state)
- artists ← availability (one artist, many time blocks)

## Row Level Security
All tables have RLS enabled. Policy: artist can only SELECT/INSERT/UPDATE/DELETE
rows where artist_id = auth.uid(). The bookings table allows unauthenticated INSERT
(for public inquiry form submissions) but no unauthenticated SELECT.

## Changing the Schema
Always write a migration file (supabase/migrations/). Never alter tables directly
in the Supabase dashboard without a corresponding migration file in the repo.
Show the migration plan before running it.
