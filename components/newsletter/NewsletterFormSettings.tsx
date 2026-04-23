"use client";

import { useState } from "react";
import { Check, ExternalLink, AlertTriangle } from "lucide-react";
import Link from "next/link";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  slug: string;
  kitConnected: boolean;  // true if both kit_api_key and kit_form_id are set
  initialEnabled: boolean;
  initialHeader: string;
  initialSubtext: string;
  initialButtonText: string;
  initialConfirmationMessage: string;
  initialShowOnClosed: boolean;
}

export function NewsletterFormSettings({
  slug,
  kitConnected,
  initialEnabled,
  initialHeader,
  initialSubtext,
  initialButtonText,
  initialConfirmationMessage,
  initialShowOnClosed,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [header, setHeader] = useState(initialHeader);
  const [subtext, setSubtext] = useState(initialSubtext);
  const [buttonText, setButtonText] = useState(initialButtonText);
  const [confirmationMessage, setConfirmationMessage] = useState(initialConfirmationMessage);
  const [showOnClosed, setShowOnClosed] = useState(initialShowOnClosed);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async (patch: Record<string, unknown>) => {
    setStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/artist/kit-integration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Failed to save");
        setStatus("error");
      }
    } catch {
      setSaveError("Failed to save");
      setStatus("error");
    }
  };

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    save({ newsletter_form_enabled: next });
  };

  const handleShowOnClosedToggle = () => {
    const next = !showOnClosed;
    setShowOnClosed(next);
    save({ show_newsletter_on_closed: next });
  };

  const handleSaveText = () => {
    save({
      newsletter_form_header: header,
      newsletter_form_subtext: subtext,
      newsletter_form_button_text: buttonText,
      newsletter_form_confirmation_message: confirmationMessage,
    });
  };

  const publicUrl = slug ? `/${slug}/newsletter` : null;

  // Kit not connected — show setup gate
  if (!kitConnected) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Kit not connected</p>
            <p className="text-sm text-amber-800 mt-1">
              To enable newsletter signups you need to connect your Kit account. Go to{" "}
              <Link href="/settings" className="underline font-medium hover:text-amber-900">
                Settings → Integrations
              </Link>{" "}
              and add your Kit API key and form ID.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-white p-4 space-y-3 text-sm text-amber-900">
          <p className="font-semibold">How to connect Kit</p>
          <ol className="space-y-2 list-none">
            {[
              "Go to kit.com and log in (or create a free account).",
              "Click your name → Settings → Developer.",
              "Copy your API Key (the public one, not the secret).",
              "Go to Grow → Landing Pages & Forms, then open or create a form.",
              "Copy the form ID from the URL: app.kit.com/forms/{id}/edit.",
              "Paste both into Settings → Integrations → Kit, then click Save.",
              "Come back here to enable and configure your newsletter form.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 mt-1 px-3 py-2 text-sm font-medium rounded-lg bg-amber-900 text-white hover:bg-amber-800 transition-colors"
          >
            Go to Integrations
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className={`rounded-xl border p-5 transition-colors ${enabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-outline-variant/20 bg-surface-container-low"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${enabled ? "bg-emerald-500" : "bg-outline-variant/60"}`} />
            <div>
              <p className={`text-sm font-semibold ${enabled ? "text-emerald-700 dark:text-emerald-400" : "text-on-surface"}`}>
                Newsletter form {enabled ? "enabled" : "disabled"}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {enabled
                  ? `Live at ${slug ? `/${slug}/newsletter` : "your newsletter URL"}`
                  : "Form is not publicly accessible"}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={handleToggle}
            className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-emerald-500" : "bg-outline-variant/40"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {/* Text content */}
      <div className="rounded-xl border border-outline-variant/20 p-5 space-y-4">
        <p className="text-sm font-semibold text-on-surface">Form text</p>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-on-surface-variant">Heading</label>
          <input
            type="text"
            value={header}
            onChange={e => setHeader(e.target.value)}
            maxLength={200}
            placeholder="Stay in the loop"
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-on-surface-variant">Subtext</label>
          <textarea
            value={subtext}
            onChange={e => setSubtext(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Subscribe to get updates, flash alerts, and availability drops."
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none placeholder:text-[#888888]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-on-surface-variant">Button text</label>
          <input
            type="text"
            value={buttonText}
            onChange={e => setButtonText(e.target.value)}
            maxLength={100}
            placeholder="Subscribe"
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-on-surface-variant">Confirmation message</label>
          <textarea
            value={confirmationMessage}
            onChange={e => setConfirmationMessage(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="You're subscribed! Check your inbox to confirm."
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none placeholder:text-[#888888]"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveText}
            disabled={status === "saving"}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {status === "saving" ? "Saving…" : "Save"}
          </button>
          {status === "saved" && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          {status === "error" && (
            <span className="text-sm text-destructive">{saveError ?? "Failed to save"}</span>
          )}
        </div>
      </div>

      {/* Show on closed books page */}
      <div className="rounded-xl border border-outline-variant/20 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-on-surface">Show on closed books page</p>
            <p className="text-sm text-on-surface-variant mt-0.5">
              When your books are closed, show this signup form so visitors can stay connected.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showOnClosed}
            onClick={handleShowOnClosedToggle}
            className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${showOnClosed ? "bg-primary" : "bg-outline-variant/40"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${showOnClosed ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {/* Public link */}
      {publicUrl && enabled && (
        <div className="rounded-xl border border-outline-variant/20 p-5">
          <p className="text-sm font-semibold text-on-surface mb-1">Public URL</p>
          <p className="text-xs text-on-surface-variant mb-3">Share this link anywhere.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 text-xs bg-surface-container-low border border-outline-variant/20 rounded-lg text-on-surface-variant truncate">
              {typeof window !== "undefined" ? `${window.location.origin}${publicUrl}` : publicUrl}
            </code>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-outline-variant/60 text-on-surface-variant hover:text-on-surface hover:border-on-surface/30 hover:bg-surface-container-high transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
