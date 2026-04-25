"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, DollarSign } from "lucide-react";
import type { SchedulingLink } from "@/lib/pipeline-settings";

interface Props {
  bookingId: string;
  clientName: string;
  hasStripe: boolean;
  schedulingLinks: SchedulingLink[];
  artistId: string;
  onSent: (schedulingLinkId?: string) => void;
  onClose: () => void;
}

interface Template { state: string | null; subject: string; body: string; }

export function SendDepositModal({ bookingId, clientName, hasStripe, schedulingLinks, artistId, onSent, onClose }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Stripe deposit link generation
  const [depositAmount, setDepositAmount] = useState("");
  const [depositUrl, setDepositUrl] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkError, setLinkError] = useState("");

  // Automation scheduling link (only shown if Stripe configured)
  const [automationLinkId, setAutomationLinkId] = useState<string>("");

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}/send-email`)
      .then(r => r.json())
      .then(data => {
        const all: Template[] = data.templates ?? [];
        setTemplates(all);
        const depositTpl = all.find(t => t.state === "sent_deposit") ?? all[0];
        if (depositTpl) { setSubject(depositTpl.subject); setBody(depositTpl.body); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId]);

  const selectTemplate = (state: string | null) => {
    const t = templates.find(x => x.state === state);
    if (t) { setSubject(t.subject); setBody(t.body); }
  };

  const generateDepositLink = async () => {
    const cents = Math.round(parseFloat(depositAmount) * 100);
    if (!cents || cents < 100) { setLinkError("Enter a valid amount (min $1)"); return; }
    setGeneratingLink(true); setLinkError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/stripe-payment-link`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: cents }),
      });
      const data = await res.json();
      if (!res.ok) { setLinkError(data.error ?? "Failed to generate link"); return; }
      setDepositUrl(data.url);
      navigator.clipboard.writeText(data.url).then(() => {
        setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
      });
    } catch { setLinkError("Network error"); }
    finally { setGeneratingLink(false); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(depositUrl).then(() => {
      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
    });
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant/10 shrink-0">
          <h2 className="text-base font-semibold text-on-surface">Send Deposit</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Send {clientName} a deposit request.</p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Stripe deposit link generator */}
          {hasStripe && (
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-3">
              <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">Generate Stripe deposit link</p>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 flex-1 rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 focus-within:border-primary transition-colors">
                  <span className="text-sm text-on-surface-variant">$</span>
                  <input type="number" min="1" step="0.01" placeholder="0.00" value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && generateDepositLink()}
                    className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50" />
                </div>
                <button type="button" onClick={depositUrl ? copyLink : generateDepositLink}
                  disabled={generatingLink}
                  className="px-3 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 disabled:opacity-50 transition-opacity whitespace-nowrap">
                  {generatingLink ? "Creating…" : depositUrl ? (linkCopied ? "✓ Copied" : "Copy link") : "Generate & copy"}
                </button>
              </div>
              {depositUrl && (
                <p className="text-[11px] font-mono text-on-surface-variant/60 truncate">{depositUrl}</p>
              )}
              {linkError && <p className="text-xs text-destructive">{linkError}</p>}
            </div>
          )}

          {/* Automation: scheduling link picker (Stripe only) */}
          {hasStripe && schedulingLinks.length > 0 && (
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
                <select onChange={e => selectTemplate(e.target.value || null)}
                  className="text-xs text-on-surface-variant bg-transparent border border-outline-variant/30 rounded-md px-2 py-1 focus:outline-none">
                  <option value="">Choose template…</option>
                  {templates.map(t => <option key={t.state} value={t.state ?? ""}>{t.state ?? "Default"}</option>)}
                </select>
              )}
            </div>
            {loading ? (
              <p className="text-xs text-on-surface-variant/60">Loading template…</p>
            ) : (
              <>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
                  className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary" />
                <textarea rows={7} value={body} onChange={e => setBody(e.target.value)} placeholder="Email body"
                  className="w-full px-3 py-2 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none font-mono" />
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
