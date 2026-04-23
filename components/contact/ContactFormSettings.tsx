"use client";

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  slug: string;
  initialEnabled: boolean;
  initialHeader: string;
  initialSubtext: string;
  initialButtonText: string;
  initialConfirmationMessage: string;
  initialShowOnClosed: boolean;
  initialPhoneEnabled: boolean;
  initialPhoneRequired: boolean;
}

export function ContactFormSettings({
  slug,
  initialEnabled,
  initialHeader,
  initialSubtext,
  initialButtonText,
  initialConfirmationMessage,
  initialShowOnClosed,
  initialPhoneEnabled,
  initialPhoneRequired,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [header, setHeader] = useState(initialHeader);
  const [subtext, setSubtext] = useState(initialSubtext);
  const [buttonText, setButtonText] = useState(initialButtonText);
  const [confirmationMessage, setConfirmationMessage] = useState(initialConfirmationMessage);
  const [showOnClosed, setShowOnClosed] = useState(initialShowOnClosed);
  const [phoneEnabled, setPhoneEnabled] = useState(initialPhoneEnabled);
  const [phoneRequired, setPhoneRequired] = useState(initialPhoneRequired);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async (patch: Record<string, unknown>) => {
    setStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/artist/contact-form", {
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
    save({ contact_form_enabled: next });
  };

  const handleShowOnClosedToggle = () => {
    const next = !showOnClosed;
    setShowOnClosed(next);
    save({ show_contact_on_closed: next });
  };

  const handlePhoneEnabledToggle = () => {
    const next = !phoneEnabled;
    setPhoneEnabled(next);
    if (!next) setPhoneRequired(false);
    save({ contact_phone_enabled: next });
  };

  const handlePhoneRequiredToggle = () => {
    const next = !phoneRequired;
    setPhoneRequired(next);
    save({ contact_phone_required: next });
  };

  const handleSaveText = () => {
    save({
      contact_form_header: header,
      contact_form_subtext: subtext,
      contact_form_button_text: buttonText,
      contact_form_confirmation_message: confirmationMessage,
    });
  };

  const publicUrl = slug ? `/${slug}/contact` : null;

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className={`rounded-xl border p-5 transition-colors ${enabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-outline-variant/20 bg-surface-container-low"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${enabled ? "bg-emerald-500" : "bg-outline-variant/60"}`} />
            <div>
              <p className={`text-sm font-semibold ${enabled ? "text-emerald-700 dark:text-emerald-400" : "text-on-surface"}`}>
                Contact form {enabled ? "enabled" : "disabled"}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {enabled
                  ? `Live at ${slug ? `/${slug}/contact` : "your contact URL"}`
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

      {/* Fields */}
      <div className="rounded-xl border border-outline-variant/20 p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-on-surface mb-0.5">Form fields</p>
          <p className="text-sm text-on-surface-variant">Name, email, and message are always included.</p>
        </div>

        {/* Phone */}
        <div className="flex items-center justify-between py-3 border-t border-outline-variant/15">
          <div>
            <p className="text-sm font-medium text-on-surface">Phone Number</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Add a phone number field to the form</p>
          </div>
          <div className="flex items-center gap-4">
            {phoneEnabled && (
              <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={phoneRequired}
                  onChange={handlePhoneRequiredToggle}
                  className="rounded border-outline-variant/50 accent-primary"
                />
                Required
              </label>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={phoneEnabled}
              onClick={handlePhoneEnabledToggle}
              className={`relative shrink-0 inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none ${phoneEnabled ? "bg-primary" : "bg-outline-variant/40"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${phoneEnabled ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>
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
            placeholder="Get in touch"
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
            placeholder="Fill out the form and I'll get back to you soon."
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
            placeholder="Send Message"
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
            placeholder="Thanks for reaching out! I'll be in touch soon."
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
              When your books are closed, embed this contact form so visitors can still reach you.
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
      {publicUrl && (
        <div className="rounded-xl border border-outline-variant/20 p-5">
          <p className="text-sm font-semibold text-on-surface mb-1">Public URL</p>
          <p className="text-xs text-on-surface-variant mb-3">Share this link or embed it anywhere.</p>
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
