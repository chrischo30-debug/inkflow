"use client";

import { useState } from "react";
import { Check, ExternalLink, Eye, EyeOff, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SaveStatus = "idle" | "saving" | "success" | "error";

function HowToGuide({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-4 transition-colors"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? "Hide instructions" : "How to get this key"}
      </button>
      {open && (
        <ol className="mt-3 space-y-2 pl-0 list-none">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-on-surface-variant">
              <span className="w-4 h-4 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ApiKeyField({
  label,
  description,
  value,
  savedValue,
  onChange,
  placeholder,
  signupUrl,
  signupLabel,
  onSave,
  status,
  errorMessage,
  howToSteps,
}: {
  label: string;
  description: string;
  value: string;
  savedValue: string;
  onChange: (v: string) => void;
  placeholder: string;
  signupUrl: string;
  signupLabel: string;
  onSave: () => void;
  status: SaveStatus;
  errorMessage?: string | null;
  howToSteps: string[];
}) {
  const [show, setShow] = useState(false);
  const isSaved = Boolean(savedValue) && value === savedValue;
  const hasUnsavedChanges = Boolean(value) && value !== savedValue;

  return (
    <div className={`rounded-xl border p-5 space-y-3 transition-colors ${
      isSaved
        ? "border-emerald-300/60 bg-emerald-50/40"
        : "border-outline-variant/20 bg-surface-container-lowest"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-on-surface">{label}</p>
            {isSaved && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                <Check className="w-3 h-3" /> Connected
              </span>
            )}
            {hasUnsavedChanges && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Unsaved changes
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>
        </div>
        <a
          href={signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {signupLabel}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="pr-10 border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Button
          type="button"
          onClick={onSave}
          disabled={status === "saving" || (isSaved && !hasUnsavedChanges)}
          className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40"
        >
          {status === "saving"
            ? "Saving…"
            : hasUnsavedChanges
              ? (isSaved ? "Update" : "Save")
              : isSaved
                ? "Saved"
                : "Save"}
        </Button>
      </div>
      {status === "error" && (
        <p className="text-xs text-destructive">
          {errorMessage
            ? `Save failed: ${errorMessage}`
            : "Failed to save. Check your key and try again."}
        </p>
      )}
      <HowToGuide steps={howToSteps} />
    </div>
  );
}

const STRIPE_STEPS = [
  "Go to stripe.com and create a free account (or log in if you have one).",
  "In the left sidebar, click Developers.",
  "Click API keys.",
  "Under Secret key, click Reveal live key (for real payments) or use the test key while testing.",
  "Copy the key — it starts with sk_live_ or sk_test_.",
  "Paste it in the field above and click Save.",
];

const KIT_API_KEY_STEPS = [
  "Go to kit.com and log in (or create a free account).",
  "Click your name in the top right, then select Settings.",
  "Click the Developer tab.",
  "Under API Key, copy the public API key (not the secret).",
  "Paste it in the field above and click Save.",
];

const KIT_FORM_ID_STEPS = [
  "In Kit, go to Grow → Landing Pages & Forms.",
  "Open an existing form or create a new one.",
  "Look at the URL in your browser: app.kit.com/forms/12345/edit",
  "The number in the URL is your Form ID.",
  "Paste it in the field above and click Save.",
  "Then go to Newsletter Form in the sidebar to configure and enable your signup form.",
];

export function ExternalApiSettings({
  initialStripeKey,
  initialStripeWebhookSecret,
  initialKitApiKey,
  initialKitFormId,
  artistId,
}: {
  initialStripeKey: string;
  initialStripeWebhookSecret: string;
  initialKitApiKey: string;
  initialKitFormId: string;
  artistId: string;
}) {
  const [stripeKey, setStripeKey] = useState(initialStripeKey);
  const [savedStripeKey, setSavedStripeKey] = useState(initialStripeKey);
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState(initialStripeWebhookSecret);
  const [savedStripeWebhookSecret, setSavedStripeWebhookSecret] = useState(initialStripeWebhookSecret);
  const [kitApiKey, setKitApiKey] = useState(initialKitApiKey);
  const [savedKitApiKey, setSavedKitApiKey] = useState(initialKitApiKey);
  const [kitFormId, setKitFormId] = useState(initialKitFormId);
  const [savedKitFormId, setSavedKitFormId] = useState(initialKitFormId);
  const [stripeStatus, setStripeStatus] = useState<SaveStatus>("idle");
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeWebhookStatus, setStripeWebhookStatus] = useState<SaveStatus>("idle");
  const [stripeWebhookError, setStripeWebhookError] = useState<string | null>(null);
  const [kitApiStatus, setKitApiStatus] = useState<SaveStatus>("idle");
  const [kitFormStatus, setKitFormStatus] = useState<SaveStatus>("idle");
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false);

  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/stripe/${artistId}`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setWebhookUrlCopied(true);
      setTimeout(() => setWebhookUrlCopied(false), 2000);
    });
  };

  const saveExternalKey = async (
    field: "stripe_api_key" | "stripe_webhook_secret",
    value: string,
    setStatus: (s: SaveStatus) => void,
    setError?: (e: string | null) => void,
    onSavedValue?: (v: string) => void,
  ) => {
    setStatus("saving");
    setError?.(null);
    const res = await fetch("/api/artist/external-keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      onSavedValue?.(value);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      let msg: string | null = null;
      try {
        const body = await res.json();
        if (body?.error) msg = String(body.error);
      } catch { /* ignore */ }
      setError?.(msg);
      setStatus("error");
      setTimeout(() => { setStatus("idle"); setError?.(null); }, 8000);
    }
  };

  const saveKitField = async (
    field: "kit_api_key" | "kit_form_id",
    value: string,
    setStatus: (s: SaveStatus) => void,
    onSavedValue?: (v: string) => void,
  ) => {
    setStatus("saving");
    const res = await fetch("/api/artist/kit-integration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      onSavedValue?.(value);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Payment & Scheduling</p>
        <ApiKeyField
          label="Stripe"
          description="Generate deposit payment links directly from bookings. Clients pay, deposit is automatically marked as paid."
          value={stripeKey}
          onChange={setStripeKey}
          placeholder="sk_live_..."
          signupUrl="https://dashboard.stripe.com/register"
          signupLabel="Create Stripe account"
          savedValue={savedStripeKey}
          onSave={() => saveExternalKey("stripe_api_key", stripeKey, setStripeStatus, setStripeError, setSavedStripeKey)}
          status={stripeStatus}
          errorMessage={stripeError}
          howToSteps={STRIPE_STEPS}
        />
        {stripeKey && (
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-on-surface">Stripe Webhook</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Add this URL to Stripe so deposits are automatically tracked. Go to{" "}
                <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Stripe → Developers → Webhooks
                </a>{" "}
                → Add endpoint, paste the URL below, and select the{" "}
                <code className="text-xs bg-surface-container-high px-1 py-0.5 rounded">checkout.session.completed</code> event.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-surface-container-high/60 border border-outline-variant/20 px-3 py-2">
              <p className="flex-1 text-xs font-mono text-on-surface-variant truncate">{webhookUrl}</p>
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="shrink-0 p-1 rounded text-on-surface-variant hover:text-on-surface transition-colors"
                title="Copy URL"
              >
                {webhookUrlCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <ApiKeyField
              label="Webhook Signing Secret"
              description="After creating the webhook endpoint in Stripe, copy the signing secret (starts with whsec_) and save it here."
              value={stripeWebhookSecret}
              onChange={setStripeWebhookSecret}
              placeholder="whsec_..."
              signupUrl="https://dashboard.stripe.com/webhooks"
              signupLabel="Open Stripe Webhooks"
              savedValue={savedStripeWebhookSecret}
              onSave={() => saveExternalKey("stripe_webhook_secret", stripeWebhookSecret, setStripeWebhookStatus, setStripeWebhookError, setSavedStripeWebhookSecret)}
              status={stripeWebhookStatus}
              errorMessage={stripeWebhookError}
              howToSteps={[
                "In Stripe, go to Developers → Webhooks.",
                "Click Add endpoint.",
                `Paste your webhook URL: ${webhookUrl}`,
                "Under Events, select checkout.session.completed.",
                "Click Add endpoint.",
                "On the webhook detail page, click Reveal signing secret.",
                "Copy the secret (starts with whsec_) and paste it above.",
              ]}
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Newsletter</p>
        <ApiKeyField
          label="Kit — API Key"
          description="Your public Kit API key. Used to add subscribers from your newsletter signup form."
          value={kitApiKey}
          savedValue={savedKitApiKey}
          onChange={setKitApiKey}
          placeholder="your kit api key..."
          signupUrl="https://kit.com"
          signupLabel="Create Kit account"
          onSave={() => saveKitField("kit_api_key", kitApiKey, setKitApiStatus, setSavedKitApiKey)}
          status={kitApiStatus}
          howToSteps={KIT_API_KEY_STEPS}
        />
        <ApiKeyField
          label="Kit — Form ID"
          description="The ID of the Kit form to subscribe people to. New subscribers are added to this form."
          value={kitFormId}
          savedValue={savedKitFormId}
          onChange={setKitFormId}
          placeholder="12345"
          signupUrl="https://app.kit.com/forms"
          signupLabel="Open Kit forms"
          onSave={() => saveKitField("kit_form_id", kitFormId, setKitFormStatus, setSavedKitFormId)}
          status={kitFormStatus}
          howToSteps={KIT_FORM_ID_STEPS}
        />
      </div>
    </div>
  );
}
