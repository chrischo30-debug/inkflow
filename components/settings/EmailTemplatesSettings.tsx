"use client";

import { useState, useEffect, useRef } from "react";
import { BookingState, EmailTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, Plus, Trash2, Eye, Pencil } from "lucide-react";
import type { PaymentLink, CalendarLink, SchedulingLink } from "@/lib/pipeline-settings";
import { templateRequiresEdit } from "@/lib/email";
import { CoachmarkSequence, type Tip } from "@/components/coachmarks/Coachmark";
import { EmailVarChips } from "@/components/shared/EmailVarChips";
import { FormatToolbar } from "@/components/shared/FormatToolbar";

// ── Body preview — resolves variables with sample data ────────────────────────

function resolvePreview(
  text: string,
  artistName: string,
  paymentLinks: PaymentLink[],
  calendarLinks: CalendarLink[],
  studioAddress: string,
  schedulingLinks: SchedulingLink[] = [],
  artistId = "",
): string {
  const findByLabel = (links: { label: string; url: string }[], label: string) =>
    links.find(l => l.label.trim().toLowerCase() === label.trim().toLowerCase())?.url ?? null;

  // Mirror lib/email.ts: lines whose only meaningful token would render empty
  // get dropped from the preview so artists see what clients will actually see.
  const dropEmpty = (s: string): string => {
    const empties = new Set<string>();
    if (!studioAddress) empties.add("studioAddress");
    if (empties.size === 0) return s;
    return s.split("\n").filter(line => {
      for (const k of empties) if (line.includes(`{${k}}`)) return false;
      return true;
    }).join("\n");
  };

  return dropEmpty(text)
    .replace(/\{paymentLink:([^}]+)\}/g, (_, label: string) => {
      const url = findByLabel(paymentLinks, label) ?? paymentLinks[0]?.url ?? "https://pay.example.com";
      return `[${label.trim()}](${url})`;
    })
    .replace(/\{calendarLink:([^}]+)\}/g, (_, label: string) => {
      const url = findByLabel(calendarLinks, label) ?? calendarLinks[0]?.url ?? "https://calendly.com/example";
      return `[${label.trim()}](${url})`;
    })
    .replace(/\{clientFirstName\}/g, "Jane")
    .replace(/\{clientName\}/g, "Jane Doe")
    .replace(/\{artistName\}/g, artistName || "Your Studio")
    .replace(/\{paymentLink\}/g, () => {
      const url = paymentLinks[0]?.url ?? "https://pay.example.com";
      const label = paymentLinks[0]?.label ?? "Payment link";
      return `[${label}](${url})`;
    })
    .replace(/\{calendarLink\}/g, () => {
      const url = calendarLinks[0]?.url ?? "https://calendly.com/example";
      const label = calendarLinks[0]?.label ?? "Scheduling link";
      return `[${label}](${url})`;
    })
    .replace(/\{appointmentDate\}/g, "May 3, 2026")
    .replace(/\{schedulingLink\}/g, () => {
      const label = schedulingLinks[0]?.label ?? "Scheduling link";
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const id = schedulingLinks[0]?.id ?? "";
      const url = artistId && id ? `${origin}/schedule/${artistId}/${id}` : `${origin}/schedule`;
      return `[${label}](${url})`;
    })
    .replace(/\{studioAddress\}/g, studioAddress || "123 Main St, Brooklyn NY")
    .replace(/\{studioMapsUrl\}/g, () => {
      const addr = studioAddress || "123 Main St, Brooklyn NY";
      return `[Get directions](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)})`;
    });
}

// Combined inline regex for the resolved preview: bold, italic, md-link
// groups: 1=bold 2=italic 3=mdLabel 4=mdUrl
const SETTINGS_INLINE_RE = new RegExp(
  [/\*\*(.+?)\*\*/, /\*(.+?)\*/, /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/].map(r => r.source).join('|'),
  'g',
);

type SettingsToken =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'link'; label: string; url: string };

function tokenizeSettingsInline(text: string): SettingsToken[] {
  const re = new RegExp(SETTINGS_INLINE_RE.source, 'g');
  const tokens: SettingsToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[0].startsWith('**'))     tokens.push({ t: 'bold', v: m[1] });
    else if (m[0].startsWith('*')) tokens.push({ t: 'italic', v: m[2] });
    else                           tokens.push({ t: 'link', label: m[3], url: m[4] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ t: 'text', v: text.slice(last) });
  return tokens;
}

