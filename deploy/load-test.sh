#!/usr/bin/env bash
# FlashBooker — load/stress test.
# Hits the realistic high-concurrency surfaces of the app:
#   1. Public booking POST (book-release spike)
#   2. Public scheduling slots GET (clients picking times)
#   3. Public availability GET (artist-side scheduling check)
#   4. Public booking page render
#
# Backed by `hey` (https://github.com/rakyll/hey). Install:
#   brew install hey   # mac
#   go install github.com/rakyll/hey@latest
#
# Usage:
#   BASE_URL=https://preview.vercel.app ARTIST_ID=... ARTIST_SLUG=... LINK_ID=... ./deploy/load-test.sh
#
# **Run against a preview deployment, not production.** Each scenario writes
# to the database (booking POST). Use a throwaway test artist and clean up
# after. Set MUTATE=0 to skip the booking POST.
#
# Reading the output:
#   - "p99" >5s on any public endpoint = bad
#   - any non-2xx in the public-page tests = bad
#   - p99 < 2s and 100% 2xx = ship it

set -uo pipefail

: "${BASE_URL:?BASE_URL required (e.g. https://preview.vercel.app)}"
BASE_URL="${BASE_URL%/}"
MUTATE="${MUTATE:-1}"

if ! command -v hey >/dev/null 2>&1; then
  echo "Install 'hey' first: brew install hey" >&2
  exit 1
fi

hdr() { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }

# ---------- Scenario 1: book release (booking POSTs) ----------
hdr "Scenario 1 — book release (50 concurrent submissions for 30s)"
if [[ "$MUTATE" == "1" && -n "${ARTIST_ID:-}" ]]; then
  payload=$(cat <<EOF
{"artist_id":"$ARTIST_ID","client_name":"LoadTest","client_email":"load+RAND@example.com","description":"automated load test","reference_urls":[]}
EOF
)
  # hey doesn't template per-request; we accept duplicate emails (DB allows).
  hey -z 30s -c 50 -m POST -T application/json -d "$payload" \
    "$BASE_URL/api/bookings"
  echo "↑ p99 latency, error rate, and req/s reported above."
  echo "  Targets: p99 < 3s, 100% 2xx, sustained ≥ 15 req/s"
else
  echo "skipped (set MUTATE=1 + ARTIST_ID to run; this writes to DB)"
fi

# ---------- Scenario 2: scheduling slot picker ----------
hdr "Scenario 2 — clients picking slots (100 concurrent for 30s)"
if [[ -n "${ARTIST_ID:-}" && -n "${LINK_ID:-}" ]]; then
  TODAY=$(date +%Y-%m-%d)
  hey -z 30s -c 100 \
    "$BASE_URL/api/schedule/$ARTIST_ID/$LINK_ID/slots?date=$TODAY"
  echo "  Targets: p99 < 2s, 100% 2xx. This route hits Google freeBusy — bottleneck if Google is slow."
else
  echo "skipped (need ARTIST_ID + LINK_ID)"
fi

# ---------- Scenario 3: artist-side availability ----------
hdr "Scenario 3 — artist-side availability fetch (20 concurrent for 30s)"
echo "(Authed endpoint — needs a valid AUTH_COOKIE. Skipping if not present.)"
if [[ -n "${AUTH_COOKIE:-}" ]]; then
  hey -z 30s -c 20 -H "Cookie: $AUTH_COOKIE" \
    "$BASE_URL/api/calendar/availability"
else
  echo "skipped (set AUTH_COOKIE to a valid sb-* cookie value)"
fi

# ---------- Scenario 4: public booking page render ----------
hdr "Scenario 4 — public booking page render (200 concurrent for 30s)"
if [[ -n "${ARTIST_SLUG:-}" ]]; then
  hey -z 30s -c 200 "$BASE_URL/$ARTIST_SLUG/book"
  echo "  Targets: p99 < 3s, 100% 2xx. This is the funnel page."
else
  echo "skipped (need ARTIST_SLUG)"
fi

# ---------- Scenario 5: check-slug burst ----------
hdr "Scenario 5 — slug-check burst (300 concurrent for 15s)"
hey -z 15s -c 300 "$BASE_URL/api/check-slug?slug=loadtest$(date +%s)"
echo "  Cheapest endpoint; tests baseline serverless concurrency."

# ---------- Cleanup hint ----------
hdr "Cleanup"
if [[ "$MUTATE" == "1" && -n "${ARTIST_ID:-}" ]]; then
  cat <<EOF
Run this against the test artist's DB to delete the load-test rows:
  DELETE FROM bookings
  WHERE artist_id = '$ARTIST_ID'
    AND client_name = 'LoadTest';
EOF
fi

echo "Done."
