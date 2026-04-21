"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { PaymentLink, CalendarLink } from "@/lib/pipeline-settings";

interface ActionItem {
  label: string;
  count: number;
  href: string;
  urgent: boolean;
  cta: string;
}

interface QuickLinksPanelProps {
  greeting: string;
  firstName: string;
  actionItems: ActionItem[];
  paymentLinks: PaymentLink[];
  calendarLinks: CalendarLink[];
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy link"
      className="p-1.5 rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-outline-variant/10 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-on-surface truncate">{label}</p>
        <p className="text-[11px] text-on-surface-variant truncate">{url}</p>
      </div>
      <CopyButton url={url} />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title="Open"
        className="p-1.5 rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors shrink-0"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

export function QuickLinksPanel({
  greeting,
  firstName,
  actionItems,
  paymentLinks,
  calendarLinks,
}: QuickLinksPanelProps) {
  const hasActions = actionItems.some(a => a.count > 0);

  return (
    <div className="w-60 shrink-0 border-l border-outline-variant/10 bg-surface-container-low/30 flex flex-col overflow-y-auto">
      {/* Greeting */}
      <div className="px-4 pt-5 pb-3 border-b border-outline-variant/10">
        <p className="text-sm font-medium text-on-surface">{greeting}, {firstName}.</p>
      </div>

      {/* Action items */}
      <div className="px-4 py-3 border-b border-outline-variant/10">
        <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wide mb-2">Needs attention</p>
        {!hasActions ? (
          <p className="text-xs text-on-surface-variant/60">All caught up.</p>
        ) : (
          <div className="space-y-1">
            {actionItems.filter(a => a.count > 0).map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between py-1.5 group"
              >
                <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">{item.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${item.urgent ? "text-primary" : "text-on-surface"}`}>
                  {item.count}
                </span>
              </Link>
            ))}
          </div>
        )}
        <Link
          href="/bookings"
          className="block mt-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          All bookings →
        </Link>
      </div>

      {/* Payment links */}
      <div className="px-4 py-3 border-b border-outline-variant/10">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wide">Payment links</p>
          <Link href="/settings#integrations" className="text-[11px] text-on-surface-variant hover:text-on-surface transition-colors">Edit</Link>
        </div>
        {paymentLinks.length === 0 ? (
          <p className="text-xs text-on-surface-variant/60 py-1">
            No payment links.{" "}
            <Link href="/settings" className="underline hover:text-on-surface transition-colors">Add one</Link>
          </p>
        ) : (
          paymentLinks.map((link, i) => (
            <LinkRow key={i} label={link.label} url={link.url} />
          ))
        )}
      </div>

      {/* Calendar links */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wide">Scheduling links</p>
          <Link href="/settings#integrations" className="text-[11px] text-on-surface-variant hover:text-on-surface transition-colors">Edit</Link>
        </div>
        {calendarLinks.length === 0 ? (
          <p className="text-xs text-on-surface-variant/60 py-1">
            No scheduling links.{" "}
            <Link href="/settings" className="underline hover:text-on-surface transition-colors">Add one</Link>
          </p>
        ) : (
          calendarLinks.map((link, i) => (
            <LinkRow key={i} label={link.label} url={link.url} />
          ))
        )}
      </div>
    </div>
  );
}
