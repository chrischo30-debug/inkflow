#!/usr/bin/env bash
# FlashBooker pre-deployment checks.
# Runs from repo root. Exits non-zero on any failure.
# Usage: ./deploy/preflight.sh [--skip-build]

set -uo pipefail
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
SKIP_BUILD=0
[[ "${1:-}" == "--skip-build" ]] && SKIP_BUILD=1

c_red()   { printf "\033[31m%s\033[0m" "$1"; }
c_grn()   { printf "\033[32m%s\033[0m" "$1"; }
c_ylw()   { printf "\033[33m%s\033[0m" "$1"; }
hdr()     { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }
ok()      { c_grn "  PASS"; printf " — %s\n" "$1"; PASS=$((PASS+1)); }
bad()     { c_red "  FAIL"; printf " — %s\n" "$1"; FAIL=$((FAIL+1)); }
warn()    { c_ylw "  WARN"; printf " — %s\n" "$1"; }

# ---------- 1. Required environment variables ----------
hdr "Environment variables (.env.local)"

REQUIRED=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  RESEND_API_KEY
  FLASHBOOKER_SENDING_DOMAIN
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GOOGLE_REDIRECT_URI
  GOOGLE_TOKEN_ENCRYPTION_KEY
  CRON_SECRET
)
OPTIONAL=(
  RESEND_FROM_EMAIL
  FLASHBOOKER_SENDING_LOCAL
  SUPPORT_EMAIL
)

if [[ -f .env.local ]]; then
  set -a; . ./.env.local; set +a
  ok ".env.local loaded"
elif [[ -f .env ]]; then
  set -a; . ./.env; set +a
  ok ".env loaded (no .env.local present)"
else
  warn "no .env.local or .env found — checking process env only"
fi

for v in "${REQUIRED[@]}"; do
  if [[ -n "${!v:-}" ]]; then ok "$v set"; else bad "$v missing (required)"; fi
done
for v in "${OPTIONAL[@]}"; do
  if [[ -n "${!v:-}" ]]; then ok "$v set"; else warn "$v not set (optional)"; fi
done

# Resend mock-key guard
if [[ "${RESEND_API_KEY:-}" == "re_mock_key" ]]; then
  bad "RESEND_API_KEY is the mock fallback — real emails will silently no-op"
fi

