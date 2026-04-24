"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Globe, Mail, ChevronRight, Check } from "lucide-react";

type Method = "flashbooker" | "custom_domain" | "gmail_smtp";

const FLASHBOOKER_DOMAIN = "flashbooker.app";

export function SendingMethodChooser({
  defaultLocalPart,
  defaultDisplayName,
  formAction,
  errorMessage,
}: {
  defaultLocalPart: string;
  defaultDisplayName: string;
  formAction: (fd: FormData) => Promise<void> | void;
  errorMessage?: string;
}) {
  const [selected, setSelected] = useState<Method>("flashbooker");
  const [localPart, setLocalPart] = useState(defaultLocalPart || "bookings");
  const [displayName, setDisplayName] = useState(defaultDisplayName || "");
  const [customDomain, setCustomDomain] = useState("");
  const [customLocal, setCustomLocal] = useState("hello");
  const [gmailEmail, setGmailEmail] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");

  const previewAddress =
    selected === "flashbooker"
      ? `${localPart || "bookings"}@${FLASHBOOKER_DOMAIN}`
      : selected === "custom_domain"
      ? `${customLocal || "hello"}@${customDomain || "yourdomain.com"}`
      : gmailEmail || "youraddress@gmail.com";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="method" value={selected} />

      {/* Cards */}
      <div className="flex flex-col gap-3">
        <OptionCard
          method="flashbooker"
          selected={selected}
          onSelect={() => setSelected("flashbooker")}
          icon={Sparkles}
          title="FlashBooker address"
          badge="Recommended"
          blurb="Ready in seconds. No setup, no DNS. We send from an address on our domain."
          preview={`${localPart || "bookings"}@${FLASHBOOKER_DOMAIN}`}
        >
          {selected === "flashbooker" && (
            <div className="mt-4 flex flex-col gap-3 p-4 rounded-xl bg-surface-container-low">
              <div>
                <Label className="text-xs uppercase tracking-wide text-on-surface-variant">Local part</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={localPart}
                    onChange={(e) => setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                    className="max-w-[160px] rounded-lg"
                  />
                  <span className="text-sm text-on-surface-variant">@{FLASHBOOKER_DOMAIN}</span>
                </div>
                <input type="hidden" name="local_part" value={localPart} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-on-surface-variant">Display name</Label>
                <Input
                  name="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Doe Tattoos"
                  className="mt-1 rounded-lg"
                />
              </div>
              <p className="text-xs text-on-surface-variant/70">
                Clients will see <strong>{displayName || "Your Name"} &lt;{localPart || "bookings"}@{FLASHBOOKER_DOMAIN}&gt;</strong>
              </p>
            </div>
          )}
        </OptionCard>

        <OptionCard
          method="custom_domain"
          selected={selected}
          onSelect={() => setSelected("custom_domain")}
          icon={Globe}
          title="Your own domain"
          tag="Pro"
          blurb="Send from hello@yourstudio.com. Requires ~10 minutes to add DNS records."
          preview={`${customLocal || "hello"}@${customDomain || "yourstudio.com"}`}
        >
          {selected === "custom_domain" && (
            <div className="mt-4 flex flex-col gap-3 p-4 rounded-xl bg-surface-container-low">
              <div>
                <Label className="text-xs uppercase tracking-wide text-on-surface-variant">Your domain</Label>
                <Input
                  name="custom_domain"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""))}
                  placeholder="yourstudio.com"
                  className="mt-1 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-on-surface-variant">Send mail as</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    name="custom_local_part"
                    value={customLocal}
                    onChange={(e) => setCustomLocal(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                    className="max-w-[160px] rounded-lg"
                  />
                  <span className="text-sm text-on-surface-variant">@{customDomain || "yourdomain.com"}</span>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                We&apos;ll save your domain now. You&apos;ll finish verification in{" "}
                <strong>Settings → Email</strong>, where you&apos;ll paste a few DNS records
                into your domain registrar. Until verified, we&apos;ll send from{" "}
                <code className="font-mono text-[11px] bg-surface-container-high px-1 py-0.5 rounded">
                  {localPart || "bookings"}@{FLASHBOOKER_DOMAIN}
                </code>{" "}
                so your bookings keep working.
              </p>
            </div>
          )}
        </OptionCard>

        <OptionCard
          method="gmail_smtp"
          selected={selected}
          onSelect={() => setSelected("gmail_smtp")}
          icon={Mail}
          title="Your Gmail address"
          tag="Classic"
          blurb="Keep sending from your Gmail. Requires 2-factor auth + a Gmail App Password."
          preview={gmailEmail || "you@gmail.com"}
        >
          {selected === "gmail_smtp" && (
            <div className="mt-4 flex flex-col gap-3 p-4 rounded-xl bg-surface-container-low">
              <div>
                <Label className="text-xs uppercase tracking-wide text-on-surface-variant">Your Gmail address</Label>
                <Input
                  name="gmail_email"
                  type="email"
                  value={gmailEmail}
                  onChange={(e) => setGmailEmail(e.target.value)}
                  placeholder="janedoe@gmail.com"
                  className="mt-1 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-on-surface-variant">Gmail App Password</Label>
                <Input
                  name="gmail_app_password"
                  type="password"
                  value={gmailAppPassword}
                  onChange={(e) => setGmailAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="mt-1 rounded-lg font-mono"
                />
                <p className="text-xs text-on-surface-variant/70 mt-2 leading-relaxed">
                  Need one? Turn on 2-factor auth on your Google account, then visit{" "}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    myaccount.google.com/apppasswords
                  </a>{" "}
                  to generate a 16-character app password. Paste it above (spaces are fine).
                </p>
              </div>
              <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                Sent mail will appear in your Gmail Sent folder like normal. Replies route
                to FlashBooker so you can manage them from the dashboard.
              </p>
            </div>
          )}
        </OptionCard>
      </div>

      {/* Preview strip */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container border border-outline-variant/20">
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Preview</span>
        <span className="flex-1 text-sm font-mono text-on-surface truncate">{previewAddress}</span>
      </div>

      {errorMessage && (
        <p className="text-sm text-error px-1">{errorMessage}</p>
      )}

      <Button type="submit" className="w-full h-auto py-3 text-sm rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity mt-2">
        Continue <ChevronRight className="w-4 h-4 ml-1" />
      </Button>

      <p className="text-xs text-center text-on-surface-variant/70">
        You can change this any time in Settings.
      </p>
    </form>
  );
}

function OptionCard({
  method,
  selected,
  onSelect,
  icon: Icon,
  title,
  badge,
  tag,
  blurb,
  preview,
  children,
}: {
  method: Method;
  selected: Method;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  tag?: string;
  blurb: string;
  preview: string;
  children?: React.ReactNode;
}) {
  const isSelected = selected === method;
  const isRecommended = !!badge;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-2xl border p-5 transition-all ${
        isSelected
          ? isRecommended
            ? "border-primary bg-primary/[0.04] shadow-sm ring-2 ring-primary/20"
            : "border-on-surface bg-surface-container-low shadow-sm"
          : "border-outline-variant/20 bg-surface hover:bg-surface-container-low hover:border-outline-variant/40"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isSelected ? "bg-on-surface text-surface" : "bg-surface-container text-on-surface-variant"
        }`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-on-surface">{title}</p>
            {badge && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary text-on-primary">
                {badge}
              </span>
            )}
            {tag && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                {tag}
              </span>
            )}
            {isSelected && <Check className="w-4 h-4 text-primary ml-auto" />}
          </div>
          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{blurb}</p>
          <p className="text-xs font-mono text-on-surface-variant/70 mt-2 truncate">{preview}</p>
        </div>
      </div>
      {children}
    </button>
  );
}
