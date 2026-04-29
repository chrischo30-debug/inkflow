"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { AnalyticsData, DistItem, MonthlyPoint } from "@/app/analytics/page";
import { TrendingUp, Users, DollarSign, Award, Repeat2, Sparkles } from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const PALETTE = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#06b6d4", "#f97316", "#84cc16", "#14b8a6", "#a855f7"];

const STATE_COLORS: Record<string, string> = {
  inquiry:   "#94a3b8",
  follow_up: "#a855f7",
  accepted:  "#f59e0b",
  confirmed: "#3b82f6",
  completed: "#10b981",
  rejected:  "#ef4444",
  cancelled: "#cbd5e1",
};

// ─── Shared tooltip style ────────────────────────────────────────────────────
const ttStyle = {
  backgroundColor: "hsl(var(--surface, 255 255 255))",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
};

// ─── Small helpers ────────────────────────────────────────────────────────────
function fmt$(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${accent ? "bg-on-surface text-surface border-transparent" : "bg-surface border-outline-variant/15"}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-surface" : "text-on-surface-variant"}`}>{label}</p>
        <div className={`p-2 rounded-xl ${accent ? "bg-surface/10" : "bg-surface-container-low"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-surface" : "text-on-surface-variant"}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold font-heading leading-none ${accent ? "text-surface" : "text-on-surface"}`}>{value}</p>
      {sub && <p className={`text-xs ${accent ? "text-surface" : "text-on-surface-variant"}`}>{sub}</p>}
    </div>
  );
}

type Period = "monthly" | "year" | "total";

// ─── Toggle KPI Card (Revenue / Clients) ─────────────────────────────────────
function ToggleKpiCard({
  label, monthly, year, total, monthSub, yearSub, totalSub, icon: Icon, accent = false,
}: {
  label: string;
  monthly: string;
  year: string;
  total: string;
  monthSub?: string;
  yearSub?: string;
  totalSub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  const [period, setPeriod] = useState<Period>("total");
  const value = period === "monthly" ? monthly : period === "year" ? year : total;
  const sub = period === "monthly" ? monthSub : period === "year" ? yearSub : totalSub;

  const activeClass = accent ? "bg-surface/20 text-surface" : "bg-surface-container text-on-surface";
  const inactiveClass = accent ? "text-surface hover:text-surface" : "text-on-surface-variant hover:text-on-surface-variant";

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${accent ? "bg-on-surface text-surface border-transparent" : "bg-surface border-outline-variant/15"}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-surface" : "text-on-surface-variant"}`}>{label}</p>
        <div className={`p-2 rounded-xl ${accent ? "bg-surface/10" : "bg-surface-container-low"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-surface" : "text-on-surface-variant"}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold font-heading leading-none ${accent ? "text-surface" : "text-on-surface"}`}>{value}</p>
      {sub && <p className={`text-xs ${accent ? "text-surface" : "text-on-surface-variant"}`}>{sub}</p>}
      <div className={`flex items-center gap-1 mt-auto pt-2 ${accent ? "border-t border-surface/10" : "border-t border-outline-variant/10"}`}>
        {(["monthly", "year", "total"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors cursor-pointer ${period === p ? activeClass : inactiveClass}`}
          >
            {p === "monthly" ? "Month" : p === "year" ? "Year" : "Total"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface rounded-2xl border border-outline-variant/15 p-5 ${className}`}>
      <p className="text-sm font-semibold text-on-surface mb-4">{title}</p>
      {children}
    </div>
  );
}

// ─── Custom tooltip ──────────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={ttStyle} className="px-3 py-2.5 space-y-1">
      <p className="text-xs font-semibold text-on-surface mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-on-surface-variant">{p.name}:</span>
          <span className="font-medium text-on-surface">{p.name === "Revenue" ? fmt$(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Horizontal bar chart (placements / sizes / request types) ──────────────
function HorizBar({ data, color, showRevenue = false }: { data: DistItem[]; color: string; showRevenue?: boolean }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const totalRevenue = data.reduce((s, d) => s + (d.revenue ?? 0), 0);
  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const rev = item.revenue ?? 0;
        return (
          <div key={item.name} className="flex items-center gap-3">
            <p className="text-xs text-on-surface-variant w-28 shrink-0 truncate capitalize">{item.name}</p>
            <div className="flex-1 h-5 bg-surface-container-low rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(item.count / max) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] ?? color }}
              />
            </div>
            {showRevenue && (
              <p className="text-xs text-emerald-600 font-medium w-14 text-right tabular-nums">
                {rev > 0 ? fmt$(rev) : <span className="text-on-surface-variant">—</span>}
              </p>
            )}
            <p className="text-xs font-medium text-on-surface w-6 text-right tabular-nums">{item.count}</p>
          </div>
        );
      })}
      {showRevenue && totalRevenue > 0 && (
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-outline-variant/10">
          <p className="text-xs text-on-surface-variant">Revenue from completed</p>
          <p className="text-xs font-semibold text-on-surface">{fmt$(totalRevenue)}</p>
        </div>
      )}
    </div>
  );
}