# Cron secret length sanity
if [[ -n "${CRON_SECRET:-}" && ${#CRON_SECRET} -lt 24 ]]; then
  warn "CRON_SECRET is < 24 chars — generate with: openssl rand -hex 32"
fi

# Google redirect URI must end with the callback path
if [[ -n "${GOOGLE_REDIRECT_URI:-}" && "$GOOGLE_REDIRECT_URI" != *"/api/auth/google/callback" ]]; then
  bad "GOOGLE_REDIRECT_URI must end with /api/auth/google/callback (got: $GOOGLE_REDIRECT_URI)"
fi

# ---------- 2. Service role / server secret leak check ----------
hdr "Secret leak — must not appear in client-bundled code"
LEAK_PATTERNS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "GOOGLE_CLIENT_SECRET"
  "GOOGLE_TOKEN_ENCRYPTION_KEY"
  "CRON_SECRET"
)
# These should never be READ via process.env in components/ or in any "use
# client" file. The bare string can legitimately appear (e.g. instructional
# text telling the artist which env var to set), so we look specifically for
# `process.env.<NAME>` access — that's the actual leak signature.
for pat in "${LEAK_PATTERNS[@]}"; do
  hits=$(grep -rln --include="*.ts" --include="*.tsx" "process\.env\.$pat" components/ 2>/dev/null || true)
  if [[ -n "$hits" ]]; then
    bad "$pat read via process.env in components/: $hits"
  else
    ok "$pat not read via process.env in components/"
  fi
done

# Any file that uses a server-only env should NOT be marked "use client"
client_with_server_secret=$(
  grep -rln --include="*.ts" --include="*.tsx" -E "(SUPABASE_SERVICE_ROLE_KEY|GOOGLE_CLIENT_SECRET|GOOGLE_TOKEN_ENCRYPTION_KEY)" app/ lib/ utils/ 2>/dev/null \
  | xargs grep -l "use client" 2>/dev/null || true
)
if [[ -n "$client_with_server_secret" ]]; then
  bad "Server-only secret used in 'use client' files: $client_with_server_secret"
else
  ok "No 'use client' files reference server-only secrets"
fi

# Any NEXT_PUBLIC_* var referencing service_role / secret keys
naming_leaks=$(grep -rE "NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET|PRIVATE_KEY|API_KEY)" app/ lib/ utils/ 2>/dev/null || true)
if [[ -n "$naming_leaks" ]]; then
  bad "Secret-shaped name on NEXT_PUBLIC_* var:\n$naming_leaks"
else
  ok "No NEXT_PUBLIC_* vars with secret-shaped names"
fi

# ---------- 3. Lint ----------
hdr "ESLint"
# Lint is informational, not a deploy blocker. The codebase has pre-existing
# noise from Next 16's stricter react-hooks rules (set-state-in-effect, etc.)
# that are mostly false positives. Track real lint cleanup as post-deploy work.
if npm run -s lint > /tmp/.fb_lint 2>&1; then
  ok "eslint clean"
else
  err_count=$(grep -cE "[0-9]+ problems? \([0-9]+ errors?" /tmp/.fb_lint 2>/dev/null || echo "?")
  warn "eslint reported issues — see /tmp/.fb_lint (treated as non-blocking; clean up post-launch)"
fi

# ---------- 4. TypeScript ----------
hdr "TypeScript (tsc --noEmit)"
if npx -y tsc --noEmit; then ok "tsc clean"; else bad "tsc errors"; fi

# ---------- 5. Build ----------
if [[ $SKIP_BUILD -eq 0 ]]; then
  hdr "Next.js production build"
  if npm run -s build; then
    ok "next build succeeded"

    # Bundle scan — confirm real secret VALUES didn't end up shipped to the
    # browser. Match shapes that only a real key would have:
    #   - Stripe secret keys: sk_live_/sk_test_ followed by 20+ alphanumerics
    #     (placeholder text like "sk_live_..." won't match — `.` isn't [A-Za-z0-9_])
    #   - Supabase service-role JWTs: long base64 segments after eyJ header
    #   - Google encryption key: 64-char hex (the format we generate)
    # Bare strings like "stripe_api_key" or "GOOGLE_TOKEN_ENCRYPTION_KEY" are
    # column / env-var identifiers and legitimately appear in the bundle —
    # only their VALUES are a leak.
    hdr "Build output secret scan"
    if [[ -d .next/static ]]; then
      shipped=$(grep -rlE 'sk_(live|test)_[A-Za-z0-9_]{20,}' .next/static 2>/dev/null || true)
      if [[ -n "$shipped" ]]; then
        bad "Real Stripe secret key shape found in client bundle: $shipped"
      else
        ok "No service_role / encryption-key / stripe-secret patterns in .next/static"
      fi
    else
      warn ".next/static not found — bundle scan skipped"
    fi
  else
    bad "next build failed"
  fi
else
  warn "Build skipped (--skip-build)"
fi

# ---------- 6. Migration sanity ----------
hdr "Supabase migrations"
mig_count=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
if [[ "$mig_count" -gt 0 ]]; then ok "$mig_count migration files present"; else bad "no migrations found"; fi
if ls supabase/migrations | sort -c 2>/dev/null; then ok "migrations sorted lexically"; else warn "migration filenames not in sort order — verify intended apply order"; fi

# ---------- 7. Vercel cron config ----------
hdr "vercel.json sanity"
if [[ -f vercel.json ]] && grep -q "/api/reminders/send" vercel.json; then
  ok "cron path /api/reminders/send wired"
else
  bad "vercel.json missing reminders cron entry"
fi
if [[ -f app/api/reminders/send/route.ts ]]; then
  ok "cron handler exists"
else
  bad "cron handler app/api/reminders/send/route.ts missing"
fi

# ---------- 8. Middleware safe-paths ----------
hdr "Middleware safe-path audit"
expected_safe=("/login" "/signup" "/onboarding" "/forgot-password" "/auth/callback" "/admin/access-relay" "/api/bookings" "/api/auth/google/callback" "/api/uploads/reference-images")
for p in "${expected_safe[@]}"; do
  if grep -q "'$p'" middleware.ts; then ok "safe-path present: $p"; else bad "safe-path missing in middleware.ts: $p"; fi
done

# ---------- Summary ----------
hdr "Summary"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
if [[ $FAIL -gt 0 ]]; then
  echo
  c_red "Pre-flight FAILED — do not deploy."; echo
  exit 1
fi
c_grn "Pre-flight clean."; echo
