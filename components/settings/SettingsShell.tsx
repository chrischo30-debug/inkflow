"use client";

import { useState } from "react";
import { User, Link2, Columns3, Mail, ExternalLink } from "lucide-react";
import { AccountSettings } from "./AccountSettings";
import { ThemeSettings } from "./ThemeSettings";
import { GoogleIntegrationSettings } from "./GoogleIntegrationSettings";
import { PaymentSettings } from "./PaymentSettings";
import { CalendarLinksSettings } from "./CalendarLinksSettings";
import { PipelineSettings } from "./PipelineSettings";
import { EmailTemplatesSettings } from "./EmailTemplatesSettings";
import { ExternalApiSettings } from "./ExternalApiSettings";
import type { PipelineSettings as PipelineSettingsType, CalendarLink, PaymentLink } from "@/lib/pipeline-settings";

const TABS = [
  { id: "profile",      label: "Profile",      icon: User },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "pipeline",     label: "Pipeline",     icon: Columns3 },
  { id: "emails",       label: "Emails",       icon: Mail },
] as const;

type TabId = typeof TABS[number]["id"];

export interface SettingsShellProps {
  slug: string;
  artistName: string;
  studioName: string;
  email: string;
  accentTheme: "crimson" | "blue";
  googleConfigured: boolean;
  hasRefreshToken: boolean;
  isCalendarConnected: boolean;
  isGmailConnected: boolean;
  gmailAddress: string;
  paymentLinks: PaymentLink[];
  calendarLinks: CalendarLink[];
  pipelineSettings: PipelineSettingsType;
  stripeApiKey: string;
  calcomApiKey: string;
}

export function SettingsShell(props: SettingsShellProps) {
  const [tab, setTab] = useState<TabId>("profile");

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl shrink-0">
        <h1 className="text-xl font-heading font-semibold text-on-surface">Settings</h1>
        {props.slug && (
          <a
            href={`/${props.slug}/book`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity"
          >
            <ExternalLink className="w-4 h-4" />
            View Live Form
          </a>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <nav className="w-52 shrink-0 border-r border-outline-variant/10 py-6 px-3 flex flex-col gap-1.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium transition-colors text-left ${
                tab === id
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          {tab === "profile" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading title="Profile" description="Your public identity and booking page URL." />
              <ThemeSettings initialTheme={props.accentTheme} />
              <AccountSettings
                initialValues={{
                  name: props.artistName,
                  slug: props.slug,
                  studio_name: props.studioName,
                  email: props.email,
                }}
              />
            </div>
          )}

          {tab === "integrations" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading title="Integrations" description="Connect external services for email, calendar, and payments." />
              <GoogleIntegrationSettings
                googleConfigured={props.googleConfigured}
                hasRefreshToken={props.hasRefreshToken}
                isCalendarConnected={props.isCalendarConnected}
                isGmailConnected={props.isGmailConnected}
                gmailAddress={props.gmailAddress}
              />
              <PaymentSettings initialLinks={props.paymentLinks} />
              <CalendarLinksSettings initialLinks={props.calendarLinks} />
              <ExternalApiSettings initialStripeKey={props.stripeApiKey} initialCalcomKey={props.calcomApiKey} />
            </div>
          )}

          {tab === "pipeline" && (
            <div className="max-w-3xl space-y-6">
              <SectionHeading title="Pipeline" description="Customize what shows on booking cards and how your workflow stages are named and sequenced." />
              <PipelineSettings
                initialSettings={props.pipelineSettings}
              />
            </div>
          )}

          {tab === "emails" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading title="Email Templates" description="Customize messages sent at each stage. Toggle auto-send to control whether emails go out automatically." />
              <EmailTemplatesSettings />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-lg font-heading font-semibold text-on-surface">{title}</h2>
      <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>
    </div>
  );
}