// ─── Funnel (pipeline conversion) ────────────────────────────────────────────
function PipelineFunnel({ stateData, totalBookings }: { stateData: { state: string; label: string; count: number }[]; totalBookings: number }) {
  const stages = [
    { state: "inquiry",       label: "Submissions" },
    { state: "follow_up",     label: "Follow Up" },
    { state: "sent_deposit",  label: "Sent Deposit" },
    { state: "sent_calendar", label: "Sent Calendar" },
    { state: "booked",        label: "Booked" },
    { state: "completed",     label: "Completed" },
  ];
  const map = Object.fromEntries(stateData.map(s => [s.state, s.count]));
  const max = Math.max(totalBookings, 1);

  return (
    <div className="space-y-2">
      {stages.map(s => {
        const count = map[s.state] ?? 0;
        const pctW = (count / max) * 100;
        return (
          <div key={s.state} className="flex items-center gap-3">
            <p className="text-xs text-on-surface-variant w-24 shrink-0">{s.label}</p>
            <div className="flex-1 h-6 bg-surface-container-low rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center px-2 transition-all"
                style={{ width: `${Math.max(pctW, 4)}%`, backgroundColor: STATE_COLORS[s.state] }}
              >
                {pctW > 12 && <span className="text-[10px] font-semibold text-white">{count}</span>}
              </div>
            </div>
            {pctW <= 12 && <p className="text-xs font-medium text-on-surface w-6">{count}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Budget vs Actual comparison ─────────────────────────────────────────────
function BudgetVsActual({ avgBudget, avgPrice }: { avgBudget: number; avgPrice: number }) {
  if (avgBudget === 0 && avgPrice === 0) {
    return <p className="text-xs text-on-surface-variant italic">No budget or pricing data yet.</p>;
  }
  const max = Math.max(avgBudget, avgPrice, 1);
  const items = [
    { label: "Avg Client Budget", value: avgBudget, color: "#94a3b8" },
    { label: "Avg Actual Price", value: avgPrice, color: "#6366f1" },
  ];
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-on-surface-variant">{item.label}</p>
            <p className="text-xs font-semibold text-on-surface">{fmt$(item.value)}</p>
          </div>
          <div className="h-3 bg-surface-container-low rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
      {avgBudget > 0 && avgPrice > 0 && (
        <p className="text-xs text-on-surface-variant pt-1">
          Avg price is{" "}
          <span className={`font-semibold ${avgPrice > avgBudget ? "text-emerald-600" : "text-amber-600"}`}>
            {avgPrice > avgBudget ? "+" : ""}{fmt$(avgPrice - avgBudget)}
          </span>{" "}
          vs client budget
        </p>
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const {
    totalRevenue, totalTips, totalBookings, totalClients,
    completedCount, conversionRate, avgPrice, avgBudget,
    returningClients, monthlyData, stateData, placements, sizes, requestTypes,
    revenueThisMonth, revenueThisYear, clientsThisMonth, clientsThisYear,
    sessionsThisMonth, sessionsThisYear,
  } = data;

  const hasRevenue = totalRevenue > 0;
  const chartData: MonthlyPoint[] = monthlyData;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <ToggleKpiCard
          label="Revenue"
          monthly={fmt$(revenueThisMonth)}
          year={fmt$(revenueThisYear)}
          total={fmt$(totalRevenue + totalTips)}
          monthSub="this calendar month"
          yearSub={`${new Date().getFullYear()} calendar year`}
          totalSub={totalTips > 0 ? `incl. ${fmt$(totalTips)} in tips` : `${completedCount} completed sessions`}
          icon={DollarSign}
          accent
        />
        <ToggleKpiCard
          label="Clients"
          monthly={String(clientsThisMonth)}
          year={String(clientsThisYear)}
          total={String(totalClients)}
          monthSub="unique this month"
          yearSub={`unique in ${new Date().getFullYear()}`}
          totalSub={returningClients > 0 ? `${returningClients} returning` : `${totalBookings} total bookings`}
          icon={Users}
        />
        <ToggleKpiCard
          label="Sessions"
          monthly={String(sessionsThisMonth)}
          year={String(sessionsThisYear)}
          total={String(completedCount)}
          monthSub="completed this month"
          yearSub={`completed in ${new Date().getFullYear()}`}
          totalSub="all completed sessions"
          icon={Award}
        />
        <KpiCard
          label="Avg Tattoo Price"
          value={avgPrice > 0 ? fmt$(avgPrice) : "—"}
          sub={avgBudget > 0 ? `clients budget ${fmt$(avgBudget)}` : "based on completed sessions"}
          icon={TrendingUp}
        />
      </div>

      {/* ── Revenue + state donut ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Section title="Revenue Over Time" className="xl:col-span-2">
          {hasRevenue ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmt$(v)} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip content={<RevenueTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-sm text-on-surface-variant">Revenue will appear once sessions are completed.</p>
            </div>
          )}
        </Section>

        <Section title="Booking Status">
          {stateData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={stateData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="count"
                    paddingAngle={2}
                  >
                    {stateData.map(s => (
                      <Cell key={s.state} fill={STATE_COLORS[s.state] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={ttStyle}
                    itemStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
                {stateData.map(s => (
                  <div key={s.state} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATE_COLORS[s.state] ?? "#94a3b8" }} />
                    <span className="text-xs text-on-surface-variant truncate">{s.label}</span>
                    <span className="text-xs font-medium text-on-surface ml-auto">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-on-surface-variant">No bookings yet.</p>
            </div>
          )}
        </Section>
      </div>

      {/* ── Booking volume + pipeline ────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Section title="Bookings per Month" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={ttStyle} itemStyle={{ fontSize: 12 }} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
              <Bar dataKey="bookings" name="Bookings" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Pipeline Funnel">
          <PipelineFunnel stateData={stateData} totalBookings={totalBookings} />
          <div className="mt-4 pt-4 border-t border-outline-variant/10 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-on-surface-variant mb-0.5">Completion rate</p>
              <p className="text-lg font-bold text-on-surface">{pct(conversionRate)}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant mb-0.5">Returning clients</p>
              <p className="text-lg font-bold text-on-surface">{returningClients}</p>
            </div>
          </div>
        </Section>
      </div>

      {/* ── Placement + Size distributions (with revenue) ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section title="Top Placements">
          {placements.length > 0 ? (
            <>
              <div className="flex items-center justify-end gap-3 mb-2 text-[10px] uppercase tracking-wide text-on-surface-variant">
                <span className="w-14 text-right">Revenue</span>
                <span className="w-6 text-right">Count</span>
              </div>
              <HorizBar data={placements} color="#8b5cf6" showRevenue />
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">No placement data collected yet.</p>
          )}
        </Section>

        <Section title="Size Distribution">
          {sizes.length > 0 ? (
            <>
              <div className="flex items-center justify-end gap-3 mb-2 text-[10px] uppercase tracking-wide text-on-surface-variant">
                <span className="w-14 text-right">Revenue</span>
                <span className="w-6 text-right">Count</span>
              </div>
              <HorizBar data={sizes} color="#ec4899" showRevenue />
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">No size data collected yet.</p>
          )}
        </Section>
      </div>

      {/* ── Popular request types ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5">
        <Section title="Popular Request Types">
          {requestTypes.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-3 text-xs text-on-surface-variant">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Extracted from booking descriptions — a request may match multiple types.</span>
              </div>
              <div className="flex items-center justify-end gap-3 mb-2 text-[10px] uppercase tracking-wide text-on-surface-variant">
                <span className="w-14 text-right">Revenue</span>
                <span className="w-6 text-right">Count</span>
              </div>
              <HorizBar data={requestTypes} color="#6366f1" showRevenue />
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">
              Request-type analytics will appear once bookings include descriptions.
            </p>
          )}
        </Section>
      </div>

      {/* ── Budget vs Actual + client stats ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <Section title="Budget vs Actual Price">
          <BudgetVsActual avgBudget={avgBudget} avgPrice={avgPrice} />
        </Section>

        <Section title="Client Breakdown">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center">
                <Users className="w-5 h-5 text-on-surface-variant" />
              </div>
              <div>
                <p className="text-2xl font-bold text-on-surface">{totalClients}</p>
                <p className="text-xs text-on-surface-variant">unique clients</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-low rounded-xl p-3">
                <p className="text-xs text-on-surface-variant mb-1">First-timers</p>
                <p className="text-xl font-bold text-on-surface">{totalClients - returningClients}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Repeat2 className="w-3 h-3 text-on-surface-variant" />
                  <p className="text-xs text-on-surface-variant">Returning</p>
                </div>
                <p className="text-xl font-bold text-emerald-600">{returningClients}</p>
              </div>
            </div>
            {returningClients > 0 && (
              <p className="text-xs text-on-surface-variant">
                {pct((returningClients / Math.max(totalClients, 1)) * 100)} of your clients have booked more than once
              </p>
            )}
          </div>
        </Section>

      </div>

    </div>
  );
}
