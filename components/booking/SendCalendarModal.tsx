"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Plus, Eye, Pencil } from "lucide-react";
import type { SchedulingLink } from "@/lib/pipeline-settings";
import { BodyPreview, type InsertLink } from "./EmailComposeModal";
import { EmailVarChips } from "@/components/shared/EmailVarChips";
import { FormatToolbar } from "@/components/shared/FormatToolbar";

interface Props {
  bookingId: string;
  clientName: string;
  schedulingLinks: SchedulingLink[];
  artistId: string;
  onSent: () => void;
  onClose: () => void;
}

interface Template { state: string | null; subject: string; body: string; }

const DURATIONS = [60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];
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

export function SendCalendarModal({ bookingId, clientName, schedulingLinks: initialLinks, artistId, onSent, onClose }: Props) {
  const [links, setLinks] = useState<SchedulingLink[]>(initialLinks);
  const [selectedLinkId, setSelectedLinkId] = useState<string>(initialLinks[0]?.id ?? "");
  const [creatingNew, setCreatingNew] = useState(initialLinks.length === 0);
  const [newLink, setNewLink] = useState<Omit<SchedulingLink, "id">>({
    label: "", duration_minutes: 120, days: [1, 2, 3, 4, 5], start_hour: 10, end_hour: 19, timezone: "America/New_York",
  });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  // Variable-resolution context — populated from /send-email so the preview
  // shows real values and the variable chips list the artist's saved links.
  const [paymentLinks, setPaymentLinks] = useState<InsertLink[]>([]);
  const [calendarLinks, setCalendarLinks] = useState<InsertLink[]>([]);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [chipSchedulingLinks, setChipSchedulingLinks] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}/send-email`)
      .then(r => r.json())
      .then(data => {
        const all: Template[] = data.templates ?? [];
        setTemplates(all);
        setPaymentLinks(data.paymentLinks ?? []);
        setCalendarLinks(data.calendarLinks ?? []);
        setPreviewVars(data.previewVars ?? {});
        setChipSchedulingLinks(
          Array.isArray(data.schedulingLinks)
            ? data.schedulingLinks
            : initialLinks.map(l => ({ id: l.id, label: l.label }))
        );
        const calTpl = all.find(t => t.state === "sent_calendar") ?? all[0];
        if (calTpl) { setSubject(calTpl.subject); setBody(calTpl.body); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId, initialLinks]);

  const effectiveLinkId = creatingNew ? "" : selectedLinkId;
  const schedulingUrl = effectiveLinkId
    ? `${origin}/schedule/${artistId}/${effectiveLinkId}?bid=${bookingId}`
    : "";

  // Keep the Preview tab in sync with the currently picked scheduling link so
  // {schedulingLink} resolves to a live URL instead of the placeholder mark.
  useEffect(() => {
    const matched = links.find(l => l.id === effectiveLinkId);
    setPreviewVars(prev => ({
      ...prev,
      schedulingLink: schedulingUrl,
      schedulingLinkLabel: matched?.label ?? prev.schedulingLinkLabel ?? "",
    }));
  }, [schedulingUrl, effectiveLinkId, links]);

  const toggleNewDay = (d: number) => {
    setNewLink(prev => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d].sort(),
    }));
  };

  const saveNewLink = async (): Promise<SchedulingLink | null> => {
    if (!newLink.label.trim()) return null;
    const link: SchedulingLink = { ...newLink, id: generateId(), label: newLink.label.trim() };
    const updated = [...links, link];
    const res = await fetch("/api/artist/scheduling-links", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links: updated }),
    });
    if (!res.ok) return null;
    setLinks(updated);
    return link;
  };

  const insertAtCursor = (text: string) => {
    if (mode === "preview") setMode("edit");
    const isSubject = lastFocused.current === "subject";
    const el = (isSubject ? subjectRef.current : textareaRef.current) as HTMLInputElement | HTMLTextAreaElement | null;
    const val = isSubject ? subject : body;
    if (!el) {
      if (isSubject) setSubject(v => v + text);
      else setBody(v => v + (v.endsWith("\n") || v === "" ? "" : "\n") + text);
      return;
    }
    const start = el.selectionStart ?? val.length;
    const end = el.selectionEnd ?? val.length;
    const before = val.slice(0, start);
    const needsNewline = !isSubject && before.length > 0 && !before.endsWith("\n");
    const insert = (needsNewline ? "\n" : "") + text;
    const newVal = before + insert + val.slice(end);
    if (isSubject) setSubject(newVal);
    else setBody(newVal);
    requestAnimationFrame(() => {
      el.selectionStart = start + insert.length;
      el.selectionEnd = start + insert.length;
      el.focus();
    });
  };

  const send = async () => {
    setSending(true); setError("");
    try {
      let linkId = effectiveLinkId;

      if (creatingNew) {
        const saved = await saveNewLink();
        if (!saved) { setError("Please fill in the link name to create it."); setSending(false); return; }
        linkId = saved.id;
      }

      if (!linkId) { setError("Please select or create a scheduling link."); setSending(false); return; }

      const finalBody = body.replace(/\{schedulingLink\}/g, `${origin}/schedule/${artistId}/${linkId}?bid=${bookingId}`);

      const res = await fetch(`/api/bookings/${bookingId}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body: finalBody }),
      });
      if (!res.ok) throw new Error("Failed to send");

      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", target_state: "sent_calendar", scheduling_link_id: linkId }),
      });

      onSent();
    } catch { setError("Something went wrong. Try again."); }
    finally { setSending(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant/10 shrink-0">
          <h2 className="text-base font-semibold text-on-surface">Send Calendar Link</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Send {clientName} a link to pick their appointment time.</p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Scheduling link picker */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">Scheduling link</p>

            {links.length > 0 && !creatingNew && (
              <div className="space-y-2">
                {links.map(l => (
                  <label key={l.id} className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-outline-variant/20 hover:bg-surface-container-low transition-colors">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedLinkId === l.id ? "border-on-surface" : "border-outline-variant/50"}`}
                      onClick={() => setSelectedLinkId(l.id)}>
                      {selectedLinkId === l.id && <div className="w-2 h-2 rounded-full bg-on-surface" />}
                    </div>
                    <div className="flex-1 min-w-0" onClick={() => setSelectedLinkId(l.id)}>
                      <p className="text-sm font-medium text-on-surface">{l.label}</p>
                      <p className="text-xs text-on-surface-variant">{l.duration_minutes / 60}h · {l.days.map(d => DAY_LABELS[d]).join(", ")}</p>
                    </div>
                  </label>
                ))}
                <button type="button" onClick={() => setCreatingNew(true)}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Create new link
                </button>
              </div>
            )}

            {creatingNew && (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-on-surface-variant">New scheduling link</p>
                  {links.length > 0 && (
                    <button type="button" onClick={() => setCreatingNew(false)} className="text-sm text-on-surface-variant hover:text-on-surface-variant underline">
                      Use existing
                    </button>
                  )}
                </div>
                <input type="text" placeholder='e.g. "3-Hour Tattoo Session"' value={newLink.label}
                  onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary" />
                <select value={newLink.duration_minutes}
                  onChange={e => setNewLink(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
                  {DURATIONS.map(d => <option key={d} value={d}>{d / 60} hr{d !== 60 ? "s" : ""}</option>)}
                </select>
                <div>
                  <p className="text-xs text-on-surface-variant mb-1.5">Available days</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_LABELS.map((label, i) => (
                      <button key={i} type="button" onClick={() => toggleNewDay(i)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${newLink.days.includes(i) ? "bg-on-surface text-surface border-on-surface" : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant mb-1">Start</p>
                    <select value={newLink.start_hour}
                      onChange={e => setNewLink(p => ({ ...p, start_hour: Number(e.target.value) }))}
                      className="w-full px-2 py-1.5 text-xs text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none">
                      {HOURS.slice(0, -1).map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant mb-1">End</p>
                    <select value={newLink.end_hour}
                      onChange={e => setNewLink(p => ({ ...p, end_hour: Number(e.target.value) }))}
                      className="w-full px-2 py-1.5 text-xs text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none">
                      {HOURS.slice(1).map(h => <option key={h.value} value={h.value} disabled={h.value <= newLink.start_hour}>{h.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant mb-1">Timezone</p>
                    <select value={newLink.timezone}
                      onChange={e => setNewLink(p => ({ ...p, timezone: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none">
                      {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {schedulingUrl && (
              <p className="text-[11px] font-mono text-on-surface-variant/60 break-all">{schedulingUrl}</p>
            )}
          </div>

          {/* Email compose */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">Email to client</p>
            {loading ? (
              <p className="text-sm text-on-surface-variant">Loading template…</p>
            ) : (
              <>
                {/* Subject */}
                <div>
                  <label className="text-xs font-medium text-on-surface-variant tracking-wide mb-1.5 block">Subject</label>
                  {mode === "edit" ? (
                    <input ref={subjectRef} type="text" value={subject} onChange={e => setSubject(e.target.value)}
                      onFocus={() => { lastFocused.current = "subject"; }}
                      placeholder="Subject"
                      className="w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors" />
                  ) : (
                    <div className="px-4 py-3 bg-surface-container-high/40 border-b border-outline-variant rounded-t-lg rounded-b-none cursor-text" onClick={() => setMode("edit")}>
                      <BodyPreview text={subject} vars={previewVars} resolved compact paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
                    </div>
                  )}
                </div>

                {/* Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-on-surface-variant tracking-wide">Message</label>
                    <div className="flex items-center gap-0.5 bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/20">
                      <button type="button" onClick={() => setMode("edit")}
                        className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${mode === "edit" ? "bg-surface text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}>
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button type="button" onClick={() => setMode("preview")}
                        className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${mode === "preview" ? "bg-surface text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}>
                        <Eye className="w-3 h-3" /> Preview
                      </button>
                    </div>
                  </div>
                  {mode === "edit" ? (
                    <div className="bg-surface-container-high/40 rounded-t-lg border-b border-outline-variant focus-within:border-primary transition-colors">
                      <FormatToolbar
                        textareaRef={textareaRef}
                        value={body}
                        onChange={setBody}
                        onFocus={() => { lastFocused.current = "body"; }}
                      />
                      <textarea ref={textareaRef} value={body} onChange={e => setBody(e.target.value)}
                        onFocus={() => { lastFocused.current = "body"; }}
                        rows={7} placeholder="Email body"
                        className="w-full border-0 bg-transparent px-4 py-3 text-sm text-on-surface focus:outline-none resize-none" />
                    </div>
                  ) : (
                    <div className="px-4 py-3 bg-surface-container-high/40 border-b border-outline-variant rounded-t-lg rounded-b-none cursor-text min-h-[140px]" onClick={() => setMode("edit")}>
                      <BodyPreview text={body} vars={previewVars} resolved paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
                    </div>
                  )}
                </div>

                {/* Variable chips */}
                <div className="space-y-1.5">
                  <p className="text-xs text-on-surface-variant">Insert variable into focused field:</p>
                  <EmailVarChips onInsert={insertAtCursor} paymentLinks={paymentLinks} calendarLinks={calendarLinks} schedulingLinks={chipSchedulingLinks.length > 0 ? chipSchedulingLinks : links} />
                </div>
              </>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-outline-variant/10 shrink-0 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Cancel
          </button>
          <button type="button" onClick={send} disabled={sending || (!effectiveLinkId && !creatingNew) || !subject.trim() || !body.trim()}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center gap-2">
            {sending ? "Sending…" : <><CalendarDays className="w-4 h-4" /> Send &amp; move to Sent Calendar</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
