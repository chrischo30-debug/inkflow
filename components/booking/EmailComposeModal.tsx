"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Eye, Pencil, Link2 } from "lucide-react";
import { EmailVarChips } from "@/components/shared/EmailVarChips";
import { FormatToolbar } from "@/components/shared/FormatToolbar";
import { useLocalDraft } from "@/lib/use-local-draft";
import type { PaymentLink, CalendarLink } from "@/lib/pipeline-settings";

export interface ResolvedTemplate {
  id?: string | null;
  name: string;
  state?: string | null;
  subject: string;
  body: string;
  auto_send?: boolean;
  enabled?: boolean;
}

export interface InsertLink {
  label: string;
  url: string;
}

export interface SchedulingLinkOption {
  id: string;
  label: string;
}

interface Props {
  templates: ResolvedTemplate[];
  initialSubject: string;
  initialBody: string;
  defaultTemplateState?: string | null;
  paymentLinks?: PaymentLink[];
  calendarLinks?: CalendarLink[];
  schedulingLinks?: SchedulingLinkOption[];
  previewVars?: Record<string, string>;
  // Optional: persist subject/body to localStorage under this key while the
  // modal is open. Pass `email-draft-${bookingId}` from the caller. Cleared on
  // Send and Skip, kept on Cancel/Close so the user doesn't lose work.
  draftKey?: string;
  onSend: (subject: string, body: string) => Promise<void>;
  onSkip?: () => void;
  onClose: () => void;
}

// Inline token types for BodyPreview parsing
// Combined regex groups: 1=bold 2=italic 3=varName 4=varLabel 5=mdLabel 6=mdUrl
const INLINE_RE = new RegExp(
  [
    /\*\*(.+?)\*\*/,           // bold (group 1)
    /\*(.+?)\*/,               // italic (group 2)
    /\{(clientFirstName|clientName|artistName|paymentLink|calendarLink|appointmentDate|studioAddress|studioMapsUrl|schedulingLink)(?::([^}]+))?\}/, // var (groups 3,4)
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/, // md link (groups 5,6)
    /(?:✏️ ?)?REPLACE THIS[^\n]*/, // todo (no groups)
  ].map(r => r.source).join('|'),
  'g',
);

type InlineToken =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'var'; name: string; label?: string }
  | { t: 'link'; label: string; url: string }
  | { t: 'todo'; v: string };

function tokenizeInline(text: string): InlineToken[] {
  const re = new RegExp(INLINE_RE.source, 'g');
  const tokens: InlineToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[0].startsWith('**'))       tokens.push({ t: 'bold', v: m[1] });
    else if (m[0].startsWith('*'))   tokens.push({ t: 'italic', v: m[2] });
    else if (m[0].startsWith('{'))   tokens.push({ t: 'var', name: m[3], label: m[4] });
    else if (m[0].startsWith('['))   tokens.push({ t: 'link', label: m[5], url: m[6] });
    else                             tokens.push({ t: 'todo', v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ t: 'text', v: text.slice(last) });
  return tokens;
}