function renderSettingsTokens(tokens: SettingsToken[]): React.ReactNode[] {
  return tokens.map((tk, i) => {
    if (tk.t === 'text')   return <span key={i}>{tk.v}</span>;
    if (tk.t === 'bold')   return <strong key={i} className="font-semibold">{tk.v}</strong>;
    if (tk.t === 'italic') return <em key={i}>{tk.v}</em>;
    return (
      <a key={i} href={tk.url} target="_blank" rel="noreferrer"
        className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">
        {tk.label}
      </a>
    );
  });
}

function BodyPreview({ text, artistName, paymentLinks, calendarLinks, studioAddress, schedulingLinks = [], artistId = "" }: {
  text: string;
  artistName: string;
  paymentLinks: PaymentLink[];
  calendarLinks: CalendarLink[];
  studioAddress: string;
  schedulingLinks?: SchedulingLink[];
  artistId?: string;
}) {
  const resolved = resolvePreview(text, artistName, paymentLinks, calendarLinks, studioAddress, schedulingLinks, artistId);

  // Process line-by-line: empty lines → explicit <br>, bullets → <ul>, text → <div>
  const lines = resolved.split('\n');
  type Segment = { type: 'line'; content: string } | { type: 'bullets'; items: string[] };
  const segments: Segment[] = [];
  let i = 0;
  while (i < lines.length) {
    if (/^- /.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
      segments.push({ type: 'bullets', items });
    } else {
      segments.push({ type: 'line', content: lines[i] });
      i++;
    }
  }

  return (
    <div className="text-sm text-on-surface leading-relaxed min-h-[140px]">
      {segments.map((seg, si) => {
        if (seg.type === 'bullets') {
          return (
            <ul key={si} className="list-disc list-inside my-0 space-y-0.5">
              {seg.items.map((item, li) => (
                <li key={li}>{renderSettingsTokens(tokenizeSettingsInline(item))}</li>
              ))}
            </ul>
          );
        }
        if (seg.content === '') return <br key={si} />;
        return <div key={si}>{renderSettingsTokens(tokenizeSettingsInline(seg.content))}</div>;
      })}
    </div>
  );
}

// `sent_deposit` intentionally omitted — booking-pipeline state, but the
// editable template is "Deposit Request" (accepted) which is reused for both
// the initial deposit ask and any follow-up reminders.
const STATE_LABELS: Partial<Record<Exclude<BookingState, "cancelled">, string>> = {
  inquiry:       "Submission Received",
  follow_up:     "Follow Up",
  accepted:      "Deposit Request",
  sent_calendar: "Calendar Link (after deposit)",
  booked:        "Appointment Booked",
  confirmed:     "Appointment Booked",
  completed:     "Appointment Completed",
  rejected:      "Submission Rejected",
};

type SaveStatus = "idle" | "saving" | "success" | "error";

// ── Template editor (state-linked) ────────────────────────────────────────────

