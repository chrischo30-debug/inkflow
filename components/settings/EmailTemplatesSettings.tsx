"use client";

import { useState, useEffect } from "react";
import { BookingState, EmailTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";

const STATE_LABELS: Record<Exclude<BookingState, "cancelled">, string> = {
  inquiry:   "Submission Received",
  follow_up: "Follow Ups",
  accepted:  "Accepted – Deposit Requested",
  confirmed: "Appointment Booked",
  completed: "Appointment Completed",
  rejected:  "Submission Rejected",
};

const VARIABLES = [
  { name: "{clientFirstName}", description: "Client's first name",                       example: "Jane" },
  { name: "{artistName}",      description: "Your artist/studio name",                   example: "Ink by Alex" },
  { name: "{paymentLink}",     description: "Your primary payment link URL",             example: "https://stripe.com/pay/..." },
  { name: "{calendarLink}",    description: "Your primary scheduling link URL",          example: "https://calendly.com/..." },
  { name: "{calendarLinks}",   description: "All scheduling links, one per line with labels", example: "30 min: https://...\n2 hr: https://..." },
  { name: "{appointmentDate}", description: "Confirmed appointment date",               example: "May 3, 2026" },
];

type SaveStatus = "idle" | "saving" | "success" | "error";

function VariableReference() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-outline-variant/20 overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low hover:bg-surface-container transition-colors text-left"
      >
        <span className="text-xs font-medium text-on-surface">Variable reference</span>
        <ChevronDown className={`w-3.5 h-3.5 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-outline-variant/10 bg-surface-container-lowest">
          <p className="text-xs text-on-surface-variant mb-3">Paste any variable into a subject or message body — it will be replaced with the real value when the email is sent.</p>
          <div className="space-y-2">
            {VARIABLES.map(v => (
              <div key={v.name} className="grid grid-cols-[130px_1fr] gap-3 text-xs">
                <code className="font-mono text-primary bg-primary/5 px-2 py-1 rounded self-start">{v.name}</code>
                <div>
                  <p className="text-on-surface">{v.description}</p>
                  <p className="text-on-surface-variant/70 mt-0.5">e.g. {v.example}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateEditor({ template, onSaved }: { template: EmailTemplate; onSaved: () => void }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [autoSend, setAutoSend] = useState(template.auto_send);
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body);
    setAutoSend(template.auto_send);
  }, [template]);

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
        <Input value={subject} onChange={e => setSubject(e.target.value)}
          className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-on-surface-variant tracking-wide">Message</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
          className="w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-3 text-sm text-on-surface resize-none focus:outline-none focus:border-primary transition-colors" />
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

function CustomTemplateEditor({ template, onSaved, onDelete }: { template: EmailTemplate; onSaved: () => void; onDelete: () => void }) {
  const [name, setName] = useState(template.name ?? "");
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const save = async () => {
    if (!template.id) return;
    setStatus("saving");
    // Update by deleting + recreating isn't ideal; use a dedicated PUT-by-id if added.
    // For now, delete and re-create to preserve simplicity.
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
      <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
        className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-4 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none" />
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="Message body"
        className="w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-3 text-sm text-on-surface resize-none focus:outline-none focus:border-primary transition-colors" />
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

function NewTemplateForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
        className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-4 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none" />
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Message body — use variables like {clientFirstName}, {artistName}"
        className="w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-3 text-sm text-on-surface resize-none focus:outline-none focus:border-primary transition-colors" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="button" onClick={create} disabled={saving}
        className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80">
        {saving ? "Creating…" : "Create Template"}
      </Button>
    </div>
  );
}

export function EmailTemplatesSettings() {
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
      <VariableReference />

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
                  <TemplateEditor template={t} onSaved={load} />
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
                    <CustomTemplateEditor template={t} onSaved={load} onDelete={() => { setOpenState(null); load(); }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New template */}
      {showNewForm ? (
        <NewTemplateForm onCreated={() => { setShowNewForm(false); load(); }} />
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
