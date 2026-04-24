"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, ExternalLink, CalendarPlus } from "lucide-react";
import type { PaymentLink, CalendarLink } from "@/lib/pipeline-settings";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface CalcomEvent { slug: string; title: string }
interface CalcomProfile { username: string; events: CalcomEvent[] }

function isValidUrl(val: string): boolean {
  try { const u = new URL(val); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy link"
      className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Payment Links ─────────────────────────────────────────────────────────────

function PaymentLinksSection({ initialLinks }: { initialLinks: PaymentLink[] }) {
  const [links, setLinks] = useState<PaymentLink[]>(initialLinks);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  const save = async (updated: PaymentLink[]) => {
    setStatus("saving");
    const res = await fetch("/api/artist/payment-links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links: updated }),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addLink = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const updated = [...links, { label: newLabel.trim(), url: newUrl.trim() }];
    setLinks(updated);
    setNewLabel(""); setNewUrl(""); setAdding(false);
    save(updated);
  };

  const removeLink = (i: number) => {
    const updated = links.filter((_, idx) => idx !== i);
    setLinks(updated);
    save(updated);
  };

  const urlValid = newUrl.trim() === "" || isValidUrl(newUrl.trim());
  const canAdd = newLabel.trim().length > 0 && isValidUrl(newUrl.trim());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Payment Links</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Links sent to clients for deposits. Use <code className="bg-surface-container-high px-1 py-0.5 rounded text-[11px]">{"{paymentLinks}"}</code> in email templates.
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="space-y-2">
        {links.length === 0 && !adding && (
          <p className="text-xs text-on-surface-variant/60 py-2">No payment links yet.</p>
        )}
        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface">{link.label}</p>
              <p className="text-xs text-on-surface-variant truncate">{link.url}</p>
            </div>
            <CopyButton url={link.url} />
            <a href={link.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface transition-colors" title="Open">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button type="button" onClick={() => removeLink(i)} className="p-1.5 rounded-md text-on-surface-variant hover:text-destructive transition-colors" title="Remove">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-2">
          <input type="text" placeholder='Label — e.g. "Stripe 1hr deposit"' value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]" />
          <div>
            <input type="url" placeholder="https://buy.stripe.com/…" value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm text-on-surface bg-surface border rounded-lg focus:outline-none placeholder:text-[#888888] ${!urlValid ? "border-red-400 focus:border-red-400" : "border-outline-variant/30 focus:border-primary"}`} />
            {!urlValid && <p className="text-xs text-red-500 mt-1">Enter a valid URL starting with https://</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setAdding(false); setNewLabel(""); setNewUrl(""); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-colors">Cancel</button>
            <button type="button" onClick={addLink} disabled={!canAdd}
              style={{ background: '#000', color: '#fff', opacity: canAdd ? 1 : 0.65 }}
              className="px-4 py-2.5 text-sm font-medium rounded-lg transition-opacity">Add link</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
          <Plus className="w-4 h-4" /> Add payment link
        </button>
      )}
    </div>
  );
}

// ── Calendar / Scheduling Links ───────────────────────────────────────────────

const KNOWN_SERVICES = [
  { label: "Calendly",            pattern: "calendly.com" },
  { label: "Cal.com",             pattern: "cal.com" },
  { label: "Acuity Scheduling",   pattern: "acuityscheduling.com" },
  { label: "Square Appointments", pattern: "squareup.com" },
  { label: "Vagaro",              pattern: "vagaro.com" },
  { label: "Booksy",              pattern: "booksy.com" },
];

function detectService(url: string) {
  return KNOWN_SERVICES.find(s => url.includes(s.pattern))?.label ?? null;
}

function CalendarLinksSection({ initialLinks, calcomConnected }: { initialLinks: CalendarLink[]; calcomConnected: boolean }) {
  const [links, setLinks] = useState<CalendarLink[]>(initialLinks);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [calcom, setCalcom] = useState<CalcomProfile | null>(null);
  const [calcomLoading, setCalcomLoading] = useState(false);
  const [calcomError, setCalcomError] = useState<string | null>(null);

  useEffect(() => {
    if (!calcomConnected) return;
    let cancelled = false;
    setCalcomLoading(true);
    setCalcomError(null);
    fetch("/api/artist/calcom-events")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setCalcom(body as CalcomProfile);
        else setCalcomError(body?.error ?? "Could not load Cal.com events");
      })
      .catch(() => { if (!cancelled) setCalcomError("Could not load Cal.com events"); })
      .finally(() => { if (!cancelled) setCalcomLoading(false); });
    return () => { cancelled = true; };
  }, [calcomConnected]);

  const save = async (updated: CalendarLink[]) => {
    setStatus("saving");
    const res = await fetch("/api/artist/pipeline-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendar_links: updated }),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addCalcomEvent = (event: CalcomEvent) => {
    if (!calcom?.username) return;
    const url = `https://cal.com/${calcom.username}/${event.slug}`;
    if (links.some((l) => l.url === url)) return; // already added
    const updated = [...links, { label: event.title, url }];
    setLinks(updated);
    save(updated);
  };

  const addLink = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const updated = [...links, { label: newLabel.trim(), url: newUrl.trim() }];
    setLinks(updated);
    setNewLabel(""); setNewUrl(""); setAdding(false);
    save(updated);
  };

  const removeLink = (i: number) => {
    const updated = links.filter((_, idx) => idx !== i);
    setLinks(updated);
    save(updated);
  };

  const detected = newUrl ? detectService(newUrl) : null;
  const urlValid = newUrl.trim() === "" || isValidUrl(newUrl.trim());
  const canAdd = newLabel.trim().length > 0 && isValidUrl(newUrl.trim());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Scheduling Links</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Links for booking sessions. Use <code className="bg-surface-container-high px-1 py-0.5 rounded text-[11px]">{"{calendarLink}"}</code> in email templates.
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {calcomConnected && (
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/40 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-on-surface">Your Cal.com event types</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="w-3 h-3" /> Connected
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Click an event to add it as a scheduling link, or create a new one in Cal.com.
              </p>
            </div>
            <a
              href="https://app.cal.com/event-types"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CalendarPlus className="w-3.5 h-3.5" /> Create new in Cal.com
            </a>
          </div>

          {calcomLoading && (
            <p className="text-xs text-on-surface-variant py-1">Loading event types…</p>
          )}
          {calcomError && (
            <p className="text-xs text-destructive py-1">{calcomError}</p>
          )}
          {!calcomLoading && !calcomError && calcom && calcom.events.length === 0 && (
            <p className="text-xs text-on-surface-variant/70 py-1">
              No event types in Cal.com yet. Create one and refresh this page.
            </p>
          )}
          {!calcomLoading && !calcomError && calcom && calcom.events.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {calcom.events.map((ev) => {
                const url = `https://cal.com/${calcom.username}/${ev.slug}`;
                const alreadyAdded = links.some((l) => l.url === url);
                return (
                  <button
                    key={ev.slug}
                    type="button"
                    onClick={() => addCalcomEvent(ev)}
                    disabled={alreadyAdded}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      alreadyAdded
                        ? "border-emerald-300/60 bg-emerald-100/60 text-emerald-700 cursor-default"
                        : "border-outline-variant/40 bg-surface text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    {alreadyAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {ev.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {links.length === 0 && !adding && (
          <p className="text-xs text-on-surface-variant/60 py-2">No scheduling links yet.</p>
        )}
        {links.map((link, i) => {
          const service = detectService(link.url);
          return (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface">{link.label}</p>
                <p className="text-xs text-on-surface-variant truncate">{link.url}{service ? ` · ${service}` : ""}</p>
              </div>
              <CopyButton url={link.url} />
              <a href={link.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface transition-colors" title="Open">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button type="button" onClick={() => removeLink(i)} className="p-1.5 rounded-md text-on-surface-variant hover:text-destructive transition-colors" title="Remove">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-2">
          <input type="text" placeholder='Label — e.g. "2hr session" or "touch-up"' value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]" />
          <div>
            <input type="url" placeholder="https://calendly.com/your-name/…" value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm text-on-surface bg-surface border rounded-lg focus:outline-none placeholder:text-[#888888] ${!urlValid ? "border-red-400 focus:border-red-400" : "border-outline-variant/30 focus:border-primary"}`} />
            {!urlValid && <p className="text-xs text-red-500 mt-1">Enter a valid URL starting with https://</p>}
            {urlValid && detected && <p className="text-xs text-on-surface-variant mt-1">Detected: {detected}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setAdding(false); setNewLabel(""); setNewUrl(""); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-colors">Cancel</button>
            <button type="button" onClick={addLink} disabled={!canAdd}
              style={{ background: '#000', color: '#fff', opacity: canAdd ? 1 : 0.65 }}
              className="px-4 py-2.5 text-sm font-medium rounded-lg transition-opacity">Add link</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
          <Plus className="w-4 h-4" /> Add scheduling link
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SaveStatus }) {
  if (status === "saved") return <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3 h-3" /> Saved</span>;
  if (status === "saving") return <span className="text-xs text-on-surface-variant">Saving…</span>;
  if (status === "error") return <span className="text-xs text-destructive">Failed to save</span>;
  return null;
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function LinksView({
  initialPaymentLinks,
  initialCalendarLinks,
  calcomConnected = false,
}: {
  initialPaymentLinks: PaymentLink[];
  initialCalendarLinks: CalendarLink[];
  calcomConnected?: boolean;
}) {
  return (
    <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
      <PaymentLinksSection initialLinks={initialPaymentLinks} />
      <CalendarLinksSection initialLinks={initialCalendarLinks} calcomConnected={calcomConnected} />
    </div>
  );
}
