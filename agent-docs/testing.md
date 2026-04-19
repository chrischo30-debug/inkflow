# testing.md

## Testing Tool
Vitest for unit/integration tests. Playwright for end-to-end tests (Phase 1 launch).
Skip tests during early Phase 1 development — add before launch.

## What Must Be Tested

### Critical (test before launch)
- Booking state machine: valid transitions pass, invalid transitions are rejected
- Public inquiry form: submission saves correctly, artist notification email fires
- Payment link sending: only allowed when state is "reviewed" or later — not on raw inquiry
- RLS enforcement: artist cannot fetch another artist's bookings via API
- Email templates: variable substitution ({client_name}, {artist_name}) renders correctly

### Important (add after core features work)
- Google Calendar sync: confirmed booking writes correct event data
- Availability logic: no double-booking within artist's availability blocks
- Auth: unauthenticated requests to protected routes return 401

### Skip for Now
- UI component snapshot tests
- Full E2E Playwright flows (until launch prep)

## How to Run Tests
Run all:         npm test
Watch mode:      npm run test:watch
Single file:     npx vitest run [filename]

## Test File Location
Place test files next to the file they test: lib/db.test.ts tests lib/db.ts
E2E tests go in: tests/e2e/

## Example Pattern — State Machine Test
```typescript
import { describe, it, expect } from 'vitest'
import { isValidStateTransition } from '@/lib/bookings'

describe('booking state machine', () => {
  it('allows valid forward transition', () => {
    expect(isValidStateTransition('inquiry', 'reviewed')).toBe(true)
  })

  it('rejects skipping states', () => {
    expect(isValidStateTransition('inquiry', 'confirmed')).toBe(false)
  })

  it('rejects backward transitions', () => {
    expect(isValidStateTransition('confirmed', 'inquiry')).toBe(false)
  })
})
```

## Example Pattern — API Route Test
```typescript
import { describe, it, expect, vi } from 'vitest'

describe('PATCH /api/bookings/[id]/state', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await fetch('/api/bookings/fake-id/state', { method: 'PATCH' })
    expect(res.status).toBe(401)
  })
})
```
