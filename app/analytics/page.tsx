import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import type { Booking } from "@/lib/types";

// ─── Types passed to client ──────────────────────────────────────────────────
export type MonthlyPoint = { key: string; label: string; revenue: number; bookings: number };
export type DistItem = { name: string; count: number; revenue?: number };
export type StateItem = { state: string; label: string; count: number };
export type StripeCharge = { month: string; amount: number };

export type RecentPayment = {
  id: string;
  clientName: string;
  sessionType: string;
  amount: number;
  net: number | null; // after Stripe fees
  status: string;
  date: string;
};

export type AnalyticsData = {
  totalRevenue: number;
  totalTips: number;
  totalBookings: number;
  totalClients: number;
  completedCount: number;
  conversionRate: number;
  avgPrice: number;
  avgBudget: number;
  returningClients: number;
  monthlyData: MonthlyPoint[];
  stateData: StateItem[];
  placements: DistItem[];
  sizes: DistItem[];
  requestTypes: DistItem[];
  stripeRevenue: number | null;
  stripeCount: number | null;
  stripeMonthly: StripeCharge[] | null;
  // Payment-link metrics
  stripeThisMonth: number | null;
  stripeLastMonth: number | null;
  stripeOutstanding: number;
  stripeConversionRate: number | null;
  stripeRecentPayments: RecentPayment[];
  // Period-scoped KPI values
  revenueThisMonth: number;
  revenueThisYear: number;
  clientsThisMonth: number;
  clientsThisYear: number;
  sessionsThisMonth: number;
  sessionsThisYear: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en", { month: "short", year: "2-digit" });
}

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function last12MonthKeys(): string[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}


// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const [{ data: bookingsRaw }, { data: artistRaw }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, client_email, client_name, state, appointment_date, created_at, total_amount, tip_amount, budget, placement, size, description, deposit_paid, amount_paid, stripe_payment_id")
      .eq("artist_id", user.id),
    supabase
      .from("artists")
      .select("stripe_api_key")
      .eq("id", user.id)
      .single(),
  ]);

  type BookingRow = Pick<Booking,
    "id" | "client_email" | "state" | "appointment_date" | "created_at" | "total_amount" | "tip_amount" | "budget" | "placement" | "size" | "description"
  > & {
    client_name?: string | null;
    deposit_paid?: boolean | null;
    amount_paid?: number | null;
    stripe_payment_id?: string | null;
  };
  const bookings = (bookingsRaw ?? []) as BookingRow[];

  const artist = artistRaw as { stripe_api_key?: string } | null;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const completed = bookings.filter(b => b.state === "completed");
  const totalRevenue = completed.reduce((s, b) => s + (b.total_amount ?? 0), 0);
  const totalTips = completed.reduce((s, b) => s + (b.tip_amount ?? 0), 0);
  const completedCount = completed.length;
  const avgPrice = completedCount > 0 ? totalRevenue / completedCount : 0;

  const withBudget = bookings.filter(b => b.budget && Number(b.budget) > 0);
  const avgBudget = withBudget.length > 0
    ? withBudget.reduce((s, b) => s + Number(b.budget), 0) / withBudget.length
    : 0;

  // Unique clients
  const emailSet = new Set(bookings.map(b => b.client_email.toLowerCase()));
  const totalClients = emailSet.size;

  // Returning clients (>1 booking)
  const emailCount: Record<string, number> = {};
  for (const b of bookings) {
    const k = b.client_email.toLowerCase();
    emailCount[k] = (emailCount[k] ?? 0) + 1;
  }
  const returningClients = Object.values(emailCount).filter(n => n > 1).length;

  // Conversion rate: completed / (completed + rejected + cancelled)
  const terminal = bookings.filter(b => ["completed", "rejected", "cancelled"].includes(b.state)).length;
  const conversionRate = terminal > 0 ? (completedCount / terminal) * 100 : 0;

  // ── Monthly data (last 12 months) ─────────────────────────────────────────
  const keys = last12MonthKeys();
  const revByMonth: Record<string, number> = {};
  const cntByMonth: Record<string, number> = {};
  for (const b of bookings) {
    const key = monthKey(b.appointment_date ?? b.created_at);
    if (keys.includes(key)) {
      cntByMonth[key] = (cntByMonth[key] ?? 0) + 1;
    }
  }
  for (const b of completed) {
    const key = monthKey(b.appointment_date ?? b.created_at);
    if (keys.includes(key)) {
      revByMonth[key] = (revByMonth[key] ?? 0) + (b.total_amount ?? 0) + (b.tip_amount ?? 0);
    }
  }
  const monthlyData: MonthlyPoint[] = keys.map(k => ({
    key: k,
    label: monthLabel(k),
    revenue: revByMonth[k] ?? 0,
    bookings: cntByMonth[k] ?? 0,
  }));

  // ── State distribution ────────────────────────────────────────────────────
  const STATE_LABELS: Record<string, string> = {
    inquiry:   "Submissions",
    follow_up: "Follow Up",
    accepted:  "Accepted",
    confirmed: "Booked",
    completed: "Completed",
    rejected:  "Rejected",
    cancelled: "Cancelled",
  };
  const stateCounts: Record<string, number> = {};
  for (const b of bookings) stateCounts[b.state] = (stateCounts[b.state] ?? 0) + 1;
  const stateData: StateItem[] = Object.entries(stateCounts)
    .map(([state, count]) => ({ state, label: STATE_LABELS[state] ?? state, count }))
    .sort((a, b) => b.count - a.count);

  // ── Placement distribution (with revenue from completed bookings) ────────
  const placementCounts: Record<string, number> = {};
  const placementRevenue: Record<string, number> = {};
  for (const b of bookings) {
    if (b.placement?.trim()) {
      const k = normalise(b.placement);
      placementCounts[k] = (placementCounts[k] ?? 0) + 1;
      if (b.state === "completed") {
        placementRevenue[k] = (placementRevenue[k] ?? 0) + (b.total_amount ?? 0) + (b.tip_amount ?? 0);
      }
    }
  }
  const placements: DistItem[] = Object.entries(placementCounts)
    .map(([name, count]) => ({ name, count, revenue: placementRevenue[name] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // ── Size distribution (with revenue from completed bookings) ─────────────
  const sizeCounts: Record<string, number> = {};
  const sizeRevenue: Record<string, number> = {};
  for (const b of bookings) {
    if (b.size?.trim()) {
      const k = normalise(b.size);
      sizeCounts[k] = (sizeCounts[k] ?? 0) + 1;
      if (b.state === "completed") {
        sizeRevenue[k] = (sizeRevenue[k] ?? 0) + (b.total_amount ?? 0) + (b.tip_amount ?? 0);
      }
    }
  }
  const sizes: DistItem[] = Object.entries(sizeCounts)
    .map(([name, count]) => ({ name, count, revenue: sizeRevenue[name] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // ── Request types (keyword matching over description) ────────────────────
  const REQUEST_KEYWORDS: { label: string; patterns: RegExp[] }[] = [
    { label: "Floral / Botanical", patterns: [/\b(flower|floral|rose|peony|botanical|leaf|leaves|plant|vine|bouquet)\b/i] },
    { label: "Animal", patterns: [/\b(animal|wolf|lion|tiger|cat|dog|bird|snake|dragon|fox|bear|horse|deer|fish)\b/i] },
    { label: "Portrait", patterns: [/\b(portrait|face|figure)\b/i] },
    { label: "Script / Lettering", patterns: [/\b(script|lettering|text|quote|word|name|calligraphy|typography)\b/i] },
    { label: "Geometric", patterns: [/\b(geometric|mandala|sacred geometry|pattern|shape|triangle|hexagon)\b/i] },
    { label: "Traditional", patterns: [/\b(traditional|american traditional|old school|neo[- ]?traditional)\b/i] },
    { label: "Japanese / Irezumi", patterns: [/\b(japanese|irezumi|koi|oni|samurai|geisha|hannya)\b/i] },
    { label: "Blackwork", patterns: [/\b(blackwork|black ?work|solid black)\b/i] },
    { label: "Fine Line", patterns: [/\b(fine ?line|fineline|delicate|thin line|micro)\b/i] },
    { label: "Realism", patterns: [/\b(realism|realistic|photo[- ]?real|hyper[- ]?real)\b/i] },
    { label: "Minimalist", patterns: [/\b(minimal|minimalist|simple|tiny|small)\b/i] },
    { label: "Color", patterns: [/\b(color|colour|watercolor|watercolour|vibrant)\b/i] },
    { label: "Skull / Dark", patterns: [/\b(skull|skeleton|death|dark|gothic|occult)\b/i] },
    { label: "Celestial", patterns: [/\b(moon|sun|star|celestial|galaxy|cosmic|space|planet)\b/i] },
    { label: "Memorial / Tribute", patterns: [/\b(memorial|tribute|in memory|rip|remembrance)\b/i] },
    { label: "Cover-up", patterns: [/\b(cover[- ]?up|coverup|rework)\b/i] },
  ];

  const requestCounts: Record<string, number> = {};
  const requestRevenue: Record<string, number> = {};
  for (const b of bookings) {
    const desc = b.description?.trim();
    if (!desc) continue;
    const matched = new Set<string>();
    for (const { label, patterns } of REQUEST_KEYWORDS) {
      if (patterns.some(p => p.test(desc))) matched.add(label);
    }
    for (const label of matched) {
      requestCounts[label] = (requestCounts[label] ?? 0) + 1;
      if (b.state === "completed") {
        requestRevenue[label] = (requestRevenue[label] ?? 0) + (b.total_amount ?? 0) + (b.tip_amount ?? 0);
      }
    }
  }
  const requestTypes: DistItem[] = Object.entries(requestCounts)
    .map(([name, count]) => ({ name, count, revenue: requestRevenue[name] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── Stripe ────────────────────────────────────────────────────────────────
  let stripeRevenue: number | null = null;
  let stripeCount: number | null = null;
  let stripeMonthly: StripeCharge[] | null = null;
  let stripeThisMonth: number | null = null;
  let stripeLastMonth: number | null = null;
  let stripeRecentPayments: RecentPayment[] = [];

  const stripeKey = (artist as { stripe_api_key?: string | null } | null)?.stripe_api_key;
  if (stripeKey) {
    const paidBookings = bookings.filter(b => b.deposit_paid);

    if (paidBookings.length > 0) {
      // Primary path: compute from DB deposit records (FlashBooker deposits only)
      const now = new Date();
      const thisMonthKey = monthKey(now.toISOString());
      const lastMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString());

      let revenue = 0;
      let thisMonth = 0;
      let lastMonth = 0;
      const byMonth: Record<string, number> = {};

      for (const b of paidBookings) {
        const dollars = (b.amount_paid ?? 0) / 100;
        revenue += dollars;
        const k = monthKey((b.appointment_date ?? b.created_at)!);
        byMonth[k] = (byMonth[k] ?? 0) + dollars;
        if (k === thisMonthKey) thisMonth += dollars;
        if (k === lastMonthKey) lastMonth += dollars;
      }

      // For bookings missing amount_paid, fetch from Stripe using stored payment intent ID
      const recent = [...paidBookings]
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        .slice(0, 20);

      const amountById: Record<string, number> = {};
      const netById: Record<string, number> = {};
      const needsStripe = paidBookings.filter(b => b.stripe_payment_id && !b.amount_paid);

      if (needsStripe.length > 0) {
        try {
          const Stripe = (await import("stripe")).default;
          const stripe = new Stripe(stripeKey);
          await Promise.all(needsStripe.map(async b => {
            try {
              const pi = await stripe.paymentIntents.retrieve(b.stripe_payment_id!, {
                expand: ["latest_charge.balance_transaction"],
              });
              amountById[b.stripe_payment_id!] = pi.amount / 100;
              const charge = pi.latest_charge;
              if (charge && typeof charge !== "string") {
                const bt = (charge as { balance_transaction?: unknown }).balance_transaction;
                if (bt != null && typeof bt !== "string" && typeof bt === "object" && "net" in bt) {
                  netById[b.stripe_payment_id!] = (bt as { net: number }).net / 100;
                }
              }
            } catch { /* ignore */ }
          }));
          // Add Stripe-fetched amounts into totals
          for (const b of needsStripe) {
            if (b.stripe_payment_id && amountById[b.stripe_payment_id]) {
              const dollars = amountById[b.stripe_payment_id];
              revenue += dollars;
              const k = monthKey((b.appointment_date ?? b.created_at)!);
              byMonth[k] = (byMonth[k] ?? 0) + dollars;
              if (k === thisMonthKey) thisMonth += dollars;
              if (k === lastMonthKey) lastMonth += dollars;
            }
          }
        } catch { /* ignore */ }
      }

      stripeMonthly = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }));

      stripeRecentPayments = recent.map(b => {
        const stripeAmount = b.stripe_payment_id ? (amountById[b.stripe_payment_id] ?? null) : null;
        return {
          id: b.id,
          clientName: b.client_name ?? "—",
          sessionType: b.description?.slice(0, 60) ?? "—",
          amount: b.amount_paid ? b.amount_paid / 100 : (stripeAmount ?? 0),
          net: b.stripe_payment_id ? (netById[b.stripe_payment_id] ?? null) : null,
          status: "succeeded",
          date: b.created_at!,
        };
      });

      stripeRevenue = revenue;
      stripeCount = paidBookings.length;
      stripeThisMonth = thisMonth;
      stripeLastMonth = lastMonth;
    } else {
      // Fallback: no webhook deposits in DB yet — pull from Stripe charges API
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey);
        const charges = await stripe.charges.list({ limit: 100, expand: ["data.balance_transaction"] });
        const successful = charges.data.filter(c => c.status === "succeeded" && !c.refunded);

        const now = new Date();
        const thisMonthKey = monthKey(now.toISOString());
        const lastMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString());

        let revenue = 0;
        let thisMonth = 0;
        let lastMonth = 0;
        const byMonth: Record<string, number> = {};

        for (const c of successful) {
          const dollars = c.amount / 100;
          revenue += dollars;
          const k = monthKey(new Date(c.created * 1000).toISOString());
          byMonth[k] = (byMonth[k] ?? 0) + dollars;
          if (k === thisMonthKey) thisMonth += dollars;
          if (k === lastMonthKey) lastMonth += dollars;
        }

        stripeMonthly = Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, amount]) => ({ month, amount }));

        stripeRecentPayments = successful.slice(0, 20).map(c => {
          const bt = c.balance_transaction;
          const net = (bt != null && typeof bt !== "string") ? bt.net / 100 : null;
          return {
            id: c.id,
            clientName: (c.metadata?.client_name as string | undefined) ?? (c.billing_details?.name ?? "—"),
            sessionType: (c.metadata?.session_type as string | undefined) ?? (c.description ?? "—"),
            amount: c.amount / 100,
            net,
            status: c.status,
            date: new Date(c.created * 1000).toISOString(),
          };
        });

        stripeRevenue = revenue;
        stripeCount = successful.length;
        stripeThisMonth = thisMonth;
        stripeLastMonth = lastMonth;
      } catch { /* ignore */ }
    }
  }

  // ── Period-scoped KPI values ──────────────────────────────────────────────
  const nowDate = new Date();
  const currentMonthKey = monthKey(nowDate.toISOString());
  const currentYearStr = String(nowDate.getFullYear());

  const revenueThisMonthBookings = completed.reduce((s, b) => {
    const k = monthKey(b.appointment_date ?? b.created_at);
    return k === currentMonthKey ? s + (b.total_amount ?? 0) + (b.tip_amount ?? 0) : s;
  }, 0);
  const revenueThisYearBookings = completed.reduce((s, b) => {
    const k = monthKey(b.appointment_date ?? b.created_at);
    return k.startsWith(currentYearStr) ? s + (b.total_amount ?? 0) + (b.tip_amount ?? 0) : s;
  }, 0);
  const stripeThisYear = stripeMonthly?.reduce((s, m) =>
    m.month.startsWith(currentYearStr) ? s + m.amount : s, 0) ?? 0;

  const revenueThisMonth = revenueThisMonthBookings + (stripeThisMonth ?? 0);
  const revenueThisYear = revenueThisYearBookings + stripeThisYear;

  const clientsThisMonthSet = new Set<string>();
  const clientsThisYearSet = new Set<string>();
  for (const b of bookings) {
    const k = monthKey(b.appointment_date ?? b.created_at);
    const email = b.client_email.toLowerCase();
    if (k === currentMonthKey) clientsThisMonthSet.add(email);
    if (k.startsWith(currentYearStr)) clientsThisYearSet.add(email);
  }
  const clientsThisMonth = clientsThisMonthSet.size;
  const clientsThisYear = clientsThisYearSet.size;

  const sessionsThisMonth = completed.filter(b =>
    monthKey(b.appointment_date ?? b.created_at) === currentMonthKey
  ).length;
  const sessionsThisYear = completed.filter(b =>
    monthKey(b.appointment_date ?? b.created_at).startsWith(currentYearStr)
  ).length;

  // Outstanding payments: payment_link set but deposit not yet paid
  const { data: outstandingRaw } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: false })
    .eq("artist_id", user.id)
    .not("payment_link", "is", null)
    .eq("deposit_paid", false);
  const stripeOutstanding = (outstandingRaw ?? []).length;

  // Payment conversion rate: paid / total with payment link sent
  const { data: totalWithLink } = await supabase
    .from("bookings")
    .select("id, deposit_paid")
    .eq("artist_id", user.id)
    .not("payment_link", "is", null);
  const linksSent = (totalWithLink ?? []).length;
  const linksPaid = (totalWithLink ?? []).filter(b => b.deposit_paid).length;
  const stripeConversionRate = linksSent > 0 ? (linksPaid / linksSent) * 100 : null;

  const data: AnalyticsData = {
    totalRevenue,
    totalTips,
    totalBookings: bookings.length,
    totalClients,
    completedCount,
    conversionRate,
    avgPrice,
    avgBudget,
    returningClients,
    monthlyData,
    stateData,
    placements,
    sizes,
    requestTypes,
    stripeRevenue,
    stripeCount,
    stripeMonthly,
    stripeThisMonth,
    stripeLastMonth,
    stripeOutstanding,
    stripeConversionRate,
    stripeRecentPayments,
    revenueThisMonth,
    revenueThisYear,
    clientsThisMonth,
    clientsThisYear,
    sessionsThisMonth,
    sessionsThisYear,
  };

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40 shrink-0">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Analytics</h1>
        </header>
        <div className="flex-1 overflow-y-auto">
          <AnalyticsDashboard data={data} />
        </div>
      </main>
    </div>
  );
}
