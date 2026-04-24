import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import type { BookingState } from "@/lib/types";

const VALID_STATES: BookingState[] = [
  "inquiry", "follow_up", "accepted", "confirmed", "completed", "rejected", "cancelled",
];

interface ImportRow {
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  description?: string;
  size?: string;
  placement?: string;
  budget?: string | number;
  state?: string;
  appointment_date?: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookings } = (await req.json()) as { bookings: ImportRow[] };
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return NextResponse.json({ error: "No bookings provided" }, { status: 400 });
  }

  const errors: string[] = [];
  const rows = [];

  for (let i = 0; i < bookings.length; i++) {
    const row = bookings[i];
    if (!row.client_name?.trim()) {
      errors.push(`Row ${i + 1}: name is required`);
      continue;
    }
    const state: BookingState = VALID_STATES.includes(row.state as BookingState)
      ? (row.state as BookingState)
      : "inquiry";
    const budget =
      row.budget !== undefined && row.budget !== ""
        ? Number(row.budget) || null
        : null;

    rows.push({
      artist_id: user.id,
      client_name: row.client_name.trim(),
      client_email: row.client_email?.trim() || "no-email-provided@example.com",
      client_phone: row.client_phone?.trim() || null,
      description: row.description?.trim() || "",
      size: row.size?.trim() || null,
      placement: row.placement?.trim() || null,
      budget,
      state,
      appointment_date: row.appointment_date?.trim() || null,
      reference_urls: [],
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ created: 0, errors });
  }

  const { data: inserted, error } = await supabase.from("bookings").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (inserted ?? []).map((r: { id: string }) => r.id);
  return NextResponse.json({ created: rows.length, ids, errors });
}
