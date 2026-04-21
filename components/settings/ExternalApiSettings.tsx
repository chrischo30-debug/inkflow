"use client";

import { useState } from "react";
import { Check, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SaveStatus = "idle" | "saving" | "success" | "error";

function ApiKeyField({
  label,
  description,
  value,
  onChange,
  placeholder,
  signupUrl,
  signupLabel,
  onSave,
  status,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  signupUrl: string;
  signupLabel: string;
  onSave: () => void;
  status: SaveStatus;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-on-surface">{label}</p>
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
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="pr-10 border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 text-sm focus-visible:ring-0 focus-visible:border-primary shadow-none"
          />
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Button
          type="button"
          onClick={onSave}
          disabled={status === "saving"}
          className="h-auto py-2 px-4 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity shrink-0"
        >
          {status === "saving" ? "Saving…" : status === "success" ? <Check className="w-4 h-4" /> : "Save"}
        </Button>
      </div>
      {status === "error" && <p className="text-xs text-destructive">Failed to save. Check your key and try again.</p>}
    </div>
  );
}

export function ExternalApiSettings({
  initialStripeKey,
  initialCalcomKey,
}: {
  initialStripeKey: string;
  initialCalcomKey: string;
}) {
  const [stripeKey, setStripeKey] = useState(initialStripeKey);
  const [calcomKey, setCalcomKey] = useState(initialCalcomKey);
  const [stripeStatus, setStripeStatus] = useState<SaveStatus>("idle");
  const [calcomStatus, setCalcomStatus] = useState<SaveStatus>("idle");

  const save = async (field: "stripe_api_key" | "calcom_api_key", value: string, setStatus: (s: SaveStatus) => void) => {
    setStatus("saving");
    const res = await fetch("/api/artist/external-keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Payment & Scheduling APIs</p>
      <ApiKeyField
        label="Stripe"
        description="Generate payment links directly from bookings without leaving the dashboard."
        value={stripeKey}
        onChange={setStripeKey}
        placeholder="sk_live_..."
        signupUrl="https://dashboard.stripe.com/register"
        signupLabel="Create Stripe account"
        onSave={() => save("stripe_api_key", stripeKey, setStripeStatus)}
        status={stripeStatus}
      />
      <ApiKeyField
        label="Cal.com"
        description="Create booking links and send calendar invites directly from confirmed appointments."
        value={calcomKey}
        onChange={setCalcomKey}
        placeholder="cal_live_..."
        signupUrl="https://cal.com/signup"
        signupLabel="Create Cal.com account"
        onSave={() => save("calcom_api_key", calcomKey, setCalcomStatus)}
        status={calcomStatus}
      />
    </div>
  );
}
