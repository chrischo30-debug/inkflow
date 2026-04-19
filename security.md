# security.md

## Never Print or Log
- Supabase service role key or anon key values
- User passwords or password hashes
- Authentication tokens or session tokens
- Client personal data (email, phone, full name) in server logs
- Raw database responses that may contain credentials
- Payment link URLs in plain console logs (these are sensitive)
- Google OAuth tokens or refresh tokens

## How to Handle Secrets
- All secrets stored in .env (never committed to GitHub)
- .env.example contains key names only — no values
- Supabase service role key: server-side only, never in browser bundles
- Google Calendar OAuth tokens: stored in Supabase, never exposed to client
- Resend API key: server-side only via lib/email.ts
- Access via process.env on server — never pass secrets as props or in API responses

## Never Put In Code
- Hardcoded API keys, tokens, or passwords anywhere in source files
- Hardcoded artist IDs or test user credentials
- Debug endpoints that expose DB contents or internal state
- Commented-out secrets or old keys
- console.log statements that print req.body when it contains user data

## App Security Checklist
- All dashboard and API routes require authenticated session — no exceptions
- Public routes: only the booking form ([artist-slug]) and auth pages
- All form input validated and sanitized server-side before saving to DB
- Database queries use Supabase parameterized queries — never string concatenation
- File uploads (reference images): validate type and size before storing
- Error messages shown to clients/users are always generic — never expose stack traces
- Row Level Security (RLS) enabled on all Supabase tables — artists only see their own data
- Payment links stored per-artist and only retrievable by that artist

## Before Every Commit
- Confirm .env is in .gitignore and not staged
- Run: git diff --cached | grep -i "key\|secret\|token\|password" to catch accidental inclusions
- Remove any debug console.logs that print user data or request bodies
- Verify no hardcoded IDs or credentials snuck into the diff
