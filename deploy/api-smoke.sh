#!/usr/bin/env bash
# FlashBooker API smoke test.
# Hits real endpoints and validates expected status codes / shapes.
#
# Usage:
#   ./deploy/api-smoke.sh https://your-preview-url.vercel.app
#   BASE_URL=https://... ARTIST_ID=... ARTIST_SLUG=... CRON_SECRET=... ./deploy/api-smoke.sh
#
# Required env to fully exercise the suite:
#   BASE_URL          — defaults to $1 or http://localhost:3000
#   ARTIST_ID         — uuid of a real test artist (for /api/bookings POST + webhooks/stripe)
#   ARTIST_SLUG       — slug for public booking page test
#   LINK_ID           — uuid of a scheduling link (for /schedule slots+request tests)
#   AUTH_COOKIE       — value of sb-* auth cookie for an authed-user test (skips authed checks if absent)
#   CRON_SECRET       — must match server's CRON_SECRET (skips cron auth checks if absent)
#
# Read-only by default. Set MUTATE=1 to allow POSTs that create rows
# (booking submission, scheduling request). Use a throwaway test artist.

set -uo pipefail

BASE_URL="${BASE_URL:-${1:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"
MUTATE="${MUTATE:-0}"

PASS=0
FAIL=0
SKIP=0

c_red() { printf "\033[31m%s\033[0m" "$1"; }
c_grn() { printf "\033[32m%s\033[0m" "$1"; }
c_ylw() { printf "\033[33m%s\033[0m" "$1"; }
hdr()   { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }
ok()    { c_grn "  PASS"; printf " — %s\n" "$1"; PASS=$((PASS+1)); }
bad()   { c_red "  FAIL"; printf " — %s\n" "$1"; FAIL=$((FAIL+1)); }
skip()  { c_ylw "  SKIP"; printf " — %s\n" "$1"; SKIP=$((SKIP+1)); }

# req METHOD PATH [DATA] [EXTRA_CURL_FLAGS...]
# Returns: status_code\nbody  (newline-separated)
req() {
  local method="$1" path="$2" data="${3:-}"; shift 3 || true
  local out status
  if [[ -n "$data" ]]; then
    out=$(curl -sS -o /tmp/.fb_body -w "%{http_code}" \
      -X "$method" -H "Content-Type: application/json" \
      "$@" -d "$data" "$BASE_URL$path")
  else
    out=$(curl -sS -o /tmp/.fb_body -w "%{http_code}" \
      -X "$method" "$@" "$BASE_URL$path")
  fi
  status="$out"
  printf "%s\n" "$status"
  cat /tmp/.fb_body 2>/dev/null
}

assert_status() {
  local label="$1" want="$2" got="$3"
  if [[ "$got" == "$want" ]]; then ok "$label → $got"; else bad "$label expected $want, got $got"; fi
}

echo "Target: $BASE_URL"
echo "Mutate: $MUTATE"

# ---------- middleware redirect (unauth → /login) ----------
hdr "Middleware redirects (unauthenticated)"
status=$(curl -sS -o /dev/null -w "%{http_code}" -I "$BASE_URL/")
assert_status "GET / unauth" "307" "$status"

status=$(curl -sS -o /dev/null -w "%{http_code}" -I "$BASE_URL/settings")
assert_status "GET /settings unauth" "307" "$status"

status=$(curl -sS -o /dev/null -w "%{http_code}" -I "$BASE_URL/admin")
assert_status "GET /admin unauth" "307" "$status"

# ---------- public marketing pages reachable ----------
hdr "Public pages (no auth required)"
for p in /login /signup /forgot-password /terms /privacy; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL$p")
  assert_status "GET $p" "200" "$status"
done

# ---------- public artist surface ----------
hdr "Public artist routes"
if [[ -n "${ARTIST_SLUG:-}" ]]; then
  for p in "/$ARTIST_SLUG/book" "/$ARTIST_SLUG/contact" "/$ARTIST_SLUG/newsletter"; do
    status=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL$p")
    # Acceptable: 200 (real artist) or 404 (not configured) — both prove no redirect
    if [[ "$status" == "200" || "$status" == "404" ]]; then ok "GET $p → $status"
    else bad "GET $p expected 200/404, got $status"; fi
  done
else
  skip "ARTIST_SLUG unset — public artist routes not tested"
fi

# ---------- /api/check-slug ----------
hdr "/api/check-slug"
out=$(req GET "/api/check-slug?slug=__definitely_taken_$(date +%s)__")
status=$(echo "$out" | head -1); body=$(echo "$out" | tail -n+2)
assert_status "check-slug random" "200" "$status"
echo "  body: $body"

# ---------- /api/bookings POST validation ----------
hdr "/api/bookings (public submission endpoint)"
# 400 on bad payload
out=$(req POST "/api/bookings" '{"not":"valid"}')
status=$(echo "$out" | head -1)
assert_status "POST /api/bookings rejects empty payload" "400" "$status"

# 400 on bad artist_id (not a real one)
out=$(req POST "/api/bookings" '{"artist_id":"not-a-real-id","client_name":"Test","client_email":"t@example.com"}')
status=$(echo "$out" | head -1)
if [[ "$status" == "400" || "$status" == "404" || "$status" == "500" ]]; then
  ok "POST /api/bookings unknown artist_id rejected ($status)"
else
  bad "POST /api/bookings unknown artist_id should fail, got $status"
fi

