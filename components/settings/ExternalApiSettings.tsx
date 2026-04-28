"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Eye, EyeOff, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CoachmarkSequence } from "@/components/coachmarks/Coachmark";

type SaveStatus = "idle" | "saving" | "success" | "error";
type ProviderTab = "stripe" | "square";

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

function SecretField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
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

const SQUARE_STEPS = [
  "Sign in to the Square Developer Console at developer.squareup.com/apps using your existing Square account (same email and password as squareup.com — no separate signup needed).",
  "Click + Add application and give it any name (e.g., \"Booking Deposits\"). Clients won't see this. If a \"What will you build first?\" wizard appears, check Accept payments, click Next, then Skip through the remaining steps.",
  "At the top of your application page, switch the environment toggle to Production.",
  "In the left sidebar, click Credentials. Under \"Production Access token,\" click Copy, then paste the token above.",
  "In the left sidebar, click Locations. Copy the Location ID for your business (a string like L1A2B3C4D5E6F) and paste it above.",
  "Click Save.",
  "Finish setup: Complete the Webhook section below so paid deposits automatically move bookings forward.",
];

interface Props {
  initialProvider: "stripe" | "square" | null;
  initialStripeKey: string;
  initialStripeWebhookSecret: string;
  initialSquareAccessToken: string;
  initialSquareLocationId: string;
  initialSquareWebhookSignatureKey: string;
  initialSquareEnvironment: "production" | "sandbox";
  artistId: string;
}

