"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, DollarSign, Eye, Pencil } from "lucide-react";
import type { SchedulingLink } from "@/lib/pipeline-settings";
import { BodyPreview, type InsertLink } from "./EmailComposeModal";
import { EmailVarChips } from "@/components/shared/EmailVarChips";
import { FormatToolbar } from "@/components/shared/FormatToolbar";

interface Props {
  bookingId: string;
  clientName: string;
  existingDepositUrl?: string;
  paymentsConnected: boolean;
  paymentProvider: "stripe" | "square" | null;
  schedulingLinks: SchedulingLink[];
  artistId: string;
  onSent: (schedulingLinkId?: string) => void;
  onClose: () => void;
}

interface Template { state: string | null; subject: string; body: string; }

export function SendDepositModal({ bookingId, clientName, existingDepositUrl, paymentsConnected, paymentProvider, schedulingLinks, artistId, onSent, onClose }: Props) {
  const providerLabel = paymentProvider === "square" ? "Square" : "Stripe";
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedState, setSelectedState] = useState<string>("accepted");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  // Provider-generated deposit link (Stripe or Square, whichever is connected)
  const [depositAmount, setDepositAmount] = useState("");
  const [depositUrl, setDepositUrl] = useState(existingDepositUrl ?? "");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkError, setLinkError] = useState("");

  // Automation scheduling link (only shown when a payment provider is connected)
  const [automationLinkId, setAutomationLinkId] = useState<string>("");

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
            : schedulingLinks.map(l => ({ id: l.id, label: l.label }))
        );
        const tpl = all.find(t => t.state === "accepted") ?? all.find(t => t.state === "sent_deposit") ?? all[0];
        if (tpl) { setSubject(tpl.subject); setBody(tpl.body); setSelectedState(tpl.state ?? ""); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId, schedulingLinks]);

  const selectTemplate = (state: string) => {
    setSelectedState(state);
    const t = templates.find(x => x.state === state);
    if (t) { setSubject(t.subject); setBody(t.body); }
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

  // When a deposit link is in play (just generated, or pre-existing on the
  // booking), surface it in the variable picker and resolve {paymentLink} in
  // the Preview tab. The backend also appends to artist.payment_links, but we
  // don't refetch — local merge keeps the modal snappy.
  const registerDepositLink = (url: string) => {
    const label = `Deposit — ${clientName}`;
    setPaymentLinks(prev => prev.some(l => l.url === url) ? prev : [...prev, { label, url }]);
    setPreviewVars(prev => ({ ...prev, paymentLink: url }));
  };

  useEffect(() => {
    if (existingDepositUrl) registerDepositLink(existingDepositUrl);
    // existingDepositUrl is stable for the modal's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDepositUrl]);

  const generateDepositLink = async () => {
    const cents = Math.round(parseFloat(depositAmount) * 100);
    if (!cents || cents < 100) { setLinkError("Enter a valid amount (min $1)"); return; }
    setGeneratingLink(true); setLinkError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/deposit-link`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: cents }),
      });
      const data = await res.json();
      if (!res.ok) { setLinkError(data.error ?? "Failed to generate link"); return; }
      setDepositUrl(data.url);
      registerDepositLink(data.url);
      navigator.clipboard.writeText(data.url).then(() => {
        setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
      });
    } catch { setLinkError("Network error"); }
    finally { setGeneratingLink(false); }
  };

  const copyLink = async () => {
    // Square deposit URLs are single-use — once paid, the URL serves a
    // confirmation page. For Square, regenerate before copy so the artist
    // never hands out a dead link. Stripe links are reusable, so plain copy.
    if (paymentProvider === "square" && depositUrl) {
      setGeneratingLink(true); setLinkError("");
      try {
        const res = await fetch(`/api/bookings/${bookingId}/deposit-link/regenerate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          setDepositUrl(data.url);
          registerDepositLink(data.url);
          await navigator.clipboard.writeText(data.url);
        } else {
          setLinkError(typeof data.error === "string" ? data.error : "Could not regenerate link");
          return;
        }
      } finally {
        setGeneratingLink(false);
      }
    } else {
      await navigator.clipboard.writeText(depositUrl);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const send = async () => {
    setSending(true); setError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) throw new Error("Failed to send");

      // Move to sent_deposit, save scheduling link if chosen
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          target_state: "sent_deposit",
          ...(automationLinkId ? { scheduling_link_id: automationLinkId } : {}),
        }),
      });

      onSent(automationLinkId || undefined);
    } catch { setError("Something went wrong. Try again."); }
    finally { setSending(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant/10 shrink-0">
          <h2 className="text-base font-semibold text-on-surface">Send Deposit</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Send {clientName} a deposit request.</p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Provider-generated deposit link */}
          {paymentsConnected && (
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-3">
              <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">{providerLabel} deposit link</p>

              {/* Existing link */}
              {existingDepositUrl && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-on-surface-variant">Previously generated link:</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-mono text-on-surface-variant/70 truncate flex-1">{existingDepositUrl}</p>
                    <button type="button" onClick={copyLink}
                      className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity whitespace-nowrap">
                      {linkCopied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] text-on-surface-variant/60">Or generate a new one below:</p>
                </div>
              )}

              {/* Generate new */}
              <div className="flex gap-2">
                <div className="flex items-center gap-1 flex-1 rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 focus-within:border-primary transition-colors">
                  <span className="text-sm text-on-surface-variant">$</span>
                  <input type="number" min="1" step="0.01" placeholder="0.00" value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && generateDepositLink()}
                    className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50" />
                </div>
                <button type="button" onClick={depositUrl && !existingDepositUrl ? copyLink : generateDepositLink}
                  disabled={generatingLink}
                  className="px-3 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 disabled:opacity-50 transition-opacity whitespace-nowrap">
                  {generatingLink ? "Creating…" : (depositUrl && !existingDepositUrl) ? (linkCopied ? "✓ Copied" : "Copy link") : "Generate & copy"}
                </button>
              </div>
              {depositUrl && !existingDepositUrl && (
                <p className="text-[11px] font-mono text-on-surface-variant/60 truncate">{depositUrl}</p>
              )}
              {linkError && <p className="text-xs text-destructive">{linkError}</p>}
            </div>
          )}

          {/* Automation: scheduling link picker (only when a payment provider is connected) */}
          {paymentsConnected && schedulingLinks.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">Automation <span className="text-on-surface-variant font-normal normal-case">(optional)</span></p>
              <p className="text-xs text-on-surface-variant">
                When this deposit is paid, automatically send the client a calendar scheduling link. Choose which link to use:
              </p>
              <select value={automationLinkId}
                onChange={e => setAutomationLinkId(e.target.value)}
                className="w-full px-3 py-2 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary">
                <option value="">Don't automate — I'll send manually</option>
                {schedulingLinks.map(l => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
              {automationLinkId && (
                <p className="text-[11px] text-primary/80">
                  Once payment is confirmed, the client will receive your "{schedulingLinks.find(l => l.id === automationLinkId)?.label}" link automatically.
                </p>
              )}
            </div>
          )}

          {/* Email compose */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">Email to client</p>
              {templates.length > 1 && (
                <select value={selectedState} onChange={e => selectTemplate(e.target.value)}
                  className="text-xs text-on-surface-variant bg-transparent border border-outline-variant/30 rounded-md px-2 py-1 focus:outline-none">
                  {templates.map(t => <option key={t.state} value={t.state ?? ""}>{t.state ?? "Default"}</option>)}
                </select>
              )}
            </div>
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
                  <EmailVarChips onInsert={insertAtCursor} paymentLinks={paymentLinks} calendarLinks={calendarLinks} schedulingLinks={chipSchedulingLinks} />
                </div>
              </>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-outline-variant/10 shrink-0 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Cancel
          </button>
          <button type="button" onClick={send} disabled={sending || !subject.trim() || !body.trim()}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center gap-2">
            {sending ? "Sending…" : <><DollarSign className="w-4 h-4" /> Send &amp; move to Sent Deposit</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