export function BodyPreview({ text, vars, resolved, compact, paymentLinks = [], calendarLinks = [] }: {
  text: string;
  vars?: Record<string, string>;
  resolved?: boolean;
  compact?: boolean;
  paymentLinks?: InsertLink[];
  calendarLinks?: InsertLink[];
}) {
  // Build per-line segments: each line is either a bullet-group start or a single line.
  // Empty lines become explicit <br> so spacing above/below bullets is preserved.
  const lines = text.split('\n');
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

  function renderTokens(tokens: InlineToken[], prefix: string): React.ReactNode[] {
    return tokens.map((tk, ki) => {
      const key = `${prefix}-${ki}`;
      if (tk.t === 'text')   return <span key={key}>{tk.v}</span>;
      if (tk.t === 'bold')   return <strong key={key} className="font-semibold">{tk.v}</strong>;
      if (tk.t === 'italic') return <em key={key}>{tk.v}</em>;
      if (tk.t === 'todo')   return <mark key={key} className="bg-amber-500/15 text-amber-700 dark:text-amber-400 not-italic rounded px-1 py-0.5 text-xs font-medium">{tk.v}</mark>;
      if (tk.t === 'link') {
        if (resolved) return <a key={key} href={tk.url} target="_blank" rel="noreferrer" className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">{tk.label}</a>;
        return (
          <span key={key} className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary px-1 py-0.5 text-xs font-medium border border-primary/20">
            <Link2 className="w-3 h-3" />{tk.label}
          </span>
        );
      }
      // var token
      const name = (tk as Extract<InlineToken, { t: 'var' }>).name;
      const varLabel = (tk as Extract<InlineToken, { t: 'var' }>).label;
      if (resolved && vars) {
        if (name === 'paymentLink' || name === 'calendarLink') {
          const links = name === 'paymentLink' ? paymentLinks : calendarLinks;
          const url = varLabel
            ? (links.find(l => l.label.toLowerCase() === varLabel.toLowerCase())?.url ?? vars[name])
            : vars[name];
          const displayLabel = varLabel || links.find(l => l.url === url)?.label
            || (name === 'paymentLink' ? 'Payment link' : 'Scheduling link');
          return url
            ? <a key={key} href={url} target="_blank" rel="noreferrer" className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">{displayLabel}</a>
            : <mark key={key} className="bg-amber-500/15 text-amber-700 not-italic rounded px-1 py-0.5 text-xs font-medium">{name === 'paymentLink' ? 'payment link needed' : 'scheduling link needed'}</mark>;
        }
        if (name === 'schedulingLink') {
          const url = vars.schedulingLink;
          const label = vars.schedulingLinkLabel || 'Scheduling link';
          return url
            ? <a key={key} href={url} target="_blank" rel="noreferrer" className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">{label}</a>
            : <mark key={key} className="bg-amber-500/15 text-amber-700 not-italic rounded px-1 py-0.5 text-xs font-medium">scheduling link needed</mark>;
        }
        const val = vars[name];
        return val
          ? <span key={key} className="font-medium text-on-surface">{val}</span>
          : <mark key={key} className="bg-destructive/10 text-destructive rounded px-0.5 text-xs italic">not set</mark>;
      }
      return <mark key={key} className="bg-primary/15 text-primary not-italic rounded px-0.5 font-mono text-xs">{`{${name}${varLabel ? ':' + varLabel : ''}}`}</mark>;
    });
  }

  return (
    <div className={`text-sm text-on-surface leading-relaxed ${compact ? '' : 'min-h-[140px]'}`}>
      {segments.map((seg, si) => {
        if (seg.type === 'bullets') {
          return (
            <ul key={si} className="list-disc list-inside my-0 space-y-0.5">
              {seg.items.map((item, li) => (
                <li key={li}>{renderTokens(tokenizeInline(item), `${si}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (seg.content === '') return <br key={si} />;
        return <div key={si}>{renderTokens(tokenizeInline(seg.content), `${si}`)}</div>;
      })}
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
  schedulingLinks = [],
  previewVars,
  draftKey,
  onSend,
  onSkip,
  onClose,
}: Props) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  const draft = useLocalDraft({
    key: draftKey,
    value: { subject, body },
    onRestore: saved => {
      if (saved && typeof saved === "object") {
        if (typeof saved.subject === "string") setSubject(saved.subject);
        if (typeof saved.body === "string") setBody(saved.body);
      }
    },
  });
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const paymentLinks = initialPaymentLinks;
  const calendarLinks = initialCalendarLinks;
  const subjectRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  const selectedName = templates.find(t => t.subject === subject && t.body === body)?.name ?? "Custom";

  // Auto-resize textarea to content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const pick = (t: ResolvedTemplate) => {
    setSubject(t.subject);
    setBody(t.body);
    setTemplatePickerOpen(false);
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

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(subject, body);
      draft.clear();
    } finally {
      setSending(false);
    }
  };

  const handleSkip = onSkip ? () => { draft.clear(); onSkip(); } : undefined;

  const hasUnreplacedTodo = /REPLACE THIS/.test(body) || /REPLACE THIS/.test(subject);

  const fieldClass = "w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors";
  const previewClass = "px-4 py-3 bg-surface-container-high/40 border-b border-outline-variant rounded-t-lg rounded-b-none cursor-text";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div
        className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10 shrink-0">
          <h2 className="text-base font-medium text-on-surface">Send Email</h2>
          <button type="button" onClick={onClose} className="p-2 -mr-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Template picker */}
          {templates.length > 1 && (
            <div className="px-5 pt-4 relative">
              <label className="text-xs font-medium text-on-surface-variant tracking-wide mb-1.5 block">Template</label>
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
            <label className="text-xs font-medium text-on-surface-variant tracking-wide mb-1.5 block">Subject</label>
            {mode === "edit" ? (
              <input
                ref={subjectRef}
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                onFocus={() => { lastFocused.current = "subject"; }}
                className={fieldClass}
              />
            ) : (
              <div
                className={previewClass}
                onClick={() => setMode("edit")}
                title="Click to edit"
              >
                <BodyPreview text={subject} vars={previewVars} resolved compact paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
              </div>
            )}
          </div>

          {/* Body — edit / preview toggle */}
          <div className="px-5 pt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-on-surface-variant tracking-wide">Message</label>
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
              <div className="bg-surface-container-high/40 rounded-t-lg border-b border-outline-variant focus-within:border-primary transition-colors">
                <FormatToolbar
                  textareaRef={textareaRef}
                  value={body}
                  onChange={setBody}
                  onFocus={() => { lastFocused.current = "body"; }}
                />
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onFocus={() => { lastFocused.current = "body"; }}
                  rows={1}
                  className="w-full border-0 bg-transparent px-4 py-3 text-sm text-on-surface resize-none focus:outline-none overflow-hidden min-h-[160px]"
                />
              </div>
            ) : (
              <div
                className={previewClass}
                onClick={() => setMode("edit")}
                title="Click to edit"
              >
                <BodyPreview text={body} vars={previewVars} resolved paymentLinks={paymentLinks} calendarLinks={calendarLinks} />
              </div>
            )}
          </div>

          {/* Variable chips */}
          <div className="px-5 pt-3 pb-4 space-y-2">
            <p className="text-xs text-on-surface-variant">Insert variable into focused field:</p>
            <EmailVarChips
              onInsert={insertAtCursor}
              paymentLinks={paymentLinks}
              calendarLinks={calendarLinks}
              schedulingLinks={schedulingLinks}
            />
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
            {hasUnreplacedTodo && (
              <span className="text-xs text-amber-700 dark:text-amber-400">Fill in the highlighted instructions first</span>
            )}
            {handleSkip && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-on-surface-variant hover:text-on-surface-variant transition-colors underline underline-offset-2"
              >
                skip email
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || hasUnreplacedTodo}
              title={hasUnreplacedTodo ? "Replace the highlighted instructions before sending" : undefined}
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