export function ExternalApiSettings(props: Props) {
  const {
    initialProvider,
    initialStripeKey,
    initialStripeWebhookSecret,
    initialSquareAccessToken,
    initialSquareLocationId,
    initialSquareWebhookSignatureKey,
    initialSquareEnvironment,
    artistId,
  } = props;

  // Show whichever the artist already configured; default to Stripe for new accounts.
  const [tab, setTab] = useState<ProviderTab>(initialProvider ?? "stripe");
  const [activeProvider, setActiveProvider] = useState<"stripe" | "square" | null>(initialProvider);

  // Stripe state
  const [stripeKey, setStripeKey] = useState(initialStripeKey);
  const [savedStripeKey, setSavedStripeKey] = useState(initialStripeKey);
  const [stripeStatus, setStripeStatus] = useState<SaveStatus>("idle");
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState(initialStripeWebhookSecret);
  const [savedStripeWebhookSecret, setSavedStripeWebhookSecret] = useState(initialStripeWebhookSecret);
  const [stripeWebhookStatus, setStripeWebhookStatus] = useState<SaveStatus>("idle");
  const [stripeWebhookError, setStripeWebhookError] = useState<string | null>(null);

  // Square state
  const [squareToken, setSquareToken] = useState(initialSquareAccessToken);
  const [savedSquareToken, setSavedSquareToken] = useState(initialSquareAccessToken);
  const [squareLocation, setSquareLocation] = useState(initialSquareLocationId);
  const [savedSquareLocation, setSavedSquareLocation] = useState(initialSquareLocationId);
  const [squareEnv, setSquareEnv] = useState<"production" | "sandbox">(initialSquareEnvironment);
  const [savedSquareEnv, setSavedSquareEnv] = useState<"production" | "sandbox">(initialSquareEnvironment);
  const [squareStatus, setSquareStatus] = useState<SaveStatus>("idle");
  const [squareError, setSquareError] = useState<string | null>(null);
  const [squareWebhookKey, setSquareWebhookKey] = useState(initialSquareWebhookSignatureKey);
  const [savedSquareWebhookKey, setSavedSquareWebhookKey] = useState(initialSquareWebhookSignatureKey);
  const [squareWebhookStatus, setSquareWebhookStatus] = useState<SaveStatus>("idle");
  const [squareWebhookError, setSquareWebhookError] = useState<string | null>(null);

  // Step-2 flash on first key save
  const [step2Flash, setStep2Flash] = useState(false);
  const prevSavedStripeKey = useRef(initialStripeKey);
  const prevSavedSquareToken = useRef(initialSquareAccessToken);
  useEffect(() => {
    if (tab === "stripe" && !prevSavedStripeKey.current && savedStripeKey) {
      setStep2Flash(true);
      const t = setTimeout(() => setStep2Flash(false), 2500);
      return () => clearTimeout(t);
    }
    prevSavedStripeKey.current = savedStripeKey;
  }, [savedStripeKey, tab]);
  useEffect(() => {
    if (tab === "square" && !prevSavedSquareToken.current && savedSquareToken) {
      setStep2Flash(true);
      const t = setTimeout(() => setStep2Flash(false), 2500);
      return () => clearTimeout(t);
    }
    prevSavedSquareToken.current = savedSquareToken;
  }, [savedSquareToken, tab]);

  const stripeWebhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/stripe/${artistId}`;
  const squareWebhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/square/${artistId}`;
  const [stripeWebhookCopied, setStripeWebhookCopied] = useState(false);
  const [squareWebhookCopied, setSquareWebhookCopied] = useState(false);

  const persist = async (
    body: Record<string, string | null>,
    setStatus: (s: SaveStatus) => void,
    setError: (e: string | null) => void,
    onSuccess?: () => void,
  ) => {
    setStatus("saving");
    setError(null);
    const res = await fetch("/api/artist/external-keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      onSuccess?.();
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      let msg: string | null = null;
      try {
        const data = await res.json();
        if (data?.error) msg = String(data.error);
      } catch { /* ignore */ }
      setError(msg);
      setStatus("error");
      setTimeout(() => { setStatus("idle"); setError(null); }, 8000);
    }
  };

  const switchProviderTo = async (provider: "stripe" | "square") => {
    setTab(provider);
    // If the artist hasn't picked a provider yet (or picked the other one),
    // and they have credentials for this one, mark this one active.
    const hasCreds = provider === "stripe"
      ? Boolean(savedStripeKey)
      : Boolean(savedSquareToken && savedSquareLocation);
    if (hasCreds && activeProvider !== provider) {
      await fetch("/api/artist/external-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_provider: provider }),
      });
      setActiveProvider(provider);
    }
  };

  const saveStripeKey = () =>
    persist(
      {
        stripe_api_key: stripeKey,
        // If they had no provider set or they were on Square, switch to Stripe on save.
        ...(activeProvider !== "stripe" ? { payment_provider: "stripe" } : {}),
      },
      setStripeStatus,
      setStripeError,
      () => {
        setSavedStripeKey(stripeKey);
        setActiveProvider("stripe");
      },
    );

  const saveStripeWebhook = () =>
    persist(
      { stripe_webhook_secret: stripeWebhookSecret },
      setStripeWebhookStatus,
      setStripeWebhookError,
      () => setSavedStripeWebhookSecret(stripeWebhookSecret),
    );

  const saveSquareCreds = () =>
    persist(
      {
        square_access_token: squareToken,
        square_location_id: squareLocation,
        square_environment: squareEnv,
        ...(activeProvider !== "square" ? { payment_provider: "square" } : {}),
      },
      setSquareStatus,
      setSquareError,
      () => {
        setSavedSquareToken(squareToken);
        setSavedSquareLocation(squareLocation);
        setSavedSquareEnv(squareEnv);
        setActiveProvider("square");
      },
    );

  const saveSquareWebhook = () =>
    persist(
      { square_webhook_signature_key: squareWebhookKey },
      setSquareWebhookStatus,
      setSquareWebhookError,
      () => setSavedSquareWebhookKey(squareWebhookKey),
    );

  const stripeConnected = Boolean(savedStripeKey);
  const squareConnected = Boolean(savedSquareToken && savedSquareLocation);
  const stripeKeySavedHere = Boolean(savedStripeKey) && stripeKey === savedStripeKey;
  const squareCredsSavedHere =
    Boolean(savedSquareToken) &&
    squareToken === savedSquareToken &&
    squareLocation === savedSquareLocation &&
    squareEnv === savedSquareEnv;

  return (
    <div className="space-y-6">
      <CoachmarkSequence tips={[
        {
          id: "settings.payment-provider",
          anchorSelector: '[data-coachmark="payment-provider"]',
          title: "Pick a payment provider",
          body: <>
            <p>Connect Stripe or Square so FlashBooker can generate deposit links and auto-mark them paid.</p>
            <p>Pick one — you can switch later. Skip both and you can still send your own payment link and tick the deposit checkbox manually.</p>
          </>,
        },
      ]} />

      {/* Provider tabs */}
      <div data-coachmark="payment-provider" className="rounded-xl border border-outline-variant/20 overflow-hidden">
        <div className="flex border-b border-outline-variant/20 bg-surface-container-low">
          <ProviderTabButton
            label="Stripe"
            active={tab === "stripe"}
            connected={stripeConnected}
            isActiveProvider={activeProvider === "stripe"}
            onClick={() => switchProviderTo("stripe")}
          />
          <ProviderTabButton
            label="Square"
            active={tab === "square"}
            connected={squareConnected}
            isActiveProvider={activeProvider === "square"}
            onClick={() => switchProviderTo("square")}
          />
        </div>

        {tab === "stripe" && (
          <StripePanel
            stripeKey={stripeKey}
            setStripeKey={setStripeKey}
            savedStripeKey={savedStripeKey}
            stripeKeySavedHere={stripeKeySavedHere}
            saveStripeKey={saveStripeKey}
            stripeStatus={stripeStatus}
            stripeError={stripeError}
            stripeWebhookSecret={stripeWebhookSecret}
            setStripeWebhookSecret={setStripeWebhookSecret}
            savedStripeWebhookSecret={savedStripeWebhookSecret}
            saveStripeWebhook={saveStripeWebhook}
            stripeWebhookStatus={stripeWebhookStatus}
            stripeWebhookError={stripeWebhookError}
            stripeWebhookUrl={stripeWebhookUrl}
            stripeWebhookCopied={stripeWebhookCopied}
            setStripeWebhookCopied={setStripeWebhookCopied}
            step2Flash={step2Flash}
          />
        )}

        {tab === "square" && (
          <SquarePanel
            squareToken={squareToken}
            setSquareToken={setSquareToken}
            squareLocation={squareLocation}
            setSquareLocation={setSquareLocation}
            squareEnv={squareEnv}
            setSquareEnv={setSquareEnv}
            squareCredsSavedHere={squareCredsSavedHere}
            saveSquareCreds={saveSquareCreds}
            squareStatus={squareStatus}
            squareError={squareError}
            squareConnected={squareConnected}
            squareWebhookKey={squareWebhookKey}
            setSquareWebhookKey={setSquareWebhookKey}
            savedSquareWebhookKey={savedSquareWebhookKey}
            saveSquareWebhook={saveSquareWebhook}
            squareWebhookStatus={squareWebhookStatus}
            squareWebhookError={squareWebhookError}
            squareWebhookUrl={squareWebhookUrl}
            squareWebhookCopied={squareWebhookCopied}
            setSquareWebhookCopied={setSquareWebhookCopied}
            step2Flash={step2Flash}
          />
        )}
      </div>

      {stripeConnected && squareConnected && (
        <p className="text-xs text-on-surface-variant/70">
          Both providers have credentials saved. Only the active one ({activeProvider ?? "—"}) is used for new deposits — switch by saving on the other tab.
        </p>
      )}
    </div>
  );
}