if [[ "$MUTATE" == "1" && -n "${ARTIST_ID:-}" ]]; then
  payload=$(printf '{"artist_id":"%s","client_name":"Smoke Test","client_email":"smoke+%s@example.com","description":"automated smoke","reference_urls":[]}' "$ARTIST_ID" "$(date +%s)")
  out=$(req POST "/api/bookings" "$payload")
  status=$(echo "$out" | head -1)
  assert_status "POST /api/bookings real submission" "200" "$status"
else
  skip "Real booking submission (set MUTATE=1 + ARTIST_ID to enable)"
fi

# ---------- authed APIs reject unauth ----------
hdr "Authed endpoints reject unauthenticated requests"
AUTHED_GETS=(
  /api/artist/profile
  /api/artist/scheduling-links
  /api/artist/booking-page
  /api/artist/payment-links
  /api/artist/blocked-dates
  /api/artist/email-templates
  /api/artist/auto-emails
  /api/artist/form-fields
  /api/artist/custom-form-fields
  /api/artist/calendar-list
  /api/artist/pipeline-settings
  /api/artist/external-keys
  /api/artist/webhook-sources
  /api/artist/contact-submissions
  /api/artist/contact-form
  /api/artist/form-settings
  /api/artist/books-status
  /api/artist/reminders
  /api/artist/kit-integration
  /api/artist/theme
  /api/calendar/events
  /api/calendar/availability
)
for p in "${AUTHED_GETS[@]}"; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL$p")
  # Middleware redirects unauthed → 307 to /login. Some routes may 401 directly.
  if [[ "$status" == "307" || "$status" == "401" ]]; then ok "$p unauth blocked ($status)"
  else bad "$p unauth expected 307/401, got $status"; fi
done

# ---------- admin endpoints ----------
hdr "Admin endpoints require superuser"
for p in /api/admin/impersonate /api/admin/reset-password /api/admin/delete-account; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL$p")
  if [[ "$status" == "401" || "$status" == "403" || "$status" == "307" ]]; then ok "$p unauth blocked ($status)"
  else bad "$p unauth expected 401/403/307, got $status"; fi
done

# ---------- cron auth ----------
hdr "Cron endpoint authorization"
status=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/api/reminders/send")
if [[ "$status" == "401" ]]; then
  ok "GET /api/reminders/send without secret → 401"
else
  bad "GET /api/reminders/send without secret expected 401, got $status (CRON_SECRET unset on server?)"
fi
if [[ -n "${CRON_SECRET:-}" ]]; then
  status=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/reminders/send")
  assert_status "GET /api/reminders/send with secret" "200" "$status"
else
  skip "CRON_SECRET unset locally — authorized cron call not tested"
fi

# ---------- Stripe webhook signature check ----------
hdr "Stripe webhook signature enforcement"
if [[ -n "${ARTIST_ID:-}" ]]; then
  status=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    "$BASE_URL/api/webhooks/stripe/$ARTIST_ID" \
    -d '{"type":"checkout.session.completed"}')
  assert_status "POST /api/webhooks/stripe/$ARTIST_ID without signature" "400" "$status"

  status=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" -H "stripe-signature: t=0,v1=deadbeef" \
    "$BASE_URL/api/webhooks/stripe/$ARTIST_ID" \
    -d '{"type":"checkout.session.completed"}')
  if [[ "$status" == "400" || "$status" == "500" ]]; then
    ok "POST stripe webhook with bogus signature rejected ($status)"
  else
    bad "Stripe webhook with bogus signature expected 400/500, got $status"
  fi
else
  skip "ARTIST_ID unset — Stripe webhook test skipped"
fi

# ---------- form webhook (per-source token) ----------
hdr "Form webhook unknown token"
status=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/webhooks/form/this-token-does-not-exist" -d '{}')
if [[ "$status" == "404" || "$status" == "401" || "$status" == "400" ]]; then
  ok "form webhook unknown token rejected ($status)"
else
  bad "form webhook unknown token expected 401/404, got $status"
fi

# ---------- public scheduling endpoints ----------
hdr "Public scheduling endpoints"
if [[ -n "${ARTIST_ID:-}" && -n "${LINK_ID:-}" ]]; then
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    "$BASE_URL/api/schedule/$ARTIST_ID/$LINK_ID/slots?date=$(date +%Y-%m-%d)")
  if [[ "$status" == "200" ]]; then ok "scheduling slots returns 200"; else bad "scheduling slots expected 200, got $status"; fi

  status=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    "$BASE_URL/api/schedule/$ARTIST_ID/$LINK_ID/request" -d '{"date":"bad","start":"bad","end":"bad"}')
  assert_status "scheduling request bad payload" "400" "$status"
else
  skip "ARTIST_ID/LINK_ID unset — scheduling endpoints not tested"
fi

# ---------- security headers ----------
hdr "Security response headers (informational)"
hdrs=$(curl -sSI "$BASE_URL/login")
for h in "strict-transport-security" "x-frame-options" "content-security-policy" "x-content-type-options" "referrer-policy"; do
  if echo "$hdrs" | grep -qi "^$h:"; then ok "header present: $h"; else skip "header missing: $h (consider adding via next.config.ts)"; fi
done

# ---------- Summary ----------
hdr "Summary"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  SKIP: $SKIP"
[[ $FAIL -gt 0 ]] && { c_red "Smoke FAILED."; echo; exit 1; }
c_grn "Smoke clean."; echo
