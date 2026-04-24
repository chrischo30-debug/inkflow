"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Link2, Plus, Eye, Pencil, Braces } from "lucide-react";

export interface ResolvedTemplate {
  id?: string | null;
  name: string;
  state?: string | null;
  subject: string;
  body: string;
}

export interface InsertLink {
  label: string;
  url: string;
}

interface Props {
  templates: ResolvedTemplate[];
  initialSubject: string;
  initialBody: string;
  defaultTemplateState?: string | null;
  paymentLinks?: InsertLink[];
  calendarLinks?: InsertLink[];
  previewVars?: Record<string, string>;
  onSend: (subject: string, body: string) => Promise<void>;
  onSkip?: () => void;
  onClose: () => void;
}

const VAR_RE = /\{(clientFirstName|clientName|artistName|paymentLink|calendarLink|calendarLinks|appointmentDate)\}/g;
const TODO_RE = /✏️ REPLACE THIS:[^\n]*/g;

function BodyPreview({ text, vars, resolved, compact }: { text: string; vars?: Record<string, string>; resolved?: boolean; compact?: boolean }) {
  type Part = { text: string; varName?: string; isTodo?: boolean };
  const parts: Part[] = [];
  // Combined regex to find both {vars} and ✏️ REPLACE THIS: lines in order
  const combined = new RegExp(`${VAR_RE.source}|${TODO_RE.source}`, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    if (m[0].startsWith('✏️')) {
      parts.push({ text: m[0], isTodo: true });
    } else {
      parts.push({ text: m[0], varName: m[1] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return (
    <div className={`whitespace-pre-wrap text-sm text-on-surface leading-relaxed ${compact ? "" : "min-h-[140px]"}`}>
      {parts.map((p, i) => {
        if (p.isTodo) {
          return <mark key={i} className="bg-amber-500/15 text-amber-700 dark:text-amber-400 not-italic rounded px-1 py-0.5 text-xs font-medium">{p.text}</mark>;
        }
        if (!p.varName) return <span key={i}>{p.text}</span>;
        if (resolved && vars) {
          const val = vars[p.varName];
          return val
            ? <span key={i} className="font-medium text-on-surface">{val}</span>
            : <mark key={i} className="bg-destructive/10 text-destructive rounded px-0.5 text-xs italic">not set</mark>;
        }
        return <mark key={i} className="bg-primary/15 text-primary not-italic rounded px-0.5 font-mono text-xs">{p.text}</mark>;
      })}
    </div>
  );
}

function InlineLinkAdder({
  type,
  existing,
  onAdd,
}: {
  type: "payment" | "calendar";
  existing: InsertLink[];
  onAdd: (link: InsertLink) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!label.trim() || !url.trim()) return;
    setSaving(true);
    const newLink = { label: label.trim(), url: url.trim() };
    try {
      if (type === "payment") {
        await fetch("/api/artist/payment-links", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ links: [...existing, newLink] }),
        });
      } else {
        await fetch("/api/artist/pipeline-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendar_links: [...existing, newLink] }),
        });
      }
      onAdd(newLink);
      setLabel("");
      setUrl("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
      >
        <Plus className="w-3 h-3" />
        {type === "payment" ? "Add payment link" : "Add calendar link"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input
        autoFocus
        type="text"
        placeholder="Label"
        value={label}
        onChange={e => setLabel(e.target.value)}
        className="w-24 px-2 py-1 text-xs text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-md focus:outline-none focus:border-primary"
      />
      <input
        type="text"
        placeholder="URL"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setOpen(false); }}
        className="w-40 px-2 py-1 text-xs text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-md focus:outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={saving || !label.trim() || !url.trim()}
        className="px-2 py-1 text-xs font-medium rounded-md bg-on-surface text-surface hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {saving ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-2 py-1 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

export function EmailComposeModal({
  templates,
  initialSubject,
  initialBody,
  defaultTemplateState,
  paymentLinks: initialPaymentLinks = [],
  calendarLinks: initialCalendarLinks = [],
  previewVars,
  onSend,
  onSkip,
  onClose,
}: Props) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [paymentLinks, setPaymentLinks] = useState<InsertLink[]>(initialPaymentLinks);
  const [calendarLinks, setCalendarLinks] = useState<InsertLink[]>(initialCalendarLinks);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedName = templates.find(t => t.subject === subject && t.body === body)?.name ?? "Custom";

  const pick = (t: ResolvedTemplate) => {
    setSubject(t.subject);
    setBody(t.body);
    setTemplatePickerOpen(false);
  };

  const insertAtCursor = (text: string) => {
    if (mode === "preview") setMode("edit");
    const el = textareaRef.current;
    if (!el) {
      setBody(prev => prev + (prev.endsWith("\n") || prev === "" ? "" : "\n") + text);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const before = body.slice(0, start);
    const needsNewline = before.length > 0 && !before.endsWith("\n");
    const insert = (needsNewline ? "\n" : "") + text;
    const newBody = before + insert + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      el.selectionStart = start + insert.length;
      el.selectionEnd = start + insert.length;
      el.focus();
    });
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(subject, body);
    } finally {
      setSending(false);
    }
  };

  const hasLinks = paymentLinks.length > 0 || calendarLinks.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface border border-outline-variant/20 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl mx-0 sm:mx-4 flex flex-col overflow-hidden max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10 shrink-0">
          <h2 className="text-sm font-semibold text-on-surface">Send Email</h2>
          <button type="button" onClick={onClose} className="p-2 -mr-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Template picker */}
          {templates.length > 1 && (
            <div className="px-5 pt-4 relative">
              <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Template</label>
              <button
                type="button"
                onClick={() => setTemplatePickerOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg hover:border-outline-variant/60 transition-colors"
              >
                <span className="truncate">{selectedName}</span>
                <span className={`text-on-surface-variant shrink-0 ml-2 transition-transform text-xs ${templatePickerOpen ? "rotate-180" : ""}`}>▾</span>
              </button>
              {templatePickerOpen && (
                <div className="absolute left-5 right-5 top-full mt-1 z-10 bg-surface border border-outline-variant/30 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
                  {templates.map((t, i) => (
                    <button
                      key={t.id ?? i}
                      type="button"
                      onClick={() => pick(t)}
                      className="w-full text-left px-3 py-2.5 hover:bg-surface-container-high transition-colors"
                    >
                      <p className="text-xs font-medium text-on-surface">{t.name}</p>
                      {t.state && <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">{t.subject}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          <div className="px-5 pt-4">
            <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Subject</label>
            {mode === "edit" ? (
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
              />
            ) : (
              <div
                className="px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-lg cursor-text"
                onClick={() => setMode("edit")}
                title="Click to edit"
              >
                <BodyPreview text={subject} vars={previewVars} resolved compact />
              </div>
            )}
          </div>

          {/* Body — edit / preview toggle */}
          <div className="px-5 pt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Message</label>
              <div className="flex items-center gap-0.5 bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${mode === "edit" ? "bg-surface text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setMode("preview")}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${mode === "preview" ? "bg-surface text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  <Eye className="w-3 h-3" /> Preview
                </button>
              </div>
            </div>
            {mode === "edit" ? (
              <textarea
                ref={textareaRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none font-mono"
              />
            ) : (
              <div
                className="px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-lg cursor-text"
                onClick={() => setMode("edit")}
                title="Click to edit"
              >
                <BodyPreview text={body} vars={previewVars} resolved />
              </div>
            )}
          </div>

          {/* Variable chips */}
          <div className="px-5 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-on-surface-variant/70 shrink-0">
                <Braces className="w-3 h-3" />
                Variables:
              </span>
              {([
                ["clientFirstName", "First Name"],
                ["clientName", "Full Name"],
                ["artistName", "Artist Name"],
                ["appointmentDate", "Appointment"],
                ["paymentLink", "Payment Link"],
                ["calendarLink", "Calendar Link"],
              ] as [string, string][]).map(([varName, label]) => (
                <button
                  key={varName}
                  type="button"
                  onClick={() => insertAtCursor(`{${varName}}`)}
                  className="px-2 py-0.5 text-xs font-mono rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                  title={`Insert {${varName}}`}
                >
                  {"{" + label + "}"}
                </button>
              ))}
            </div>
          </div>

          {/* Insert links toolbar */}
          <div className="px-5 pt-3 pb-4 space-y-2">
            {(hasLinks || true) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-on-surface-variant/70 shrink-0">
                  <Link2 className="w-3 h-3" />
                  Insert:
                </span>
                {paymentLinks.map(link => (
                  <button
                    key={link.url}
                    type="button"
                    onClick={() => insertAtCursor(link.url)}
                    title={link.url}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
                {calendarLinks.map(link => (
                  <button
                    key={link.url}
                    type="button"
                    onClick={() => insertAtCursor(link.url)}
                    title={link.url}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <InlineLinkAdder
                type="payment"
                existing={paymentLinks}
                onAdd={link => {
                  setPaymentLinks(prev => [...prev, link]);
                  insertAtCursor(link.url);
                }}
              />
              <InlineLinkAdder
                type="calendar"
                existing={calendarLinks}
                onAdd={link => {
                  setCalendarLinks(prev => [...prev, link]);
                  insertAtCursor(link.url);
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors underline underline-offset-2"
              >
                skip email
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="px-5 py-2.5 text-sm font-medium rounded-xl bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