function TemplateEditor({ template, onSaved, paymentLinks, calendarLinks, schedulingLinks = [], artistName, studioAddress, artistId = "" }: { template: EmailTemplate; onSaved: () => void; paymentLinks: PaymentLink[]; calendarLinks: CalendarLink[]; schedulingLinks?: SchedulingLink[]; artistName: string; studioAddress: string; artistId?: string }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [autoSend, setAutoSend] = useState(template.auto_send);
  const [enabled, setEnabled] = useState(template.enabled !== false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const requiresEdit = templateRequiresEdit(template.state, body);

  type SendMode = "auto" | "manual" | "off";
  const sendMode: SendMode = !enabled ? "off" : autoSend && !requiresEdit ? "auto" : "manual";
  const setSendMode = (next: SendMode) => {
    if (next === "off") { setEnabled(false); }
    else if (next === "manual") { setEnabled(true); setAutoSend(false); }
    else { setEnabled(true); setAutoSend(true); }
  };

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body);
    setAutoSend(template.auto_send);
    setEnabled(template.enabled !== false);
    setMode("edit");
  }, [template]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const insertVar = (varName: string) => {
    const isSubject = lastFocused.current === "subject";
    const el = (isSubject ? subjectRef.current : bodyRef.current) as HTMLInputElement | HTMLTextAreaElement | null;
    const val = isSubject ? subject : body;
    if (!el) {
      if (isSubject) setSubject(v => v + varName);
      else setBody(v => v + varName);
      return;
    }
    const start = el.selectionStart ?? val.length;
    const end = el.selectionEnd ?? val.length;
    const newVal = val.slice(0, start) + varName + val.slice(end);
    if (isSubject) setSubject(newVal);
    else setBody(newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + varName.length, start + varName.length);
    });
  };

  const save = async () => {
    setStatus("saving");
    const res = await fetch("/api/artist/email-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: template.state, subject, body, auto_send: requiresEdit ? false : autoSend, enabled }),
    });
    if (res.ok) { setStatus("success"); onSaved(); setTimeout(() => setStatus("idle"), 3000); }
    else { setStatus("error"); setTimeout(() => setStatus("idle"), 4000); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-on-surface-variant tracking-wide">Subject</label>
        <Input
          ref={subjectRef}
          value={subject}
          onChange={e => setSubject(e.target.value)}
          onFocus={() => { lastFocused.current = "subject"; }}
          className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
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
              textareaRef={bodyRef}
              value={body}
              onChange={setBody}
              onFocus={() => { lastFocused.current = "body"; }}
            />
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              onFocus={() => { lastFocused.current = "body"; }}
              rows={1}
              className="w-full border-0 bg-transparent px-4 py-3 text-sm text-on-surface resize-none focus:outline-none overflow-hidden min-h-[200px]"
            />
          </div>
        ) : (
          <div
            className="px-4 py-3 bg-surface-container-high/40 border-b border-outline-variant rounded-t-lg rounded-b-none cursor-text"
            onClick={() => setMode("edit")}
            title="Click to edit"
          >
            <BodyPreview text={body} artistName={artistName} paymentLinks={paymentLinks} calendarLinks={calendarLinks} schedulingLinks={schedulingLinks} studioAddress={studioAddress} artistId={artistId} />
          </div>
        )}
      </div>
      <div className="space-y-2" data-coachmark="email-variables">
        <p className="text-xs text-on-surface-variant">Insert variable into focused field:</p>
        <EmailVarChips onInsert={insertVar} paymentLinks={paymentLinks} calendarLinks={calendarLinks} schedulingLinks={schedulingLinks} />
        <CoachmarkSequence tips={[{
          id: "emails-tab.variables",
          anchorSelector: '[data-coachmark="email-variables"]',
          title: "Personalize with variables",
          body: <>
            <p>Click a chip to drop a placeholder into the focused field.</p>
            <p>FlashBooker swaps it for the real value at send time.</p>
            <p>Lines with empty values get skipped, so clients never see <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">{"{appointmentDate}"}</code> as raw text.</p>
          </>,
        }]} />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium text-on-surface-variant tracking-wide">When this stage is reached</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { mode: "auto",   label: "Auto-send",   desc: "Goes out without asking",            disabled: requiresEdit },
            { mode: "manual", label: "Manual edit", desc: "Pop the editor so I can review",     disabled: false },
            { mode: "off",    label: "Off",         desc: "No email at all on this transition", disabled: false },
          ] as { mode: SendMode; label: string; desc: string; disabled: boolean }[]).map(opt => {
            const isActive = sendMode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                disabled={opt.disabled}
                onClick={() => setSendMode(opt.mode)}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  isActive
                    ? "border-primary bg-primary/8"
                    : "border-outline-variant/30 hover:border-outline-variant/60 hover:bg-surface-container-low"
                } ${opt.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <p className={`text-sm font-medium ${isActive ? "text-primary" : "text-on-surface"}`}>{opt.label}</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            );
          })}
        </div>
        {requiresEdit && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Replace the highlighted instructions before this can auto-send.
          </p>
        )}
        <div className="flex items-center justify-end gap-3 pt-1">
          {status === "success" && <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600"><Check className="w-3.5 h-3.5" /> Saved</span>}
          {status === "error" && <span className="text-xs font-medium text-destructive">Failed to save</span>}
          <Button type="button" onClick={save} disabled={status === "saving"}
            className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity">
            {status === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Custom template editor ────────────────────────────────────────────────────

function CustomTemplateEditor({ template, onSaved, onDelete, paymentLinks, calendarLinks, schedulingLinks = [] }: { template: EmailTemplate; onSaved: () => void; onDelete: () => void; paymentLinks: PaymentLink[]; calendarLinks: CalendarLink[]; schedulingLinks?: SchedulingLink[] }) {
  const [name, setName] = useState(template.name ?? "");
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  const insertVar = (varName: string) => {
    const isSubject = lastFocused.current === "subject";
    const el = (isSubject ? subjectRef.current : bodyRef.current) as HTMLInputElement | HTMLTextAreaElement | null;
    const val = isSubject ? subject : body;
    if (!el) {
      if (isSubject) setSubject(v => v + varName);
      else setBody(v => v + varName);
      return;
    }
    const start = el.selectionStart ?? val.length;
    const end = el.selectionEnd ?? val.length;
    const newVal = val.slice(0, start) + varName + val.slice(end);
    if (isSubject) setSubject(newVal);
    else setBody(newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + varName.length, start + varName.length);
    });
  };

  const save = async () => {
    if (!template.id) return;
    setStatus("saving");
    await fetch("/api/artist/email-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: template.id }) });
    const res = await fetch("/api/artist/email-templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, body }),
    });
    if (res.ok) { setStatus("success"); onSaved(); setTimeout(() => setStatus("idle"), 3000); }
    else { setStatus("error"); setTimeout(() => setStatus("idle"), 4000); }
  };

  const del = async () => {
    if (!template.id || !confirm(`Delete template "${name}"?`)) return;
    await fetch("/api/artist/email-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: template.id }) });
    onDelete();
  };

  return (
    <div className="space-y-3">
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Template name"
        className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-4 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none" />
      <Input
        ref={subjectRef}
        value={subject}
        onChange={e => setSubject(e.target.value)}
        onFocus={() => { lastFocused.current = "subject"; }}
        placeholder="Subject"
        className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-4 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none"
      />
      <div className="bg-surface-container-high/40 rounded-t-lg border-b border-outline-variant focus-within:border-primary transition-colors">
        <FormatToolbar
          textareaRef={bodyRef}
          value={body}
          onChange={setBody}
          onFocus={() => { lastFocused.current = "body"; }}
        />
        <textarea
          ref={bodyRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onFocus={() => { lastFocused.current = "body"; }}
          rows={5}
          placeholder="Message body"
          className="w-full border-0 bg-transparent px-4 py-3 text-sm text-on-surface resize-none focus:outline-none"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-on-surface-variant">Insert variable into focused field:</p>
        <EmailVarChips onInsert={insertVar} paymentLinks={paymentLinks} calendarLinks={calendarLinks} schedulingLinks={schedulingLinks} />
      </div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={del} className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
        <div className="flex items-center gap-3">
          {status === "success" && <span className="flex items-center gap-1.5 text-xs text-emerald-600"><Check className="w-3.5 h-3.5" /> Saved</span>}
          {status === "error" && <span className="text-xs text-destructive">Failed</span>}
          <Button type="button" onClick={save} disabled={status === "saving"}
            className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80">
            {status === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── New template form ─────────────────────────────────────────────────────────

function NewTemplateForm({ onCreated, paymentLinks, calendarLinks, schedulingLinks = [] }: { onCreated: () => void; paymentLinks: PaymentLink[]; calendarLinks: CalendarLink[]; schedulingLinks?: SchedulingLink[] }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  const insertVar = (varName: string) => {
    const isSubject = lastFocused.current === "subject";
    const el = (isSubject ? subjectRef.current : bodyRef.current) as HTMLInputElement | HTMLTextAreaElement | null;
    const val = isSubject ? subject : body;
    if (!el) {
      if (isSubject) setSubject(v => v + varName);
      else setBody(v => v + varName);
      return;
    }
    const start = el.selectionStart ?? val.length;
    const end = el.selectionEnd ?? val.length;
    const newVal = val.slice(0, start) + varName + val.slice(end);
    if (isSubject) setSubject(newVal);
    else setBody(newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + varName.length, start + varName.length);
    });
  };

  const create = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) { setError("All fields are required."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/artist/email-templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), subject, body }),
    });
    setSaving(false);
    if (res.ok) { setName(""); setSubject(""); setBody(""); onCreated(); }
    else setError("Failed to create template.");
  };

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-3">
      <p className="text-xs font-medium text-on-surface">New template</p>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name — e.g. Follow-up, Waitlist, Flash Sale"
        className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-4 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none" />
      <Input
        ref={subjectRef}
        value={subject}
        onChange={e => setSubject(e.target.value)}
        onFocus={() => { lastFocused.current = "subject"; }}
        placeholder="Subject"
        className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-4 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none"
      />
      <div className="bg-surface-container-high/40 rounded-t-lg border-b border-outline-variant focus-within:border-primary transition-colors">
        <FormatToolbar
          textareaRef={bodyRef}
          value={body}
          onChange={setBody}
          onFocus={() => { lastFocused.current = "body"; }}
        />
        <textarea
          ref={bodyRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onFocus={() => { lastFocused.current = "body"; }}
          rows={4}
          placeholder="Message body"
          className="w-full border-0 bg-transparent px-4 py-3 text-sm text-on-surface resize-none focus:outline-none"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-on-surface-variant">Insert variable into focused field:</p>
        <EmailVarChips onInsert={insertVar} paymentLinks={paymentLinks} calendarLinks={calendarLinks} schedulingLinks={schedulingLinks} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="button" onClick={create} disabled={saving}
        className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80">
        {saving ? "Creating…" : "Create Template"}
      </Button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function EmailTemplatesSettings({ paymentLinks, calendarLinks, schedulingLinks = [], artistName, studioAddress, artistId = "" }: { paymentLinks: PaymentLink[]; calendarLinks: CalendarLink[]; schedulingLinks?: SchedulingLink[]; artistName: string; studioAddress: string; artistId?: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [customTemplates, setCustomTemplates] = useState<EmailTemplate[]>([]);
  const [openState, setOpenState] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch("/api/artist/email-templates");
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates);
      setCustomTemplates(data.customTemplates ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-sm text-on-surface-variant">Loading templates…</p>;

  const tips: Tip[] = [
    {
      id: "emails-tab.stage-card",
      anchorSelector: '[data-coachmark="email-stage-card"]',
      title: "Each stage has its own email",
      body: (
        <>
          <p>Click a stage to customize what goes out.</p>
          <p>Use placeholders like <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">{"{clientFirstName}"}</code> and <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">{"{appointmentDate}"}</code> so each email is personalized.</p>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <CoachmarkSequence tips={tips} />

      {/* State-linked templates */}
      <div className="space-y-2 pt-4">
        <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-3">Stage templates</p>
        {templates.map((t, idx) => {
          const state = t.state as Exclude<BookingState, "cancelled">;
          const isOpen = openState === state;
          const needsEdit = templateRequiresEdit(t.state, t.body);
          const isOff = t.enabled === false;
          const badgeClass = isOff
            ? "bg-surface-container text-on-surface-variant/70 border border-outline-variant/40"
            : needsEdit
              ? "bg-amber-100 text-amber-700 border border-amber-200/60"
              : t.auto_send
                ? "bg-emerald-100 text-emerald-700"
                : "bg-surface-container text-on-surface-variant border border-outline-variant/30";
          const badgeLabel = isOff ? "Off" : needsEdit ? "Manual — needs edit" : t.auto_send ? "Auto-send on" : "Manual";
          return (
            <div key={state} className={`rounded-xl border border-outline-variant/20 overflow-hidden transition-opacity ${isOff ? "opacity-60" : ""}`} {...(idx === 0 ? { "data-coachmark": "email-stage-card" } : {})}>
              <button type="button"
                className="w-full flex items-center justify-between px-5 py-4 bg-surface-container-low hover:bg-surface-container transition-colors text-left"
                onClick={() => setOpenState(isOpen ? null : state)}>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${isOff ? "text-on-surface-variant line-through decoration-on-surface-variant/40" : "text-on-surface"}`}>{STATE_LABELS[state]}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-4 bg-surface-container-lowest border-t border-outline-variant/10">
                  <TemplateEditor template={t} onSaved={load} paymentLinks={paymentLinks} calendarLinks={calendarLinks} schedulingLinks={schedulingLinks} artistName={artistName} studioAddress={studioAddress} artistId={artistId} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom templates */}
      {customTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-3">Custom templates</p>
          {customTemplates.map(t => {
            const key = t.id ?? t.name ?? "";
            const isOpen = openState === key;
            return (
              <div key={key} className="rounded-xl border border-outline-variant/20 overflow-hidden">
                <button type="button"
                  className="w-full flex items-center justify-between px-5 py-4 bg-surface-container-low hover:bg-surface-container transition-colors text-left"
                  onClick={() => setOpenState(isOpen ? null : key)}>
                  <span className="text-sm font-medium text-on-surface">{t.name ?? "Custom"}</span>
                  <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-4 bg-surface-container-lowest border-t border-outline-variant/10">
                    <CustomTemplateEditor template={t} onSaved={load} onDelete={() => { setOpenState(null); load(); }} paymentLinks={paymentLinks} calendarLinks={calendarLinks} schedulingLinks={schedulingLinks} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New template */}
      {showNewForm ? (
        <NewTemplateForm onCreated={() => { setShowNewForm(false); load(); }} paymentLinks={paymentLinks} calendarLinks={calendarLinks} schedulingLinks={schedulingLinks} />
      ) : (
        <button type="button" onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
          <Plus className="w-4 h-4" />
          New template
        </button>
      )}
    </div>
  );
}