function ProviderTabButton({
  label,
  active,
  connected,
  isActiveProvider,
  onClick,
}: {
  label: string;
  active: boolean;
  connected: boolean;
  isActiveProvider: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-5 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
        active
          ? "bg-surface text-on-surface border-b-2 border-primary"
          : "text-on-surface-variant hover:bg-surface-container-high"
      }`}
    >
      {label}
      {connected && (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
          isActiveProvider ? "bg-emerald-100 text-emerald-700" : "bg-surface-container-high text-on-surface-variant"
        }`}>
          <Check className="w-3 h-3" /> {isActiveProvider ? "Active" : "Saved"}
        </span>
      )}
    </button>
  );
}

// ─── Stripe panel ───────────────────────────────────────────────────────────
function StripePanel({
  stripeKey, setStripeKey, savedStripeKey, stripeKeySavedHere, saveStripeKey,
  stripeStatus, stripeError,
  stripeWebhookSecret, setStripeWebhookSecret, savedStripeWebhookSecret,
  saveStripeWebhook, stripeWebhookStatus, stripeWebhookError,
  stripeWebhookUrl, stripeWebhookCopied, setStripeWebhookCopied,
  step2Flash,
}: {
  stripeKey: string; setStripeKey: (v: string) => void; savedStripeKey: string;
  stripeKeySavedHere: boolean; saveStripeKey: () => void;
  stripeStatus: SaveStatus; stripeError: string | null;
  stripeWebhookSecret: string; setStripeWebhookSecret: (v: string) => void;
  savedStripeWebhookSecret: string; saveStripeWebhook: () => void;
  stripeWebhookStatus: SaveStatus; stripeWebhookError: string | null;
  stripeWebhookUrl: string; stripeWebhookCopied: boolean;
  setStripeWebhookCopied: (v: boolean) => void;
  step2Flash: boolean;
}) {
  const copyUrl = () => {
    navigator.clipboard.writeText(stripeWebhookUrl).then(() => {
      setStripeWebhookCopied(true);
      setTimeout(() => setStripeWebhookCopied(false), 2000);
    });
  };

  return (
    <div>
      {/* Step 1 — API key */}
      <div className="bg-surface-container-lowest p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${savedStripeKey ? "bg-emerald-100 text-emerald-700" : "bg-surface-container border border-outline-variant/30 text-on-surface-variant"}`}>
            {savedStripeKey ? "✓" : "1"}
          </span>
          <p className="text-base font-semibold text-on-surface">Stripe API Key</p>
        </div>
        <div className="text-sm text-on-surface-variant space-y-2 leading-relaxed">
          <p>Generate deposit payment links directly from bookings.</p>
          <p>When a client pays, the deposit is automatically marked as paid and the booking moves forward on its own.</p>
        </div>
        <div className="flex gap-2">
          <SecretField value={stripeKey} onChange={setStripeKey} placeholder="sk_live_..." />
          <Button
            type="button"
            onClick={saveStripeKey}
            disabled={stripeStatus === "saving" || stripeKeySavedHere}
            className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40"
          >
            {stripeStatus === "saving" ? "Saving…" : stripeKeySavedHere ? "Saved" : "Save"}
          </Button>
        </div>
        {stripeStatus === "error" && (
          <p className="text-xs text-destructive">{stripeError ? `Save failed: ${stripeError}` : "Failed to save."}</p>
        )}
        {!savedStripeKey && <HowToGuide steps={STRIPE_STEPS} defaultOpen />}
      </div>

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
          <p className="text-sm font-semibold text-on-surface">Stripe Webhook</p>
          {step2Flash && !savedStripeWebhookSecret && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 animate-pulse">
              Do this next
            </span>
          )}
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed">
          Add this URL to Stripe so FlashBooker automatically marks deposits as paid when clients pay.
        </p>
        <ol className="space-y-2.5 pl-0 list-none">
          <NumberedStep n={1}>
            Go to{" "}
            <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Stripe → Developers → Webhooks</a>{" "}
            and click <span className="font-medium text-on-surface">Add destination</span>.
          </NumberedStep>
          <NumberedStep n={2}>Select <span className="font-medium text-on-surface">Your account</span>.</NumberedStep>
          <NumberedStep n={3}>
            Search for <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded font-mono">checkout.session.completed</code>, select it → Next.
          </NumberedStep>
          <NumberedStep n={4}>Select <span className="font-medium text-on-surface">Webhook endpoint</span> → Continue.</NumberedStep>
          <NumberedStep n={5}>Paste your URL into the <span className="font-medium text-on-surface">Endpoint URL</span> field:</NumberedStep>
        </ol>
        <UrlBox url={stripeWebhookUrl} copied={stripeWebhookCopied} onCopy={copyUrl} />
        <ol className="space-y-2.5 pl-0 list-none" start={6}>
          <NumberedStep n={6}>Save, then open the destination detail page and click <span className="font-medium text-on-surface">Reveal signing secret</span>. Paste it below.</NumberedStep>
        </ol>

        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-3">
          <p className="text-sm font-semibold text-on-surface">Webhook Signing Secret</p>
          <div className="flex gap-2">
            <SecretField
              value={stripeWebhookSecret}
              onChange={setStripeWebhookSecret}
              placeholder="whsec_..."
            />
            <Button
              type="button"
              onClick={saveStripeWebhook}
              disabled={stripeWebhookStatus === "saving" || (Boolean(savedStripeWebhookSecret) && stripeWebhookSecret === savedStripeWebhookSecret)}
              className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40"
            >
              {stripeWebhookStatus === "saving" ? "Saving…" : "Save"}
            </Button>
          </div>
          {stripeWebhookStatus === "error" && (
            <p className="text-xs text-destructive">{stripeWebhookError ? `Save failed: ${stripeWebhookError}` : "Failed to save."}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Square panel ───────────────────────────────────────────────────────────
function SquarePanel({
  squareToken, setSquareToken, squareLocation, setSquareLocation,
  squareEnv, setSquareEnv,
  squareCredsSavedHere, saveSquareCreds, squareStatus, squareError, squareConnected,
  squareWebhookKey, setSquareWebhookKey, savedSquareWebhookKey,
  saveSquareWebhook, squareWebhookStatus, squareWebhookError,
  squareWebhookUrl, squareWebhookCopied, setSquareWebhookCopied,
  step2Flash,
}: {
  squareToken: string; setSquareToken: (v: string) => void;
  squareLocation: string; setSquareLocation: (v: string) => void;
  squareEnv: "production" | "sandbox"; setSquareEnv: (v: "production" | "sandbox") => void;
  squareCredsSavedHere: boolean; saveSquareCreds: () => void;
  squareStatus: SaveStatus; squareError: string | null; squareConnected: boolean;
  squareWebhookKey: string; setSquareWebhookKey: (v: string) => void; savedSquareWebhookKey: string;
  saveSquareWebhook: () => void;
  squareWebhookStatus: SaveStatus; squareWebhookError: string | null;
  squareWebhookUrl: string; squareWebhookCopied: boolean;
  setSquareWebhookCopied: (v: boolean) => void;
  step2Flash: boolean;
}) {
  const copyUrl = () => {
    navigator.clipboard.writeText(squareWebhookUrl).then(() => {
      setSquareWebhookCopied(true);
      setTimeout(() => setSquareWebhookCopied(false), 2000);
    });
  };

  return (
    <div>
      {/* Step 1 — Access token + Location */}
      <div className="bg-surface-container-lowest p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${squareConnected ? "bg-emerald-100 text-emerald-700" : "bg-surface-container border border-outline-variant/30 text-on-surface-variant"}`}>
            {squareConnected ? "✓" : "1"}
          </span>
          <p className="text-base font-semibold text-on-surface">Square Access Token & Location</p>
        </div>
        <div className="text-sm text-on-surface-variant space-y-2 leading-relaxed">
          <p>Generate Square Checkout payment links directly from bookings.</p>
          <p>When a client pays, the deposit is automatically marked as paid and the booking moves forward on its own.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-on-surface-variant">Access Token</label>
          <SecretField value={squareToken} onChange={setSquareToken} placeholder="EAAAEm…" />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-on-surface-variant">Location ID</label>
          <Input
            type="text"
            value={squareLocation}
            onChange={(e) => setSquareLocation(e.target.value)}
            placeholder="L1A2B3C4D5"
            className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-on-surface-variant">Environment</label>
          <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/20">
            {(["production", "sandbox"] as const).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setSquareEnv(env)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  squareEnv === env
                    ? "bg-surface text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {env}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={saveSquareCreds}
            disabled={squareStatus === "saving" || squareCredsSavedHere || !squareToken.trim() || !squareLocation.trim()}
            className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40"
          >
            {squareStatus === "saving" ? "Saving…" : squareCredsSavedHere ? "Saved" : "Save"}
          </Button>
        </div>
        {squareStatus === "error" && (
          <p className="text-xs text-destructive">{squareError ? `Save failed: ${squareError}` : "Failed to save."}</p>
        )}
        {!squareConnected && <HowToGuide steps={SQUARE_STEPS} defaultOpen />}
      </div>

      <div className="border-t border-outline-variant/15" />

      {/* Step 2 — Webhook */}
      <div className={`p-5 space-y-4 transition-all duration-700 ${squareConnected ? "" : "opacity-40 pointer-events-none select-none"} ${step2Flash ? "bg-indigo-50/50" : ""}`}>
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
            savedSquareWebhookKey
              ? "bg-emerald-100 text-emerald-700"
              : step2Flash
                ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300 scale-110"
                : "bg-surface-container border border-outline-variant/30 text-on-surface-variant"
          }`}>
            {savedSquareWebhookKey ? "✓" : "2"}
          </span>
          <p className="text-sm font-semibold text-on-surface">Square Webhook</p>
          {step2Flash && !savedSquareWebhookKey && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 animate-pulse">
              Do this next
            </span>
          )}
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed">
          Add this URL to Square so FlashBooker automatically marks deposits as paid when clients pay.
        </p>
        <ol className="space-y-2.5 pl-0 list-none">
          <NumberedStep n={1}>
            In the{" "}
            <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
              Square Developer Console
            </a>, open your application and make sure the environment toggle at the top is set to <span className="font-medium text-on-surface">Production</span>.
          </NumberedStep>
          <NumberedStep n={2}>
            In the left sidebar, under <span className="font-medium text-on-surface">Webhooks</span>, click <span className="font-medium text-on-surface">Subscriptions</span>, then click <span className="font-medium text-on-surface">Add subscription</span>.
          </NumberedStep>
          <NumberedStep n={3}>
            Enter any name (e.g., &quot;FlashBooker Deposits&quot;) and set the <span className="font-medium text-on-surface">Notification URL</span> to:
          </NumberedStep>
        </ol>
        <UrlBox url={squareWebhookUrl} copied={squareWebhookCopied} onCopy={copyUrl} />
        <ol className="space-y-2.5 pl-0 list-none" start={4}>
          <NumberedStep n={4}>
            Choose the latest API version, then check the events <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded font-mono">payment.created</code> and <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded font-mono">payment.updated</code>. Click <span className="font-medium text-on-surface">Save</span>.
          </NumberedStep>
          <NumberedStep n={5}>
            Open the subscription and copy the <span className="font-medium text-on-surface">Signature Key</span>. Paste it below.
          </NumberedStep>
        </ol>

        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-3">
          <p className="text-sm font-semibold text-on-surface">Webhook Signature Key</p>
          <div className="flex gap-2">
            <SecretField
              value={squareWebhookKey}
              onChange={setSquareWebhookKey}
              placeholder="webhook signing key"
            />
            <Button
              type="button"
              onClick={saveSquareWebhook}
              disabled={squareWebhookStatus === "saving" || (Boolean(savedSquareWebhookKey) && squareWebhookKey === savedSquareWebhookKey)}
              className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity shrink-0 disabled:opacity-40"
            >
              {squareWebhookStatus === "saving" ? "Saving…" : "Save"}
            </Button>
          </div>
          {squareWebhookStatus === "error" && (
            <p className="text-xs text-destructive">{squareWebhookError ? `Save failed: ${squareWebhookError}` : "Failed to save."}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NumberedStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-on-surface-variant">
      <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{n}</span>
      <span className="leading-relaxed pt-0.5">{children}</span>
    </li>
  );
}

function UrlBox({ url, copied, onCopy }: { url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="ml-8 space-y-2">
      <div className="flex items-center gap-2 rounded-lg bg-surface-container-high/60 border border-outline-variant/20 px-3 py-2">
        <p className="flex-1 text-xs font-mono text-on-surface-variant truncate">{url}</p>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 p-1 rounded text-on-surface-variant hover:text-on-surface transition-colors"
          title="Copy URL"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

