"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, ExternalLink, Zap, Pencil, X, BanIcon } from "lucide-react";
import type { PaymentLink, CalendarLink, SchedulingLink } from "@/lib/pipeline-settings";
import { CoachmarkSequence } from "@/components/coachmarks/Coachmark";
import {
  SchedulingLinkForm, useCalendarOptions,
  DURATIONS, DAY_LABELS, HOURS,
  generateId, newLinkDraft,
  type CalendarOption, type LinkDraft,
} from "@/components/shared/SchedulingLinkForm";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function normalizeUrl(val: string): string {
  const trimmed = val.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function isValidUrl(val: string): boolean {
  try { const u = new URL(normalizeUrl(val)); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={copy} title="Copy link"
      className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// Square payment links are single-use, so we regenerate from the saved
// label+amount each time the user copies or opens the row.
function isSquareTemplate(link: PaymentLink): boolean {
  return link.provider === "square" && typeof link.amount_cents === "number" && !!link.id;
}

function StatusBadge({ status }: { status: SaveStatus }) {
  if (status === "saved") return <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3 h-3" /> Saved</span>;
  if (status === "saving") return <span className="text-xs text-on-surface-variant">Saving…</span>;
  if (status === "error") return <span className="text-xs text-destructive">Failed to save</span>;
  return null;
}

// ── Payment Links ─────────────────────────────────────────────────────────────

function PaymentLinkRow({ link, onChange, onRemove }: { link: PaymentLink; onChange: (next: PaymentLink) => void; onRemove: () => void }) {
  const isTemplate = isSquareTemplate(link);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Returns a fresh URL and updates the row's saved URL. Falls back to the
  // existing URL on failure so the user still has something to use.
  const getFreshUrl = async (): Promise<string | null> => {
    if (!isTemplate) return link.url;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/payments/payment-link/regenerate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: link.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(typeof data.error === "string" ? data.error : "Could not regenerate link");
        return null;
      }
      onChange({ ...link, url: data.url as string });
      return data.url as string;
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    const url = await getFreshUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleOpen = async () => {
    if (!isTemplate) {
      window.open(link.url, "_blank", "noopener,noreferrer");
      return;
    }
    // Open a placeholder synchronously so the popup blocker treats this as a
    // user gesture, then redirect once we have the fresh URL.
    const w = window.open("", "_blank", "noopener,noreferrer");
    const url = await getFreshUrl();
    if (!url) { w?.close(); return; }
    if (w) w.location.href = url; else window.location.href = url;
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-on-surface">{link.label}</p>
        {isTemplate ? (
          <p className="text-xs text-on-surface-variant">
            Square · ${(link.amount_cents! / 100).toFixed(2)} · fresh link generated each copy
          </p>
        ) : (
          <p className="text-xs text-on-surface-variant truncate">{link.url}</p>
        )}
        {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
      </div>
      <button type="button" onClick={handleCopy} disabled={busy} title="Copy link"
        className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <button type="button" onClick={handleOpen} disabled={busy} title="Open"
        className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50">
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={onRemove} className="p-1.5 rounded-md text-on-surface-variant hover:text-destructive transition-colors" title="Remove">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function PaymentLinksSection({ initialLinks, externalAdd }: { initialLinks: PaymentLink[]; externalAdd?: PaymentLink | null }) {
  const [links, setLinks] = useState<PaymentLink[]>(initialLinks);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    if (!externalAdd) return;
    // Server-side auto-save already wrote this entry — just reflect it locally.
    setLinks(prev => {
      const matches = (l: PaymentLink) => (externalAdd.id && l.id === externalAdd.id) || l.url === externalAdd.url;
      return prev.some(matches) ? prev : [...prev, externalAdd];
    });
  }, [externalAdd]);

  const save = async (updated: PaymentLink[]) => {
    setStatus("saving");
    const res = await fetch("/api/artist/payment-links", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: updated }) });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addLink = () => {
    if (!newLabel.trim() || !isValidUrl(newUrl.trim())) return;
    const updated = [...links, { label: newLabel.trim(), url: normalizeUrl(newUrl.trim()) }];
    setLinks(updated); setNewLabel(""); setNewUrl(""); setAdding(false);
    save(updated);
  };
  const removeLink = (i: number) => { const updated = links.filter((_, idx) => idx !== i); setLinks(updated); save(updated); };
  const updateLink = (i: number, next: PaymentLink) => {
    // URL refresh from regenerate — the server already persisted it, so we
    // only update local state and skip the PUT.
    setLinks(prev => prev.map((l, idx) => idx === i ? next : l));
  };

  const urlValid = newUrl.trim() === "" || isValidUrl(newUrl.trim());
  const canAdd = newLabel.trim().length > 0 && isValidUrl(newUrl.trim());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end min-h-[20px]">
        <StatusBadge status={status} />
      </div>

      <div className="space-y-2">
        {links.length === 0 && !adding && (
          <p className="text-sm text-on-surface-variant py-1">No payment links yet.</p>
        )}
        {links.map((link, i) => (
          <PaymentLinkRow
            key={link.id ?? `${link.url}-${i}`}
            link={link}
            onChange={next => updateLink(i, next)}
            onRemove={() => removeLink(i)}
          />
        ))}
      </div>

      {adding ? (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-2">
          <input type="text" placeholder='Label — e.g. "Stripe deposit" or "Square deposit"' value={newLabel} onChange={e => setNewLabel(e.target.value)}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]" />
          <div>
            <input type="url" placeholder="buy.stripe.com/…" value={newUrl} onChange={e => setNewUrl(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm text-on-surface bg-surface border rounded-lg focus:outline-none placeholder:text-[#888888] ${!urlValid ? "border-red-400" : "border-outline-variant/30 focus:border-primary"}`} />
            {!urlValid && <p className="text-xs text-red-500 mt-1">Enter a valid URL (e.g. https://buy.stripe.com/…)</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setAdding(false); setNewLabel(""); setNewUrl(""); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-colors">Cancel</button>
            <button type="button" onClick={addLink} disabled={!canAdd}
              style={{ background: "#000", color: "#fff", opacity: canAdd ? 1 : 0.65 }}
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

// ── Payment-link generator (Stripe or Square via the connected provider) ────

type GenerateStatus = "idle" | "generating" | "done" | "error";

function PaymentLinkGeneratorSection({ provider, onLinkGenerated }: { provider: "stripe" | "square"; onLinkGenerated: (link: PaymentLink) => void }) {
  const providerLabel = provider === "square" ? "Square" : "Stripe";
  const [label, setLabel] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [genStatus, setGenStatus] = useState<GenerateStatus>("idle");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const amount = parseFloat(amountStr);
  const canGenerate = label.trim().length > 0 && !isNaN(amount) && amount >= 1;

  const generate = async () => {
    setGenStatus("generating"); setGeneratedUrl(null); setErrorMsg(null); setSaved(false);
    const amount_cents = Math.round(amount * 100);
    const res = await fetch("/api/payments/payment-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label.trim(), amount_cents }) });
    const data = await res.json();
    if (res.ok && data.url) {
      setGeneratedUrl(data.url);
      setGenStatus("done");
      onLinkGenerated({
        label: label.trim(),
        url: data.url,
        id: data.id,
        provider: data.provider,
        amount_cents,
      });
      setSaved(true);
    } else {
      setErrorMsg(data.error ?? "Failed to generate link"); setGenStatus("error");
    }
  };

  const copy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const reset = () => { setLabel(""); setAmountStr(""); setGeneratedUrl(null); setGenStatus("idle"); setErrorMsg(null); setSaved(false); };

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
        <p className="text-base font-medium text-on-surface">Generate {providerLabel} link</p>
      </div>
      {!generatedUrl ? (
        <div className="space-y-2">
          <input type="text" placeholder='Label — e.g. "Half-sleeve deposit"' value={label} onChange={e => setLabel(e.target.value)}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]" />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
            <input type="number" min="1" step="0.01" placeholder="0.00" value={amountStr} onChange={e => setAmountStr(e.target.value)}
              className="w-full pl-7 pr-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]" />
          </div>
          {genStatus === "error" && errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={generate} disabled={!canGenerate || genStatus === "generating"}
              style={{ background: "#000", color: "#fff", opacity: canGenerate && genStatus !== "generating" ? 1 : 0.45 }}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-opacity">
              {genStatus === "generating" ? "Generating…" : "Generate link"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-surface-container-high/60 border border-outline-variant/20 px-3 py-2">
            <p className="flex-1 text-xs font-mono text-on-surface-variant truncate">{generatedUrl}</p>
            <button type="button" onClick={copy} className="shrink-0 p-1 rounded text-on-surface-variant hover:text-on-surface transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a href={generatedUrl} target="_blank" rel="noreferrer" className="shrink-0 p-1 rounded text-on-surface-variant hover:text-on-surface transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={reset} className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Generate another</button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-emerald-300/60 text-emerald-700 bg-emerald-50/40">
                <Check className="w-3.5 h-3.5" /> Saved to payment links
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Native Scheduling Links ───────────────────────────────────────────────────

function NativeSchedulingSection({ initialLinks, artistId, isCalendarConnected }: { initialLinks: SchedulingLink[]; artistId: string; isCalendarConnected: boolean }) {
  const [links, setLinks] = useState<SchedulingLink[]>(initialLinks);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<LinkDraft>(newLinkDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LinkDraft>(newLinkDraft());
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { calendarOptions, calendarsLoading } = useCalendarOptions(isCalendarConnected);

  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const save = async (updated: SchedulingLink[]) => {
    setStatus("saving");
    const res = await fetch("/api/artist/scheduling-links", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: updated }) });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addLink = () => {
    if (!draft.label.trim() || draft.days.length === 0 || draft.start_hour >= draft.end_hour) return;
    const newLink: SchedulingLink = { ...draft, id: generateId(), label: draft.label.trim() };
    const updated = [...links, newLink];
    setLinks(updated); setDraft(newLinkDraft()); setAdding(false);
    save(updated);
  };

  const startEdit = (link: SchedulingLink) => {
    setAdding(false);
    setEditingId(link.id);
    setEditDraft({
      label: link.label,
      duration_minutes: link.duration_minutes,
      days: link.days,
      start_hour: link.start_hour,
      end_hour: link.end_hour,
      timezone: link.timezone,
      calendar_ids: link.calendar_ids ?? [],
      block_full_day: link.block_full_day ?? false,
      confirmation_message: link.confirmation_message ?? "",
      buffer_minutes: link.buffer_minutes ?? 0,
      is_half_day: link.is_half_day ?? false,
      half_day_minutes: link.half_day_minutes ?? 240,
      half_day_followup_minutes: link.half_day_followup_minutes ?? [],
    });
  };

  const saveEdit = () => {
    if (!editingId || !editDraft.label.trim()) return;
    const updated = links.map(l => l.id === editingId ? { ...editDraft, id: editingId, label: editDraft.label.trim() } : l);
    setLinks(updated); setEditingId(null);
    save(updated);
  };

  const removeLink = (id: string) => { const updated = links.filter(l => l.id !== id); setLinks(updated); save(updated); };

  const copyUrl = (id: string) => {
    const url = `${origin}/schedule/${artistId}/${id}`;
    navigator.clipboard.writeText(url).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); });
  };

  const durationLabel = (m: number) => DURATIONS.find(d => d.minutes === m)?.label ?? `${m / 60}h`;
  const hourLabel = (h: number) => HOURS.find(x => x.value === h)?.label ?? `${h}:00`;

  const canAdd = draft.label.trim().length > 0 && draft.days.length > 0 && draft.start_hour < draft.end_hour;
  const canSaveEdit = editDraft.label.trim().length > 0 && editDraft.days.length > 0 && editDraft.start_hour < editDraft.end_hour;

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-4" data-coachmark="scheduling-links-section">
      <div className="flex items-center justify-between">
        <p className="text-base font-medium text-on-surface">Scheduling Links</p>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm text-on-surface-variant">
        Clients pick from open slots based on your Google Calendar availability.
        <br /><br />
        Copy the link and paste it into any email.
      </p>

      <div className="space-y-2">
        {links.length === 0 && !adding && (
          <p className="text-sm text-on-surface-variant py-1">No scheduling links yet.</p>
        )}
        {links.map(link => {
          const url = `${origin}/schedule/${artistId}/${link.id}`;
          const isEditing = editingId === link.id;

          if (isEditing) {
            return (
              <div key={link.id} className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-4">
                <SchedulingLinkForm
                  draft={editDraft}
                  setDraft={updater => setEditDraft(updater)}
                  isCalendarConnected={isCalendarConnected}
                  calendarOptions={calendarOptions}
                  calendarsLoading={calendarsLoading}
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setEditingId(null)}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-colors">Cancel</button>
                  <button type="button" onClick={saveEdit} disabled={!canSaveEdit}
                    style={{ background: "#000", color: "#fff", opacity: canSaveEdit ? 1 : 0.65 }}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg transition-opacity">Save changes</button>
                </div>
              </div>
            );
          }

          return (
            <div key={link.id} className="rounded-xl border border-outline-variant/20 bg-surface px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface">{link.label}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {durationLabel(link.duration_minutes)} · {link.days.map(d => DAY_LABELS[d]).join(", ")} · {hourLabel(link.start_hour)}–{hourLabel(link.end_hour)}
                  </p>
                </div>
                <button type="button" onClick={() => startEdit(link)} title="Edit"
                  className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => copyUrl(link.id)} title="Copy link"
                  className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                  {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a href={url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface transition-colors" title="Preview"><ExternalLink className="w-3.5 h-3.5" /></a>
                <button type="button" onClick={() => removeLink(link.id)} className="p-1.5 rounded-md text-on-surface-variant hover:text-destructive transition-colors" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-[10px] text-on-surface-variant/50 font-mono truncate">{url}</p>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-4">
          <SchedulingLinkForm
            draft={draft}
            setDraft={updater => setDraft(updater)}
            isCalendarConnected={isCalendarConnected}
            calendarOptions={calendarOptions}
            calendarsLoading={calendarsLoading}
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setAdding(false); setDraft(newLinkDraft()); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-colors">Cancel</button>
            <button type="button" onClick={addLink} disabled={!canAdd}
              style={{ background: "#000", color: "#fff", opacity: canAdd ? 1 : 0.65 }}
              className="px-4 py-2.5 text-sm font-medium rounded-lg transition-opacity">Create link</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
          <Plus className="w-4 h-4" /> New scheduling link
        </button>
      )}
    </div>
  );
}

// ── Blocked Dates ─────────────────────────────────────────────────────────────

function BlockedDatesSection({ initialDates }: { initialDates: string[] }) {
  const [dates, setDates] = useState<string[]>(initialDates);
  const [newDate, setNewDate] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  const save = async (updated: string[]) => {
    setStatus("saving");
    const res = await fetch("/api/artist/blocked-dates", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked_dates: updated }),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addDate = () => {
    if (!newDate || dates.includes(newDate)) return;
    const updated = [...dates, newDate].sort();
    setDates(updated); setNewDate(""); save(updated);
  };

  const removeDate = (d: string) => {
    const updated = dates.filter(x => x !== d);
    setDates(updated); save(updated);
  };

  const formatDate = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-4" data-coachmark="blocked-dates-section">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BanIcon className="w-4 h-4 text-on-surface-variant shrink-0" />
          <p className="text-base font-medium text-on-surface">Blocked Dates</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="text-sm text-on-surface-variant">Dates unavailable across all scheduling links — holidays, time off, etc.</p>

      {dates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dates.map(d => (
            <div key={d} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-outline-variant/20 bg-surface text-xs text-on-surface">
              {formatDate(d)}
              <button type="button" onClick={() => removeDate(d)} className="ml-0.5 text-on-surface-variant hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {dates.length === 0 && (
        <p className="text-xs text-on-surface-variant">No dates blocked yet.</p>
      )}

      <div className="flex gap-2">
        <input type="date" value={newDate} min={today}
          onChange={e => setNewDate(e.target.value)}
          className="flex-1 px-3 py-2 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary" />
        <button type="button" onClick={addDate} disabled={!newDate || dates.includes(newDate)}
          style={{ background: "#000", color: "#fff", opacity: newDate && !dates.includes(newDate) ? 1 : 0.4 }}
          className="px-3 py-2 text-sm font-medium rounded-lg transition-opacity whitespace-nowrap">
          Block day
        </button>
      </div>
    </div>
  );
}

// ── External Calendar Links ───────────────────────────────────────────────────

const KNOWN_SERVICES = [
  { label: "Calendly", pattern: "calendly.com" },
  { label: "Cal.com", pattern: "cal.com" },
  { label: "Acuity Scheduling", pattern: "acuityscheduling.com" },
  { label: "Square Appointments", pattern: "squareup.com" },
  { label: "Vagaro", pattern: "vagaro.com" },
  { label: "Booksy", pattern: "booksy.com" },
];

function ExternalCalendarSection({ initialLinks }: { initialLinks: CalendarLink[] }) {
  const [links, setLinks] = useState<CalendarLink[]>(initialLinks);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const detected = newUrl ? KNOWN_SERVICES.find(s => newUrl.includes(s.pattern))?.label ?? null : null;

  const save = async (updated: CalendarLink[]) => {
    setStatus("saving");
    setErrorDetail(null);
    const res = await fetch("/api/artist/pipeline-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendar_links: updated }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorDetail(data.error ?? null);
    }
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addLink = () => {
    if (!newLabel.trim() || !isValidUrl(newUrl.trim())) return;
    const updated = [...links, { label: newLabel.trim(), url: normalizeUrl(newUrl.trim()) }];
    setLinks(updated); setNewLabel(""); setNewUrl(""); setAdding(false);
    save(updated);
  };
  const removeLink = (i: number) => { const updated = links.filter((_, idx) => idx !== i); setLinks(updated); save(updated); };

  const urlValid = newUrl.trim() === "" || isValidUrl(newUrl.trim());
  const canAdd = newLabel.trim().length > 0 && isValidUrl(newUrl.trim());

  return (
    <div className="border-t border-outline-variant/20 pt-4 flex flex-col gap-3">
      <div className="flex items-center justify-between min-h-[20px]">
        <p className="text-sm font-medium text-on-surface-variant">External links</p>
        <StatusBadge status={status} />
      </div>
      {status === "error" && errorDetail && (
        <p className="text-xs text-destructive">{errorDetail}</p>
      )}

      <div className="space-y-2">
        {links.map((link, i) => {
          const service = KNOWN_SERVICES.find(s => link.url.includes(s.pattern))?.label;
          return (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface">{link.label}</p>
                <p className="text-xs text-on-surface-variant truncate">{link.url}{service ? ` · ${service}` : ""}</p>
              </div>
              <CopyButton url={link.url} />
              <a href={link.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface transition-colors" title="Open"><ExternalLink className="w-3.5 h-3.5" /></a>
              <button type="button" onClick={() => removeLink(i)} className="p-1.5 rounded-md text-on-surface-variant hover:text-destructive transition-colors" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-2">
          <input type="text" placeholder='Label — e.g. "30 min consult"' value={newLabel} onChange={e => setNewLabel(e.target.value)}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]" />
          <div>
            <input type="url" placeholder="calendly.com/…" value={newUrl} onChange={e => setNewUrl(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm text-on-surface bg-surface border rounded-lg focus:outline-none placeholder:text-[#888888] ${!urlValid ? "border-red-400" : "border-outline-variant/30 focus:border-primary"}`} />
            {!urlValid && <p className="text-xs text-red-500 mt-1">Enter a valid URL (e.g. https://calendly.com/…)</p>}
            {urlValid && detected && <p className="text-xs text-on-surface-variant mt-1">Detected: {detected}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setAdding(false); setNewLabel(""); setNewUrl(""); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-colors">Cancel</button>
            <button type="button" onClick={addLink} disabled={!canAdd}
              style={{ background: "#000", color: "#fff", opacity: canAdd ? 1 : 0.65 }}
              className="px-4 py-2.5 text-sm font-medium rounded-lg transition-opacity">Add link</button>
              </div>
            </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
          <Plus className="w-4 h-4" /> External link
        </button>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function LinksView({
  initialPaymentLinks,
  initialCalendarLinks,
  initialSchedulingLinks,
  initialBlockedDates = [],
  paymentsConnected = false,
  paymentProvider = null,
  isCalendarConnected = false,
  artistId,
}: {
  initialPaymentLinks: PaymentLink[];
  initialCalendarLinks: CalendarLink[];
  initialSchedulingLinks: SchedulingLink[];
  initialBlockedDates?: string[];
  paymentsConnected?: boolean;
  paymentProvider?: "stripe" | "square" | null;
  isCalendarConnected?: boolean;
  artistId: string;
}) {
  const [pendingAdd, setPendingAdd] = useState<PaymentLink | null>(null);

  return (
    <div className="max-w-4xl">
      <CoachmarkSequence tips={[
        {
          id: "links.scheduling-section",
          anchorSelector: '[data-coachmark="scheduling-links-section"]',
          title: "Let clients book themselves",
          body: <>
            <p>A scheduling link shows clients your open slots (based on your Google Calendar) and locks in a time.</p>
            <p>Paste it into emails or share it directly.</p>
            <p>Skip this if you prefer to book everyone manually.</p>
          </>,
        },
        {
          id: "links.blocked-dates",
          anchorSelector: '[data-coachmark="blocked-dates-section"]',
          title: "Block out time off",
          body: <>
            <p>Add dates here when you&apos;re away or not booking.</p>
            <p>They&apos;re hidden from every scheduling link automatically.</p>
          </>,
        },
      ]} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 items-start">

        {/* Left: Payment */}
        <div className="flex flex-col gap-6 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold text-on-surface">Payment</h2>
            </div>
            <div className="flex flex-col gap-6">
              {paymentsConnected && paymentProvider && (
                <PaymentLinkGeneratorSection
                  provider={paymentProvider}
                  onLinkGenerated={link => setPendingAdd(link)}
                />
              )}
              <PaymentLinksSection initialLinks={initialPaymentLinks} externalAdd={pendingAdd} />
            </div>
          </div>
        </div>

        {/* Divider on mobile */}
        <div className="md:hidden border-t border-outline-variant/20 mb-6" />

        {/* Right: Scheduling */}
        <div className="flex flex-col gap-6 pb-8 md:border-l md:border-outline-variant/20 md:pl-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold text-on-surface">Scheduling</h2>
            </div>
            <div className="flex flex-col gap-6">
              <NativeSchedulingSection initialLinks={initialSchedulingLinks} artistId={artistId} isCalendarConnected={isCalendarConnected} />
              <BlockedDatesSection initialDates={initialBlockedDates} />
              <ExternalCalendarSection initialLinks={initialCalendarLinks} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
