// One-shot demo seeder.
// Usage: node deploy/seed-demo.mjs <artist-email>
// Requires .env with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load .env (no dotenv dep)
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const email = process.argv[2];
if (!email) { console.error("Usage: node deploy/seed-demo.mjs <email>"); process.exit(1); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing Supabase env"); process.exit(1); }

const admin = createClient(url, key, { auth: { persistSession: false } });

// 1. find auth user
let userId = null;
let page = 1;
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  const u = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (u) { userId = u.id; break; }
  if (data.users.length < 200) break;
  page++;
}
if (!userId) { console.error(`No auth user with email ${email}`); process.exit(2); }

// 2. confirm artist row
const { data: artist, error: artistErr } = await admin
  .from("artists").select("id, name, slug").eq("id", userId).single();
if (artistErr || !artist) { console.error("No artist row:", artistErr); process.exit(3); }
console.log(`Found artist: ${artist.name} (${artist.slug}) — ${artist.id}`);

const day = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(13, 0, 0, 0);
  return d.toISOString();
};
const dayStr = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const seed = [
  // Submission (inquiry)
  { state: "inquiry", client_name: "Maya Patel", client_email: "maya.p@example.com", client_phone: "+1 (415) 555-0123",
    description: "Small fine-line moth on inner forearm, palm-sized, black ink only.", ideal_date: "Late May or early June", created_offset: -1 },
  { state: "inquiry", client_name: "Jordan Lee", client_email: "jordan.lee@example.com", client_phone: "+1 (917) 555-0144",
    description: "Sleeve continuation — existing waves on bicep, want to add koi swimming up the forearm. Color.", ideal_date: "Flexible", created_offset: 0 },
  { state: "inquiry", client_name: "Sam Rivera", client_email: "samr@example.com", client_phone: "+1 (646) 555-0181",
    description: "Quote please for matching minimalist mountains, two pieces (me + partner), 2in tall, ribcage placement.", ideal_date: "June anniversary trip", created_offset: 0 },

  // Follow Up
  { state: "follow_up", client_name: "Eli Chen", client_email: "echen@example.com", client_phone: "+1 (510) 555-0167",
    description: "Floral half sleeve, want peonies + lily of the valley. Looking for quote and timeline. Sent reference pics.",
    ideal_date: "This summer", created_offset: -3 },
  { state: "follow_up", client_name: "Priya Shah", client_email: "priya.s@example.com", client_phone: "+1 (212) 555-0102",
    description: "Cover-up over a faded star on shoulder blade. ~3in. Want something botanical.", ideal_date: "ASAP", created_offset: -5 },

  // Accepted
  { state: "accepted", client_name: "Marcus Webb", client_email: "marcus.w@example.com", client_phone: "+1 (718) 555-0119",
    description: "Black & grey ram skull on outer thigh, ~6in, ornate but not too dense.", ideal_date: "May", created_offset: -7,
    total_amount: 850 },
  { state: "accepted", client_name: "Tasha Kim", client_email: "tashak@example.com", client_phone: "+1 (347) 555-0188",
    description: "Snake wrapping around ankle, neo-traditional, 2 sessions estimated.", ideal_date: "June", created_offset: -6,
    total_amount: 1200 },

  // Sent Deposit
  { state: "deposit_sent", client_name: "Ben Aronson", client_email: "ben.a@example.com", client_phone: "+1 (310) 555-0155",
    description: "Geometric wolf on calf, half color half line work, ~5in.", ideal_date: "Late May", created_offset: -8,
    total_amount: 700, stripe_payment_link_url: "https://buy.stripe.com/test_demo_link" },

  // Sent Calendar
  { state: "paid_calendar_link_sent", client_name: "Quinn Doyle", client_email: "qdoyle@example.com", client_phone: "+1 (415) 555-0173",
    description: "Two matching small daggers on inner biceps, fine line.", ideal_date: "May–June", created_offset: -9,
    total_amount: 450, deposit_paid: true, amount_paid: 100 },

  // Booked (future appointment)
  { state: "confirmed", client_name: "Riley Thompson", client_email: "riley.t@example.com", client_phone: "+1 (213) 555-0190",
    description: "Half-day session: lavender + bee on forearm, color.", appointment_date: day(7), created_offset: -12,
    total_amount: 600, deposit_paid: true, amount_paid: 100 },
  { state: "confirmed", client_name: "Noor Hassan", client_email: "noor.h@example.com", client_phone: "+1 (929) 555-0136",
    description: "Continuation of sleeve — fill in negative space with smoke + small moths.", appointment_date: day(14), created_offset: -14,
    total_amount: 950, deposit_paid: true, amount_paid: 150 },
  { state: "confirmed", client_name: "Devon Brooks", client_email: "devonb@example.com", client_phone: "+1 (323) 555-0148",
    description: "Single sitting: traditional swallow on chest, full color.", appointment_date: day(21), created_offset: -10,
    total_amount: 500, deposit_paid: true, amount_paid: 100 },

  // Completed (past)
  { state: "completed", client_name: "Aisha Brown", client_email: "aishab@example.com", client_phone: "+1 (404) 555-0162",
    description: "Botanical sleeve session 2 of 2 — finished color and shading on hand.", appointment_date: day(-10), created_offset: -45,
    total_amount: 1100, deposit_paid: true, amount_paid: 1100, tip_amount: 150,
    completion_notes: "Healed beautifully on first piece, came back for the second. Send check-in next week." },
  { state: "completed", client_name: "Theo Garcia", client_email: "theog@example.com", client_phone: "+1 (305) 555-0177",
    description: "Memorial portrait — grandmother, black & grey, upper arm.", appointment_date: day(-25), created_offset: -60,
    total_amount: 800, deposit_paid: true, amount_paid: 800, tip_amount: 100,
    completion_notes: "Very emotional sit. Reach out for heal photos." },
];

const rows = seed.map((s) => {
  const created = new Date(); created.setDate(created.getDate() + (s.created_offset ?? 0));
  const { created_offset, ideal_date, ...rest } = s;
  void ideal_date; // column dropped; kept in seed dataset for reference only
  return {
    artist_id: artist.id,
    deposit_paid: false,
    payment_failed: false,
    has_unread_reply: false,
    sent_emails: [],
    ...rest,
    created_at: created.toISOString(),
    updated_at: created.toISOString(),
  };
});

// Avoid duplicate inserts on re-run: delete prior demo rows by matching emails
const demoEmails = rows.map(r => r.client_email);
const { error: delErr, count: deletedCount } = await admin
  .from("bookings").delete({ count: "exact" })
  .eq("artist_id", artist.id).in("client_email", demoEmails);
if (delErr) console.warn("Cleanup warning:", delErr.message);
else if (deletedCount) console.log(`Cleared ${deletedCount} prior demo rows.`);

const { data: inserted, error } = await admin.from("bookings").insert(rows).select("id, state");
if (error) { console.error("Insert failed:", error); process.exit(4); }

const counts = inserted.reduce((m, r) => (m[r.state] = (m[r.state] || 0) + 1, m), {});
console.log(`\nInserted ${inserted.length} bookings:`);
for (const [state, n] of Object.entries(counts).sort()) console.log(`  ${state}: ${n}`);
