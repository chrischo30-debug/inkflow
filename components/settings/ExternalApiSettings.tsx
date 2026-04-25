"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ExternalLink, Eye, EyeOff, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SaveStatus = "idle" | "saving" | "success" | "error";

function HowToGuide({ steps, defaultOpen = false }: { steps: string[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4 transition-colors font-medium"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {open ? "Hide instructions" : "How to get this key"}
      </button>
      {open && (
        <ol className="mt-4 space-y-3 pl-0 list-none">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-on-surface-variant">
              <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
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
  howToDefaultOpen = false,
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
  howToDefaultOpen?: boolean;
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
          <p className="text-sm text-on-surface-variant mt-0.5 leading-relaxed">{description}</p>
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
      {howToSteps.length > 0 && <HowToGuide steps={howToSteps} defaultOpen={howToDefaultOpen} />}
    </div>
  );
}

const STRIPE_STEPS = [
  "Go to stripe.com and create a free account (or log in if you have one).",
  "After signing up, Stripe will ask you to activate your account — complete this to receive payouts. You'll need to add your bank account, SSN (last 4), and a few business details. This takes about 5 minutes.",
  "Once activated, go to Settings → Bank accounts to confirm your payout bank account is connected.",
  "Go to Developers → API keys in the left sidebar.",
  'Click Create secret key. When Stripe asks "How will you be using this key?" — select Powering an integration you built.',
  "Under Secret key, click Reveal live key (for real payments) or use the test key while testing.",
  "Copy the key — it starts with sk_live_ or sk_test_.",
  "Paste it in the field above and click Save.",
];

export function ExternalApiSettings({
  initialStripeKey,
  initialStripeWebhookSecret,
  artistId,
}: {
  initialStripeKey: string;
  initialStripeWebhookSecret: string;
  artistId: string;
}) {
  const [stripeKey, setStripeKey] = useState(initialStripeKey);
  const [savedStripeKey, setSavedStripeKey] = useState(initialStripeKey);
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState(initialStripeWebhookSecret);
  const [savedStripeWebhookSecret, setSavedStripeWebhookSecret] = useState(initialStripeWebhookSecret);
  const [stripeStatus, setStripeStatus] = useState<SaveStatus>("idle");
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeWebhookStatus, setStripeWebhookStatus] = useState<SaveStatus>("idle");
  const [stripeWebhookError, setStripeWebhookError] = useState<string | null>(null);
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false);
  const [stripeKeyVisible, setStripeKeyVisible] = useState(false);
  const [step2Flash, setStep2Flash] = useState(false);
  const prevSavedStripeKey = useRef(initialStripeKey);
  useEffect(() => {
    if (!prevSavedStripeKey.current && savedStripeKey) {
      setStep2Flash(true);
      const t = setTimeout(() => setStep2Flash(false), 2500);
      return () => clearTimeout(t);
    }
    prevSavedStripeKey.current = savedStripeKey;
  }, [savedStripeKey]);

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

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="rounded-xl border border-outline-variant/20 overflow-hidden">
          {/* Step 1 — API Key */}
          <div className="bg-surface-container-lowest p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${savedStripeKey ? "bg-emerald-100 text-emerald-700" : "bg-surface-container border border-outline-variant/30 text-on-surface-variant"}`}>
                {savedStripeKey ? "✓" : "1"}
              </span>
              <p className="text-sm font-semibold text-on-surface">Stripe API Key</p>
              {savedStripeKey && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="w-3 h-3" /> Connected
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">Generate deposit payment links directly from bookings. Clients pay, deposit is automatically marked as paid.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={stripeKeyVisible ? "text" : "password"}
                  value={stripeKey}
                  onChange={(e) => setStripeKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="pr-10 border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none"
                />
                <button
                  type="button"
                  onClick={() => setStripeKeyVisible(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  {stripeKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                type="button"
                onClick={() => saveExternalKey("stripe_api_key", stripeKey, setStripeStatus, setStripeError, setSavedStripeKey)}
                disabled={stripeStatus === "saving" || (Boolean(savedStripeKey) && stripeKey === savedStripeKey)}
                className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40"
              >
                {stripeStatus === "saving" ? "Saving…" : (Boolean(savedStripeKey) && stripeKey === savedStripeKey) ? "Saved" : "Save"}
              </Button>
            </div>
            {stripeStatus === "error" && (
              <p className="text-xs text-destructive">{stripeError ? `Save failed: ${stripeError}` : "Failed to save. Check your key and try again."}</p>
            )}
            {!savedStripeKey && <HowToGuide steps={STRIPE_STEPS} defaultOpen />}
          </div>

          {/* Divider with step label */}
          <div className="border-t border-outline-variant/15" />

          {/* Step 2 — Webhook */}
          <div className={`p-5 space-y-4 transition-all duration-700 ${savedStripeKey ? "" : "opacity-40 pointer-events-none select-none"} ${step2Flash ? "bg-indigo-50/50" : ""}`}>
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                savedStripeWebhookSecret
                  ? "bg-emerald-100 text-emerald-700"
                  : step2Flash
                    ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300 scale-110"
                    : "bg-surface-container border border-outline-variant/30 text-on-surface-variant"
              }`}>
                {savedStripeWebhookSecret ? "✓" : "2"}
              </span>
              <p className={`text-sm font-semibold transition-colors duration-300 ${step2Flash ? "text-indigo-700" : "text-on-surface"}`}>
                Stripe Webhook
              </p>
              {step2Flash && !savedStripeWebhookSecret && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 animate-pulse">
                  Do this next
                </span>
              )}
              {savedStripeWebhookSecret && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="w-3 h-3" /> Connected
                </span>
              )}
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed">
              Add this URL to Stripe so FlashBooker automatically marks deposits as paid when clients pay.
            </p>
            <ol className="space-y-2.5 pl-0 list-none">
              <li className="flex items-start gap-3 text-sm text-on-surface-variant">
                <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                <span className="leading-relaxed pt-0.5">
                  Go to{" "}
                  <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                    Stripe → Developers → Webhooks
                  </a>{" "}
                  and click <span className="font-medium text-on-surface">Add destination</span>
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm text-on-surface-variant">
                <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                <span className="leading-relaxed pt-0.5">Select <span className="font-medium text-on-surface">Your account</span></span>
              </li>
              <li className="flex items-start gap-3 text-sm text-on-surface-variant">
                <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                <span className="leading-relaxed pt-0.5">
                  Search for{" "}
                  <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded font-mono">checkout.session.completed</code>
                  , select it → Next
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm text-on-surface-variant">
                <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
                <span className="leading-relaxed pt-0.5">Select <span className="font-medium text-on-surface">Webhook endpoint</span> → Continue</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-on-surface-variant">
                <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">5</span>
                <span className="leading-relaxed pt-0.5">Paste your URL into the <span className="font-medium text-on-surface">Endpoint URL</span> field:</span>
              </li>
            </ol>
            <div className="ml-8 space-y-2">
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
            </div>
            <ol className="space-y-2.5 pl-0 list-none" start={6}>
              <li className="flex items-start gap-3 text-sm text-on-surface-variant">
                <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">6</span>
                <span className="leading-relaxed pt-0.5">Save, then open the destination detail page and click <span className="font-medium text-on-surface">Reveal signing secret</span>. Copy it below.</span>
              </li>
            </ol>

            <ApiKeyField
              label="Webhook Signing Secret"
              description="After creating the endpoint in Stripe, copy the signing secret (starts with whsec_) from the webhook detail page and paste it here."
              value={stripeWebhookSecret}
              onChange={setStripeWebhookSecret}
              placeholder="whsec_..."
              signupUrl="https://dashboard.stripe.com/webhooks"
              signupLabel="Open Stripe Webhooks"
              savedValue={savedStripeWebhookSecret}
              onSave={() => saveExternalKey("stripe_webhook_secret", stripeWebhookSecret, setStripeWebhookStatus, setStripeWebhookError, setSavedStripeWebhookSecret)}
              status={stripeWebhookStatus}
              errorMessage={stripeWebhookError}
              howToSteps={[]}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
