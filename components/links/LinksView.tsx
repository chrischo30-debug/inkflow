"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, ExternalLink, Zap, Pencil, X, BanIcon } from "lucide-react";
import type { PaymentLink, CalendarLink, SchedulingLink } from "@/lib/pipeline-settings";
import { CoachmarkSequence } from "@/components/coachmarks/Coachmark";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function isValidUrl(val: string): boolean {
  try { const u = new URL(val); return u.protocol === "https:" || u.protocol === "http:"; }
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

function StatusBadge({ status }: { status: SaveStatus }) {
  if (status === "saved") return <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3 h-3" /> Saved</span>;
  if (status === "saving") return <span className="text-xs text-on-surface-variant">Saving…</span>;
  if (status === "error") return <span className="text-xs text-destructive">Failed to save</span>;
  return null;
}

// ── Payment Links ─────────────────────────────────────────────────────────────

function PaymentLinksSection({ initialLinks, externalAdd }: { initialLinks: PaymentLink[]; externalAdd?: PaymentLink | null }) {
  const [links, setLinks] = useState<PaymentLink[]>(initialLinks);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    if (!externalAdd) return;
    const updated = [...links, externalAdd];
    setLinks(updated);
    save(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalAdd]);

  const save = async (updated: PaymentLink[]) => {
    setStatus("saving");
    const res = await fetch("/api/artist/payment-links", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: updated }) });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addLink = () => {
    if (!newLabel.trim() || !isValidUrl(newUrl.trim())) return;
    const updated = [...links, { label: newLabel.trim(), url: newUrl.trim() }];
    setLinks(updated); setNewLabel(""); setNewUrl(""); setAdding(false);
    save(updated);
  };
  const removeLink = (i: number) => { const updated = links.filter((_, idx) => idx !== i); setLinks(updated); save(updated); };

  const urlValid = newUrl.trim() === "" || isValidUrl(newUrl.trim());
  const canAdd = newLabel.trim().length > 0 && isValidUrl(newUrl.trim());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between min-h-[20px]">
        <p className="text-xs text-on-surface-variant">
          Use <code className="bg-surface-container-high px-1 py-0.5 rounded text-[11px]">{"{paymentLinks}"}</code> in email templates.
        </p>
        <StatusBadge status={status} />
      </div>

      <div className="space-y-2">
        {links.length === 0 && !adding && (
          <p className="text-xs text-on-surface-variant/60 py-1">No payment links yet.</p>
        )}
        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface">{link.label}</p>
              <p className="text-xs text-on-surface-variant truncate">{link.url}</p>
            </div>
            <CopyButton url={link.url} />
            <a href={link.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface transition-colors" title="Open"><ExternalLink className="w-3.5 h-3.5" /></a>
            <button type="button" onClick={() => removeLink(i)} className="p-1.5 rounded-md text-on-surface-variant hover:text-destructive transition-colors" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-2">
          <input type="text" placeholder='Label — e.g. "Stripe deposit"' value={newLabel} onChange={e => setNewLabel(e.target.value)}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]" />
          <div>
            <input type="url" placeholder="https://buy.stripe.com/…" value={newUrl} onChange={e => setNewUrl(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm text-on-surface bg-surface border rounded-lg focus:outline-none placeholder:text-[#888888] ${!urlValid ? "border-red-400" : "border-outline-variant/30 focus:border-primary"}`} />
            {!urlValid && <p className="text-xs text-red-500 mt-1">Enter a valid URL starting with https://</p>}
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

// ── Stripe Generator ──────────────────────────────────────────────────────────

type GenerateStatus = "idle" | "generating" | "done" | "error";

function StripeGeneratorSection({ onLinkGenerated }: { onLinkGenerated: (link: PaymentLink) => void }) {
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
    const res = await fetch("/api/stripe/payment-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label.trim(), amount_cents: Math.round(amount * 100) }) });
    const data = await res.json();
    if (res.ok && data.url) { setGeneratedUrl(data.url); setGenStatus("done"); }
    else { setErrorMsg(data.error ?? "Failed to generate link"); setGenStatus("error"); }
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
        <p className="text-sm font-semibold text-on-surface">Generate Stripe link</p>
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
            <button type="button" onClick={() => { if (generatedUrl) { onLinkGenerated({ label: label.trim(), url: generatedUrl }); setSaved(true); } }} disabled={saved}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${saved ? "border-emerald-300/60 text-emerald-700 bg-emerald-50/40" : "border-outline-variant/40 text-on-surface hover:bg-surface-container-high"}`}>
              {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : "Save to payment links"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Native Scheduling Links ───────────────────────────────────────────────────

const DURATIONS = [
  { label: "1 hr", minutes: 60 }, { label: "1.5 hrs", minutes: 90 },
  { label: "2 hrs", minutes: 120 }, { label: "2.5 hrs", minutes: 150 },
  { label: "3 hrs", minutes: 180 }, { label: "3.5 hrs", minutes: 210 },
  { label: "4 hrs", minutes: 240 },
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6;
  return { label: h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`, value: h };
});
const TIMEZONES = [
  { label: "Eastern (ET)", value: "America/New_York" },
  { label: "Central (CT)", value: "America/Chicago" },
  { label: "Mountain (MT)", value: "America/Denver" },
  { label: "Pacific (PT)", value: "America/Los_Angeles" },
  { label: "Arizona (AZ)", value: "America/Phoenix" },
  { label: "Alaska (AKT)", value: "America/Anchorage" },
  { label: "Hawaii (HST)", value: "Pacific/Honolulu" },
];

function generateId() { return Math.random().toString(36).slice(2, 10); }
function newLinkDraft(): Omit<SchedulingLink, "id"> {
  return { label: "", duration_minutes: 120, days: [1, 2, 3, 4, 5], start_hour: 10, end_hour: 19, timezone: "America/New_York", block_full_day: false, confirmation_message: "" };
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} role="switch" aria-checked={on}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? "bg-on-surface" : "bg-outline-variant/40"}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

interface CalendarOption { id: string; summary: string; primary: boolean; color: string; }

function NativeSchedulingSection({ initialLinks, artistId, isCalendarConnected }: { initialLinks: SchedulingLink[]; artistId: string; isCalendarConnected: boolean }) {
  const [links, setLinks] = useState<SchedulingLink[]>(initialLinks);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(newLinkDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(newLinkDraft());
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [calendarOptions, setCalendarOptions] = useState<CalendarOption[]>([]);
  const [calendarsLoading, setCalendarsLoading] = useState(false);

  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!isCalendarConnected) return;
    setCalendarsLoading(true);
    fetch("/api/artist/calendar-list")
      .then(r => r.json())
      .then((d: { calendars?: CalendarOption[] }) => setCalendarOptions(d.calendars ?? []))
      .catch(() => {})
      .finally(() => setCalendarsLoading(false));
  }, [isCalendarConnected]);

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
    setEditDraft({ label: link.label, duration_minutes: link.duration_minutes, days: link.days, start_hour: link.start_hour, end_hour: link.end_hour, timezone: link.timezone, calendar_ids: link.calendar_ids ?? [], block_full_day: link.block_full_day ?? false, confirmation_message: link.confirmation_message ?? "" });
  };

  const toggleCalendarInDraft = (id: string) =>
    setDraft(prev => { const ids = prev.calendar_ids ?? []; return { ...prev, calendar_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }; });

  const toggleCalendarInEditDraft = (id: string) =>
    setEditDraft(prev => { const ids = prev.calendar_ids ?? []; return { ...prev, calendar_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }; });

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

  const toggleDay = (d: number) => {
    setDraft(prev => ({ ...prev, days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d].sort() }));
  };

  const toggleEditDay = (d: number) => {
    setEditDraft(prev => ({ ...prev, days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d].sort() }));
  };

  const durationLabel = (m: number) => DURATIONS.find(d => d.minutes === m)?.label ?? `${m / 60}h`;
  const hourLabel = (h: number) => HOURS.find(x => x.value === h)?.label ?? `${h}:00`;

  const canAdd = draft.label.trim().length > 0 && draft.days.length > 0 && draft.start_hour < draft.end_hour;
  const canSaveEdit = editDraft.label.trim().length > 0 && editDraft.days.length > 0 && editDraft.start_hour < editDraft.end_hour;

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-4" data-coachmark="scheduling-links-section">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-on-surface">Scheduling Links</p>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm text-on-surface-variant">
        Clients pick from open slots based on your Google Calendar availability.
        <br />Copy the link and paste it into any email.
      </p>

      <div className="space-y-2">
        {links.length === 0 && !adding && (
          <p className="text-xs text-on-surface-variant/60 py-1">No scheduling links yet.</p>
        )}
        {links.map(link => {
          const url = `${origin}/schedule/${artistId}/${link.id}`;
          const isEditing = editingId === link.id;

          if (isEditing) {
            return (
              <div key={link.id} className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant block mb-1">Link name</label>
                  <input type="text" value={editDraft.label} onChange={e => setEditDraft(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant block mb-1">Session duration</label>
                  <select value={editDraft.duration_minutes} onChange={e => setEditDraft(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
                    {DURATIONS.map(d => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant block mb-2">Available days</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_LABELS.map((label, i) => (
                      <button key={i} type="button" onClick={() => toggleEditDay(i)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${editDraft.days.includes(i) ? "bg-on-surface text-surface border-on-surface" : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-on-surface-variant block mb-1">Earliest start</label>
                    <select value={editDraft.start_hour} onChange={e => setEditDraft(prev => ({ ...prev, start_hour: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
                      {HOURS.slice(0, -1).map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-on-surface-variant block mb-1">Latest end</label>
                    <select value={editDraft.end_hour} onChange={e => setEditDraft(prev => ({ ...prev, end_hour: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
                      {HOURS.slice(1).map(h => <option key={h.value} value={h.value} disabled={h.value <= editDraft.start_hour}>{h.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant block mb-1">Timezone</label>
                  <select value={editDraft.timezone} onChange={e => setEditDraft(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
                    {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-4 py-1 border-t border-outline-variant/15">
                  <div>
                    <p className="text-xs font-medium text-on-surface">Full-day sessions</p>
                    <p className="text-xs text-on-surface-variant">Once a booking is confirmed for a day, hide all remaining slots</p>
                  </div>
                  <Toggle on={!!editDraft.block_full_day} onToggle={() => setEditDraft(prev => ({ ...prev, block_full_day: !prev.block_full_day }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant block mb-1">Confirmation message</label>
                  <textarea value={editDraft.confirmation_message ?? ""} onChange={e => setEditDraft(prev => ({ ...prev, confirmation_message: e.target.value }))}
                    rows={3} placeholder="Shown to clients after they confirm a slot. Leave blank for default."
                    className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888] resize-none" />
                </div>
                {isCalendarConnected && (
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant block mb-2">Check availability against</label>
                    {calendarsLoading ? (
                      <p className="text-xs text-on-surface-variant/60">Loading calendars…</p>
                    ) : (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => setEditDraft(prev => ({ ...prev, calendar_ids: [] }))}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${(editDraft.calendar_ids ?? []).length === 0 ? "bg-on-surface border-on-surface" : "border-outline-variant/50"}`}>
                            {(editDraft.calendar_ids ?? []).length === 0 && <Check className="w-2.5 h-2.5 text-surface" />}
                          </div>
                          <span className="text-xs text-on-surface font-medium select-none">All calendars</span>
                        </label>
                        {calendarOptions.length > 0 && <div className="border-t border-outline-variant/15 pt-2 space-y-2">
                          {calendarOptions.map(cal => {
                            const checked = (editDraft.calendar_ids ?? []).includes(cal.id);
                            return (
                              <label key={cal.id} className="flex items-center gap-2.5 cursor-pointer" onClick={() => toggleCalendarInEditDraft(cal.id)}>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-on-surface border-on-surface" : "border-outline-variant/50"}`}>
                                  {checked && <Check className="w-2.5 h-2.5 text-surface" />}
                                </div>
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cal.color }} />
                                <span className="text-xs text-on-surface select-none">{cal.summary}{cal.primary && <span className="text-on-surface-variant ml-1">(primary)</span>}</span>
                              </label>
                            );
                          })}
                        </div>}
                      </div>
                    )}
                  </div>
                )}
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
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1">Link name</label>
            <input type="text" placeholder='e.g. "2-Hour Tattoo Session"' value={draft.label}
              onChange={e => setDraft(prev => ({ ...prev, label: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]" />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1">Session duration</label>
            <select value={draft.duration_minutes} onChange={e => setDraft(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
              {DURATIONS.map(d => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-2">Available days</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${draft.days.includes(i) ? "bg-on-surface text-surface border-on-surface" : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-on-surface-variant block mb-1">Earliest start</label>
              <select value={draft.start_hour} onChange={e => setDraft(prev => ({ ...prev, start_hour: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
                {HOURS.slice(0, -1).map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-on-surface-variant block mb-1">Latest end</label>
              <select value={draft.end_hour} onChange={e => setDraft(prev => ({ ...prev, end_hour: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
                {HOURS.slice(1).map(h => <option key={h.value} value={h.value} disabled={h.value <= draft.start_hour}>{h.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1">Timezone</label>
            <select value={draft.timezone} onChange={e => setDraft(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
              {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between gap-4 py-1 border-t border-outline-variant/15">
            <div>
              <p className="text-xs font-medium text-on-surface">Full-day sessions</p>
              <p className="text-xs text-on-surface-variant">Once a booking is confirmed for a day, hide all remaining slots</p>
            </div>
            <Toggle on={!!draft.block_full_day} onToggle={() => setDraft(prev => ({ ...prev, block_full_day: !prev.block_full_day }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1">Confirmation message</label>
            <textarea value={draft.confirmation_message ?? ""} onChange={e => setDraft(prev => ({ ...prev, confirmation_message: e.target.value }))}
              rows={3} placeholder="Shown to clients after they confirm a slot. Leave blank for default."
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888] resize-none" />
          </div>
          {isCalendarConnected && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-2">Check availability against</label>
              {calendarsLoading ? (
                <p className="text-xs text-on-surface-variant/60">Loading calendars…</p>
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => setDraft(prev => ({ ...prev, calendar_ids: [] }))}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${(draft.calendar_ids ?? []).length === 0 ? "bg-on-surface border-on-surface" : "border-outline-variant/50"}`}>
                      {(draft.calendar_ids ?? []).length === 0 && <Check className="w-2.5 h-2.5 text-surface" />}
                    </div>
                    <span className="text-xs text-on-surface font-medium select-none">All calendars</span>
                  </label>
                  {calendarOptions.length > 0 && <div className="border-t border-outline-variant/15 pt-2 space-y-2">
                    {calendarOptions.map(cal => {
                      const checked = (draft.calendar_ids ?? []).includes(cal.id);
                      return (
                        <label key={cal.id} className="flex items-center gap-2.5 cursor-pointer" onClick={() => toggleCalendarInDraft(cal.id)}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-on-surface border-on-surface" : "border-outline-variant/50"}`}>
                            {checked && <Check className="w-2.5 h-2.5 text-surface" />}
                          </div>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cal.color }} />
                          <span className="text-xs text-on-surface select-none">{cal.summary}{cal.primary && <span className="text-on-surface-variant ml-1">(primary)</span>}</span>
                        </label>
                      );
                    })}
                  </div>}
                </div>
              )}
            </div>
          )}
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
          <p className="text-sm font-semibold text-on-surface">Blocked Dates</p>
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

  const detected = newUrl ? KNOWN_SERVICES.find(s => newUrl.includes(s.pattern))?.label ?? null : null;

  const save = async (updated: CalendarLink[]) => {
    setStatus("saving");
    const res = await fetch("/api/artist/pipeline-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendar_links: updated }) });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addLink = () => {
    if (!newLabel.trim() || !isValidUrl(newUrl.trim())) return;
    const updated = [...links, { label: newLabel.trim(), url: newUrl.trim() }];
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
            <input type="url" placeholder="https://calendly.com/…" value={newUrl} onChange={e => setNewUrl(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm text-on-surface bg-surface border rounded-lg focus:outline-none placeholder:text-[#888888] ${!urlValid ? "border-red-400" : "border-outline-variant/30 focus:border-primary"}`} />
            {!urlValid && <p className="text-xs text-red-500 mt-1">Enter a valid URL starting with https://</p>}
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
  hasStripe = false,
  isCalendarConnected = false,
  artistId,
}: {
  initialPaymentLinks: PaymentLink[];
  initialCalendarLinks: CalendarLink[];
  initialSchedulingLinks: SchedulingLink[];
  initialBlockedDates?: string[];
  hasStripe?: boolean;
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
              {hasStripe && <StripeGeneratorSection onLinkGenerated={link => setPendingAdd(link)} />}
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
