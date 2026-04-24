import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";

/**
 * Provider-agnostic inbound email webhook.
 *
 * Accepts JSON payloads shaped like:
 *   { from: { email, name? } | string,
 *     to:   { email }[] | string[] | string,
 *     subject, text, html, messageId? }
 *
 * Resend's email.received event wraps the relevant fields under `data.*`, so
 * we look there first and then fall back to the top level. Postmark / SendGrid /
 * Mailgun can all be adapted with a small format-specific shim above `parsePayload`.
 *
 * Security: if INBOUND_WEBHOOK_SECRET is set, the request must carry a matching
 * header (x-webhook-secret or Authorization: Bearer). Most inbound providers
 * sign requests with SVIX-compatible headers; configure a provider-specific
 * verification step here before relying in production.
 */

const REPLIES_DOMAIN = process.env.FLASHBOOKER_REPLIES_DOMAIN || "replies.flashbooker.app";

function authOk(req: Request): boolean {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) return true;
  const headerSecret = req.headers.get("x-webhook-secret");
  if (headerSecret === secret) return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

interface Parsed {
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  providerId: string | null;
}

function parsePayload(raw: unknown): Parsed | null {
  if (!raw || typeof raw !== "object") return null;
  const outer = raw as Record<string, unknown>;
  const data = (outer.data && typeof outer.data === "object" ? outer.data : outer) as Record<string, unknown>;

  const from = data.from ?? data.sender;
  let fromEmail = "";
  let fromName: string | null = null;
  if (typeof from === "string") fromEmail = from;
  else if (from && typeof from === "object") {
    const obj = from as { email?: string; name?: string; address?: string };
    fromEmail = obj.email ?? obj.address ?? "";
    fromName = obj.name ?? null;
  }

  const toField = data.to ?? data.recipient ?? data.envelope ?? null;
  const toEmails: string[] = [];
  const collectTo = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string") { toEmails.push(v); return; }
    if (Array.isArray(v)) { v.forEach(collectTo); return; }
    if (typeof v === "object") {
      const obj = v as { email?: string; address?: string; to?: unknown };
      if (obj.email) toEmails.push(obj.email);
      else if (obj.address) toEmails.push(obj.address);
      else if (obj.to) collectTo(obj.to);
    }
  };
  collectTo(toField);

  if (!fromEmail || !toEmails.length) return null;

  return {
    fromEmail: String(fromEmail).trim(),
    fromName: fromName ? String(fromName).trim() : null,
    toEmails: toEmails.map(e => String(e).trim().toLowerCase()),
    subject: typeof data.subject === "string" ? data.subject : null,
    text: typeof data.text === "string" ? data.text : null,
    html: typeof data.html === "string" ? data.html : null,
    providerId: typeof data.id === "string" ? data.id : typeof data.messageId === "string" ? data.messageId : null,
  };
}

function extractBookingId(toEmails: string[]): string | null {
  for (const addr of toEmails) {
    const match = addr.match(/^reply-([a-f0-9-]{8,})@/i);
    if (!match) continue;
    const [local] = addr.split("@");
    const domain = addr.slice(local.length + 1);
    if (domain === REPLIES_DOMAIN.toLowerCase()) return match[1];
  }
  return null;
}

export async function POST(req: Request) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parsePayload(payload);
  if (!parsed) {
    return NextResponse.json({ error: "Unable to parse inbound payload" }, { status: 400 });
  }

  const bookingId = extractBookingId(parsed.toEmails);
  if (!bookingId) {
    // Mail went to a recipient we don't route — accept silently so provider doesn't retry
    console.warn("[inbound-email] No booking id found in To:", parsed.toEmails);
    return NextResponse.json({ ok: true, routed: false });
  }

  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, artist_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    console.warn("[inbound-email] Booking not found for id:", bookingId);
    return NextResponse.json({ ok: true, routed: false });
  }

  const { error: insertErr } = await supabase.from("inbox_messages").insert({
    artist_id: booking.artist_id,
    booking_id: booking.id,
    from_email: parsed.fromEmail,
    from_name: parsed.fromName,
    to_email: parsed.toEmails[0] ?? null,
    subject: parsed.subject,
    body_text: parsed.text,
    body_html: parsed.html,
    provider_id: parsed.providerId,
  });

  if (insertErr) {
    console.error("[inbound-email] Insert failed:", insertErr);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Flip the booking's unread flag so the dashboard surfaces it
  await supabase
    .from("bookings")
    .update({ has_unread_reply: true })
    .eq("id", booking.id);

  return NextResponse.json({ ok: true, routed: true, bookingId: booking.id });
}

// Allow provider verification probes (e.g. GET /health) without failing
export async function GET() {
  return NextResponse.json({ ok: true });
}
