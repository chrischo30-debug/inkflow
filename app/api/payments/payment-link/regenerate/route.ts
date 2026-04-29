import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdapter, readArtistPaymentConfig } from "@/lib/payments";
import { normalizePaymentLinks, type PaymentLink } from "@/lib/pipeline-settings";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id: unknown = body.id;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: artistRow } = await supabase
    .from("artists")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!artistRow) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const links = normalizePaymentLinks((artistRow as Record<string, unknown>).payment_links);
  const entry = links.find(l => l.id === id);
  if (!entry) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (typeof entry.amount_cents !== "number") {
    return NextResponse.json({ error: "Link is not a regenerable template" }, { status: 400 });
  }

  const config = readArtistPaymentConfig(artistRow as Record<string, unknown>);
  const adapter = getAdapter(config);
  if (!adapter) {
    return NextResponse.json({ error: "No payment provider connected" }, { status: 400 });
  }

  try {
    const created = await adapter.createGenericLink({
      label: entry.label,
      amountCents: entry.amount_cents,
    });

    const updated: PaymentLink[] = links.map(l =>
      l.id === id ? { ...l, url: created.url, provider: adapter.provider } : l,
    );
    await supabase.from("artists").update({ payment_links: updated }).eq("id", user.id);

    return NextResponse.json({ url: created.url, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment provider error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
