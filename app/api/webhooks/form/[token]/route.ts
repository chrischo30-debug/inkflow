import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingState, StandardBookingField } from "@/lib/types";
import { sendInquiryAutoEmail } from "@/lib/inquiry-auto-email";

const STANDARD_FIELDS = new Set<StandardBookingField>([
  "client_name",
  "client_email",
  "client_phone",
  "description",
  "size",
  "placement",
  "budget",
]);

/** Flatten a nested object into dot-notation keys, or return top-level keys for shallow objects. */
function flattenPayload(obj: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    if (prefix) result[prefix] = String(obj ?? "");
    return result;
  }
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      Object.assign(result, flattenPayload(val, fullKey));
    } else {
      result[fullKey] = Array.isArray(val) ? val.join(", ") : String(val ?? "");
    }
  }
  return result;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: source, error: sourceErr } = await admin
    .from("webhook_sources")
    .select("id, artist_id, field_mappings, enabled")
    .eq("token", token)
    .single();

  if (sourceErr || !source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!source.enabled) {
    return NextResponse.json({ error: "Webhook source is disabled" }, { status: 403 });
  }

  // Parse body — support JSON and form-encoded
  let raw: Record<string, string>;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = await req.json();
      raw = flattenPayload(json);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  } else {
    // form-encoded or multipart — use formData
    try {
      const form = await req.formData();
      raw = {};
      for (const [k, v] of form.entries()) {
        raw[k] = typeof v === "string" ? v : v.name;
      }
    } catch {
      // Try text as query-string fallback
      const text = await req.text();
      raw = Object.fromEntries(new URLSearchParams(text));
    }
  }

  const mappings = (source.field_mappings ?? {}) as Record<string, string>;
  const booking: Record<string, unknown> = {
    artist_id: source.artist_id,
    state: "inquiry" as BookingState,
    reference_urls: [],
  };
  const customAnswers: Record<string, string> = {};

  for (const [incomingKey, rawValue] of Object.entries(raw)) {
    const value = rawValue.trim();
    if (!value) continue;

    const mappedTo = mappings[incomingKey];
    if (!mappedTo || mappedTo === "__skip__") {
      // Unmapped — store in custom_answers with original key
      customAnswers[incomingKey] = value;
    } else if (STANDARD_FIELDS.has(mappedTo as StandardBookingField)) {
      if (mappedTo === "budget") {
        const num = Number(value.replace(/[^0-9.]/g, ""));
        booking[mappedTo] = Number.isNaN(num) ? null : num;
      } else {
        booking[mappedTo] = value;
      }
    } else {
      // Mapped to a custom field key
      customAnswers[mappedTo] = value;
    }
  }

  if (!booking.client_name) booking.client_name = "External Submission";
  if (!booking.client_email) booking.client_email = "no-email-provided@example.com";

  booking.custom_answers = {
    ...customAnswers,
    _webhook_source_id: source.id,
  };

  const { data, error } = await admin
    .from("bookings")
    .insert(booking)
    .select("id")
    .single();

  if (error) {
    console.error("Webhook booking insert error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }

  sendInquiryAutoEmail({
    admin,
    artistId: source.artist_id,
    bookingId: data.id,
    clientName: String(booking.client_name ?? ""),
    clientEmail: String(booking.client_email ?? ""),
  }).catch(err => console.error("Inquiry auto-email failed:", err));

  return NextResponse.json({ success: true, bookingId: data.id }, { status: 201 });
}
