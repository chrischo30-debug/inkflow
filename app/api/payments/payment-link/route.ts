import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdapter, readArtistPaymentConfig } from "@/lib/payments";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const label: unknown = body.label;
  const amount_cents: unknown = body.amount_cents;

  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (typeof amount_cents !== "number" || amount_cents < 100) {
    return NextResponse.json({ error: "amount_cents must be at least 100" }, { status: 400 });
  }

  const { data: artistRow } = await supabase
    .from("artists")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!artistRow) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const config = readArtistPaymentConfig(artistRow as Record<string, unknown>);
  const adapter = getAdapter(config);
  if (!adapter) {
    return NextResponse.json({ error: "No payment provider connected" }, { status: 400 });
  }

  try {
    const created = await adapter.createGenericLink({
      label: label.trim(),
      amountCents: amount_cents,
    });
    return NextResponse.json({ url: created.url, provider: adapter.provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment provider error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
