"use client";

import { Download } from "lucide-react";

const ROWS = [
  {
    title: "Bookings",
    description: "Every booking you've received — status, client info, appointment date, totals.",
    href: "/api/artist/export/bookings",
  },
  {
    title: "Clients",
    description: "One row per unique client (deduplicated by email) with totals across all their bookings.",
    href: "/api/artist/export/clients",
  },
];

export function ExportSettings() {
  return (
    <div className="rounded-xl border border-outline-variant/20 p-5 space-y-3">
      <div className="divide-y divide-outline-variant/15">
        {ROWS.map(row => (
          <div key={row.title} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-base font-medium text-on-surface">{row.title}</p>
              <p className="text-sm text-on-surface-variant mt-1">{row.description}</p>
            </div>
            <a
              href={row.href}
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
