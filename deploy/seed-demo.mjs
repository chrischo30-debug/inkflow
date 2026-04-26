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

const seed = [
  // ── Inquiry ──────────────────────────────────────────────────────────────────
  {
    state: "inquiry",
    client_name: "Maya Patel",
    client_email: "maya.p@example.com",
    client_phone: "+1 (415) 555-0123",
    description: "Fine-line moth, black ink only. Open to adding small dotwork texture around the wings if you think it'd work.",
    size: "Small (2–4\")",
    placement: "Forearm",
    budget: 350,
    reference_urls: [
      "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=800",
      "https://images.unsplash.com/photo-1542856391-010fb87dcfed?w=800",
    ],
    created_offset: -1,
  },
  {
    state: "inquiry",
    client_name: "Jordan Lee",
    client_email: "jordan.lee@example.com",
    client_phone: "+1 (917) 555-0144",
    description: "Sleeve continuation — existing waves on bicep, want to add koi swimming up toward the elbow. Full color, Japanese-influenced.",
    size: "Large (6–10\")",
    placement: "Forearm",
    budget: 1200,
    reference_urls: [
      "https://images.unsplash.com/photo-1568515045052-f9a854d70bfd?w=800",
    ],
    custom_answers: { color_preference: "Full color" },
    created_offset: 0,
  },
  {
    state: "inquiry",
    client_name: "Sam Rivera",
    client_email: "samr@example.com",
    client_phone: "+1 (646) 555-0181",
    description: "Matching minimalist mountains for me and my partner. Simple, clean — just the outline, no fill. Want them to be identical.",
    size: "Tiny (under 2\")",
    placement: "Ribs",
    budget: 200,
    reference_urls: [
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800",
      "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=800",
    ],
    created_offset: 0,
  },

  // ── Follow Up ─────────────────────────────────────────────────────────────────
  {
    state: "follow_up",
    client_name: "Eli Chen",
    client_email: "echen@example.com",
    client_phone: "+1 (510) 555-0167",
    description: "Floral half sleeve — peonies and lily of the valley, soft shading, no harsh outlines. Need a quote and rough timeline.",
    size: "Extra large (10\"+)",
    placement: "Arm",
    budget: 2500,
    reference_urls: [
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800",
      "https://images.unsplash.com/photo-1590246814883-57c511e54099?w=800",
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800",
    ],
    created_offset: -3,
  },
  {
    state: "follow_up",
    client_name: "Priya Shah",
    client_email: "priya.s@example.com",
    client_phone: "+1 (212) 555-0102",
    description: "Cover-up over a faded star. Something botanical — maybe a small cluster of wildflowers. Open to your ideas.",
    size: "Small (2–4\")",
    placement: "Shoulder",
    budget: 400,
    reference_urls: [
      "https://images.unsplash.com/photo-1542856391-010fb87dcfed?w=800",
    ],
    created_offset: -5,
  },

  // ── Sent Deposit ─────────────────────────────────────────────────────────────
  {
    state: "sent_deposit",
    client_name: "Marcus Webb",
    client_email: "marcus.w@example.com",
    client_phone: "+1 (718) 555-0119",
    description: "Black & grey ram skull, ornate but not overly dense. Open to adding small floral elements if it helps fill the space.",
    size: "Large (6–10\")",
    placement: "Thigh",
    budget: 850,
    reference_urls: [
      "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=800",
    ],
    total_amount: 850,
    stripe_payment_link_url: "https://buy.stripe.com/test_demo_link",
    created_offset: -7,
  },
  {
    state: "sent_deposit",
    client_name: "Tasha Kim",
    client_email: "tashak@example.com",
    client_phone: "+1 (347) 555-0188",
    description: "Snake wrapping around ankle, neo-traditional with bold outlines and limited color — maybe just red and yellow.",
    size: "Medium (4–6\")",
    placement: "Ankle",
    budget: 600,
    reference_urls: [
      "https://images.unsplash.com/photo-1568515045052-f9a854d70bfd?w=800",
      "https://images.unsplash.com/photo-1590246814883-57c511e54099?w=800",
    ],
    total_amount: 1200,
    created_offset: -6,
  },

  // ── Sent Calendar ─────────────────────────────────────────────────────────────
  {
    state: "sent_calendar",
    client_name: "Quinn Doyle",
    client_email: "qdoyle@example.com",
    client_phone: "+1 (415) 555-0173",
    description: "Matching daggers, kept very fine and minimal. No shading, just the line.",
    size: "Small (2–4\")",
    placement: "Arm",
    budget: 450,
    reference_urls: [
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800",
    ],
    total_amount: 450,
    deposit_paid: true,
    amount_paid: 100,
    created_offset: -9,
  },

  // ── Booked (future appointments) ─────────────────────────────────────────────
  {
    state: "booked",
    client_name: "Riley Thompson",
    client_email: "riley.t@example.com",
    client_phone: "+1 (213) 555-0190",
    description: "Lavender sprig with a bee landing on one of the flowers. Soft, illustrative style — not too graphic.",
    size: "Medium (4–6\")",
    placement: "Forearm",
    budget: 600,
    reference_urls: [
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800",
      "https://images.unsplash.com/photo-1590246814883-57c511e54099?w=800",
    ],
    appointment_date: day(7),
    total_amount: 600,
    deposit_paid: true,
    amount_paid: 100,
    created_offset: -12,
  },
  {
    state: "booked",
    client_name: "Noor Hassan",
    client_email: "noor.h@example.com",
    client_phone: "+1 (929) 555-0136",
    description: "Filling in negative space on existing sleeve — smoke wisps and small moths to tie the existing pieces together.",
    size: "Large (6–10\")",
    placement: "Arm",
    budget: 950,
    reference_urls: [],
    appointment_date: day(14),
    total_amount: 950,
    deposit_paid: true,
    amount_paid: 150,
    created_offset: -14,
  },
  {
    state: "booked",
    client_name: "Devon Brooks",
    client_email: "devonb@example.com",
    client_phone: "+1 (323) 555-0148",
    description: "Traditional swallow, full color, bold outlines. Classic Sailor Jerry vibe.",
    size: "Medium (4–6\")",
    placement: "Chest",
    budget: 500,
    reference_urls: [
      "https://images.unsplash.com/photo-1568515045052-f9a854d70bfd?w=800",
    ],
    appointment_date: day(21),
    total_amount: 500,
    deposit_paid: true,
    amount_paid: 100,
    created_offset: -10,
  },

  // ── Completed (past sessions) ─────────────────────────────────────────────────
  {
    state: "completed",
    client_name: "Aisha Brown",
    client_email: "aishab@example.com",
    client_phone: "+1 (404) 555-0162",
    description: "Botanical sleeve session 2 of 2 — finished color and shading, extended down to the hand.",
    size: "Extra large (10\"+)",
    placement: "Arm",
    budget: 2000,
    reference_urls: [
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800",
    ],
    appointment_date: day(-10),
    total_amount: 1100,
    tip_amount: 150,
    deposit_paid: true,
    amount_paid: 1100,
    completion_notes: "Healed beautifully on the first piece. She cried when she saw it finished. Send a check-in next week.",
    created_offset: -45,
  },
  {
    state: "completed",
    client_name: "Theo Garcia",
    client_email: "theog@example.com",
    client_phone: "+1 (305) 555-0177",
    description: "Memorial portrait of his grandmother — from a 1960s photograph. Black & grey realism.",
    size: "Large (6–10\")",
    placement: "Arm",
    budget: 900,
    reference_urls: [],
    appointment_date: day(-25),
    total_amount: 800,
    tip_amount: 100,
    deposit_paid: true,
    amount_paid: 800,
    completion_notes: "Very emotional sit. He wants heal photos in 2 weeks. Great client.",
    created_offset: -60,
  },

  // ── Rejected ──────────────────────────────────────────────────────────────────
  {
    state: "rejected",
    client_name: "Blake Morrison",
    client_email: "blakemorr@example.com",
    client_phone: "+1 (503) 555-0141",
    description: "Portrait of a celebrity (specific likeness request). Wants it photo-realistic.",
    size: "Medium (4–6\")",
    placement: "Back",
    budget: 150,
    reference_urls: [],
    created_offset: -20,
  },
];

const rows = seed.map((s) => {
  const created = new Date(); created.setDate(created.getDate() + (s.created_offset ?? 0));
  const { created_offset, ...rest } = s;
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
