import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const HEADERS = [
  "Booking ID",
  "Status",
  "Client name",
  "Client email",
  "Client phone",
  "Description",
  "Size",
  "Placement",
  "Budget",
  "Reference URLs",
  "Appointment date",
  "Session count",
  "Sessions completed",
  "Deposit paid",
  "Deposit link",
  "Total amount",
  "Tip amount",
  "Payment source",
  "Completion notes",
  "Submitted at",
  "Last updated",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value) ? value.join("; ") : String(value);
  // Escape quotes and wrap in quotes if value contains comma, quote, or newline.
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows, error } = await supabase
    .from("bookings")
    .select("id, state, client_name, client_email, client_phone, description, size, placement, budget, reference_urls, appointment_date, session_count, completed_session_count, deposit_paid, deposit_link_url, stripe_payment_link_url, total_amount, tip_amount, payment_source, completion_notes, created_at, updated_at")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });

  type Row = {
    id: string;
    state: string;
    client_name: string;
    client_email: string;
    client_phone?: string | null;
    description?: string | null;
    size?: string | null;
    placement?: string | null;
    budget?: number | null;
    reference_urls?: string[] | null;
    appointment_date?: string | null;
    session_count?: number | null;
    completed_session_count?: number | null;
    deposit_paid?: boolean | null;
    deposit_link_url?: string | null;
    stripe_payment_link_url?: string | null;
    total_amount?: number | null;
    tip_amount?: number | null;
    payment_source?: string | null;
    completion_notes?: string | null;
    created_at: string;
    updated_at: string;
  };

  const lines = [HEADERS.map(csvCell).join(",")];
  for (const r of (rows ?? []) as Row[]) {
    lines.push([
      r.id,
      r.state,
      r.client_name,
      r.client_email,
      r.client_phone,
      r.description,
      r.size,
      r.placement,
      r.budget,
      r.reference_urls,
      isoToLocal(r.appointment_date),
      r.session_count ?? 1,
      r.completed_session_count ?? 0,
      r.deposit_paid ? "Yes" : "No",
      r.deposit_link_url || r.stripe_payment_link_url,
      r.total_amount,
      r.tip_amount,
      r.payment_source,
      r.completion_notes,
      isoToLocal(r.created_at),
      isoToLocal(r.updated_at),
    ].map(csvCell).join(","));
  }

  const csv = lines.join("\n") + "\n";
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flashbooker-bookings-${stamp}.csv"`,
    },
  });
}
