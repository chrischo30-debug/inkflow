"use client";

import { useState } from "react";
import { X, ChevronDown } from "lucide-react";

export interface ResolvedTemplate {
  id?: string | null;
  name: string;
  state?: string | null;
  subject: string;
  body: string;
}

interface Props {
  templates: ResolvedTemplate[];
  initialSubject: string;
  initialBody: string;
  defaultTemplateState?: string | null;
  onSend: (subject: string, body: string) => Promise<void>;
  onClose: () => void;
}

export function EmailComposeModal({ templates, initialSubject, initialBody, defaultTemplateState, onSend, onClose }: Props) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedName = templates.find(t => t.subject === subject && t.body === body)?.name ?? "Custom";

  const pick = (t: ResolvedTemplate) => {
    setSubject(t.subject);
    setBody(t.body);
    setPickerOpen(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(subject, body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface border border-outline-variant/20 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg mx-0 sm:mx-4 flex flex-col gap-0 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
          <h2 className="text-sm font-semibold text-on-surface">Send Email</h2>
          <button type="button" onClick={onClose} className="p-2 -mr-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template picker */}
        {templates.length > 1 && (
          <div className="px-5 pt-4 pb-0 relative">
            <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Template</label>
            <button
              type="button"
              onClick={() => setPickerOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg hover:border-outline-variant/60 transition-colors"
            >
              <span className="truncate">{selectedName}</span>
              <ChevronDown className={`w-4 h-4 text-on-surface-variant shrink-0 ml-2 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
            </button>
            {pickerOpen && (
              <div className="absolute left-5 right-5 top-full mt-1 z-10 bg-surface border border-outline-variant/30 rounded-xl shadow-lg py-1 max-h-56 overflow-y-auto">
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

        {/* Subject + body */}
        <div className="px-5 pt-4 pb-0 flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5 block">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={7}
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none font-mono"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
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
  );
}
