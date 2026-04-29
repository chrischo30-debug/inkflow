import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const HEADERS = [
  "Client name",
  "Client email",
  "Client phone",
  "First booking",
  "Last booking",
  "Total bookings",
  "Completed bookings",
  "Total revenue",
  "Total tips",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function isoToDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows, error } = await supabase
    .from("bookings")
    .select("client_name, client_email, client_phone, state, total_amount, tip_amount, created_at, appointment_date")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });

  type Row = {
    client_name: string;
    client_email: string;
    client_phone?: string | null;
    state: string;
    total_amount?: number | null;
    tip_amount?: number | null;
    created_at: string;
    appointment_date?: string | null;
  };

  // Group by lowercased email — keep the most recent name/phone.
  const byEmail = new Map<string, {
    name: string;
    email: string;
    phone: string | null;
    firstBooking: string;
    lastBooking: string;
    total: number;
    completed: number;
    revenue: number;
    tips: number;
  }>();

  for (const r of (rows ?? []) as Row[]) {
    if (!r.client_email) continue;
    const key = r.client_email.toLowerCase();
    const stamp = r.appointment_date ?? r.created_at;
    const existing = byEmail.get(key);
    if (existing) {
      existing.total += 1;
      if (r.state === "completed") existing.completed += 1;
      existing.revenue += r.total_amount ?? 0;
      existing.tips += r.tip_amount ?? 0;
      if (stamp < existing.firstBooking) existing.firstBooking = stamp;
      if (stamp > existing.lastBooking) existing.lastBooking = stamp;
      // Latest contact info wins (rows are pre-sorted desc by created_at).
      if (!existing.phone && r.client_phone) existing.phone = r.client_phone;
    } else {
      byEmail.set(key, {
        name: r.client_name,
        email: r.client_email,
        phone: r.client_phone ?? null,
        firstBooking: stamp,
        lastBooking: stamp,
        total: 1,
        completed: r.state === "completed" ? 1 : 0,
        revenue: r.total_amount ?? 0,
        tips: r.tip_amount ?? 0,
      });
    }
  }

  const clients = [...byEmail.values()].sort((a, b) => b.lastBooking.localeCompare(a.lastBooking));

  const lines = [HEADERS.map(csvCell).join(",")];
  for (const c of clients) {
    lines.push([
      c.name,
      c.email,
      c.phone,
      isoToDate(c.firstBooking),
      isoToDate(c.lastBooking),
      c.total,
      c.completed,
      c.revenue || "",
      c.tips || "",
    ].map(csvCell).join(","));
  }

  const csv = lines.join("\n") + "\n";
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flashbooker-clients-${stamp}.csv"`,
    },
  });
}
