"use client";

import { useState, useEffect, useRef } from "react";
import { BookingState, EmailTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, Plus, Trash2, Link2, Calendar } from "lucide-react";
import type { PaymentLink, CalendarLink } from "@/lib/pipeline-settings";

const STATE_LABELS: Record<Exclude<BookingState, "cancelled">, string> = {
  inquiry:   "Submission Received",
  follow_up: "Follow Ups",
  accepted:  "Accepted – Deposit Requested",
  confirmed: "Appointment Booked",
  completed: "Appointment Completed",
  rejected:  "Submission Rejected",
};

// Static (non-link) variables — link variables are rendered as dropdowns
const SIMPLE_VARIABLES = [
  { name: "{clientFirstName}", description: "Client's first name",         example: "Jane" },
  { name: "{artistName}",      description: "Your artist/studio name",     example: "Ink by Alex" },
  { name: "{appointmentDate}", description: "Confirmed appointment date",  example: "May 3, 2026" },
];

type SaveStatus = "idle" | "saving" | "success" | "error";

// ── Variable chips ────────────────────────────────────────────────────────────

function LinkDropdown({
  icon: Icon,
  label,
  variableBase,
  links,
  onInsert,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variableBase: "paymentLink" | "calendarLink";
  links: { label: string; url: string }[];
  onInsert: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (variable: string) => {
    onInsert(variable);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-2.5 py-1.5 rounded-md font-mono bg-primary/8 text-primary hover:bg-primary/15 transition-colors inline-flex items-center gap-1.5"
      >
        <Icon className="w-3 h-3" /> {label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[260px] max-w-[320px] rounded-lg border border-outline-variant/30 bg-surface shadow-lg py-1.5">
          {links.length === 0 && (
            <p className="px-3 py-2 text-xs text-on-surface-variant/70">
              No links saved yet.{" "}
              <a href="/payment-links" className="text-primary hover:underline">Add some →</a>
            </p>
          )}
          {links.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => pick(`{${variableBase}}`)}
                className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors flex items-start gap-2"
              >
                <span className="font-mono text-xs text-primary shrink-0">{`{${variableBase}}`}</span>
                <span className="text-xs text-on-surface-variant">first one</span>
              </button>
              <div className="border-t border-outline-variant/15 my-1" />
              {links.map((link) => (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => pick(`{${variableBase}:${link.label}}`)}
                  className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors"
                >
                  <p className="font-mono text-xs text-primary truncate">{`{${variableBase}:${link.label}}`}</p>
                  <p className="text-[10px] text-on-surface-variant/70 truncate mt-0.5">{link.url}</p>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function VarChips({
  onInsert,
  paymentLinks,
  calendarLinks,
}: {
  onInsert: (v: string) => void;
  paymentLinks: PaymentLink[];
  calendarLinks: CalendarLink[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {SIMPLE_VARIABLES.map((v) => (
        <button
          key={v.name}
          type="button"
          onClick={() => onInsert(v.name)}
          title={v.description}
          className="text-xs px-2 py-1 rounded-md font-mono bg-primary/8 text-primary hover:bg-primary/15 transition-colors"
        >
          {v.name}
        </button>
      ))}
      <LinkDropdown
        icon={Link2}
        label="Payment link"
        variableBase="paymentLink"
        links={paymentLinks}
        onInsert={onInsert}
      />
      <LinkDropdown
        icon={Calendar}
        label="Scheduling link"
        variableBase="calendarLink"
        links={calendarLinks}
        onInsert={onInsert}
      />
    </div>
  );
}

// ── Template editor (state-linked) ────────────────────────────────────────────

function TemplateEditor({ template, onSaved, paymentLinks, calendarLinks }: { template: EmailTemplate; onSaved: () => void; paymentLinks: PaymentLink[]; calendarLinks: CalendarLink[] }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [autoSend, setAutoSend] = useState(template.auto_send);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body);
    setAutoSend(template.auto_send);
  }, [template]);

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
      body: JSON.stringify({ state: template.state, subject, body, auto_send: autoSend }),
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
        <label className="text-xs font-medium text-on-surface-variant tracking-wide">Message</label>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onFocus={() => { lastFocused.current = "body"; }}
          rows={6}
          className="w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-3 text-sm text-on-surface resize-none focus:outline-none focus:border-primary transition-colors"
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-on-surface-variant">Insert variable into focused field:</p>
        <VarChips onInsert={insertVar} paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button type="button" role="switch" aria-checked={autoSend} onClick={() => setAutoSend(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoSend ? "bg-primary" : "bg-outline-variant"}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoSend ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <span className="text-sm text-on-surface">Auto-send on state change</span>
        </label>
        <div className="flex items-center gap-3">
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

function CustomTemplateEditor({ template, onSaved, onDelete, paymentLinks, calendarLinks }: { template: EmailTemplate; onSaved: () => void; onDelete: () => void; paymentLinks: PaymentLink[]; calendarLinks: CalendarLink[] }) {
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
      <textarea
        ref={bodyRef}
        value={body}
        onChange={e => setBody(e.target.value)}
        onFocus={() => { lastFocused.current = "body"; }}
        rows={5}
        placeholder="Message body"
        className="w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-3 text-sm text-on-surface resize-none focus:outline-none focus:border-primary transition-colors"
      />
      <div className="space-y-1.5">
        <p className="text-xs text-on-surface-variant">Insert variable into focused field:</p>
        <VarChips onInsert={insertVar} paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
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

function NewTemplateForm({ onCreated, paymentLinks, calendarLinks }: { onCreated: () => void; paymentLinks: PaymentLink[]; calendarLinks: CalendarLink[] }) {
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
      <textarea
        ref={bodyRef}
        value={body}
        onChange={e => setBody(e.target.value)}
        onFocus={() => { lastFocused.current = "body"; }}
        rows={4}
        placeholder="Message body"
        className="w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-3 text-sm text-on-surface resize-none focus:outline-none focus:border-primary transition-colors"
      />
      <div className="space-y-1.5">
        <p className="text-xs text-on-surface-variant">Insert variable into focused field:</p>
        <VarChips onInsert={insertVar} paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
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

export function EmailTemplatesSettings({ paymentLinks, calendarLinks }: { paymentLinks: PaymentLink[]; calendarLinks: CalendarLink[] }) {
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

  return (
    <div className="space-y-6">
      {/* State-linked templates */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-3">Stage templates</p>
        {templates.map(t => {
          const state = t.state as Exclude<BookingState, "cancelled">;
          const isOpen = openState === state;
          return (
            <div key={state} className="rounded-xl border border-outline-variant/20 overflow-hidden">
              <button type="button"
                className="w-full flex items-center justify-between px-5 py-4 bg-surface-container-low hover:bg-surface-container transition-colors text-left"
                onClick={() => setOpenState(isOpen ? null : state)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-on-surface">{STATE_LABELS[state]}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.auto_send ? "bg-emerald-100 text-emerald-700" : "bg-surface-container text-on-surface-variant border border-outline-variant/30"}`}>
                    {t.auto_send ? "Auto-send on" : "Manual"}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-4 bg-surface-container-lowest border-t border-outline-variant/10">
                  <TemplateEditor template={t} onSaved={load} paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
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
                    <CustomTemplateEditor template={t} onSaved={load} onDelete={() => { setOpenState(null); load(); }} paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New template */}
      {showNewForm ? (
        <NewTemplateForm onCreated={() => { setShowNewForm(false); load(); }} paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
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
