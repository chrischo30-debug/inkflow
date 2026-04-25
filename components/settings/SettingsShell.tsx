"use client";

import { useState } from "react";
import { User, Link2, Mail, Bell } from "lucide-react";
import { AccountSettings } from "./AccountSettings";
import { ThemeSettings } from "./ThemeSettings";
import { GoogleIntegrationSettings } from "./GoogleIntegrationSettings";
import { EmailTemplatesSettings } from "./EmailTemplatesSettings";
import { ExternalApiSettings } from "./ExternalApiSettings";
import { ReminderSettings } from "./ReminderSettings";
import type { CalendarLink, PaymentLink, SchedulingLink } from "@/lib/pipeline-settings";

const TABS = [
  { id: "profile",      label: "Profile",      icon: User },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "emails",       label: "Emails",       icon: Mail },
  { id: "reminders",    label: "Reminders",    icon: Bell },
] as const;

export type TabId = typeof TABS[number]["id"];

export interface SettingsShellProps {
  artistId: string;
  slug: string;
  artistName: string;
  studioName: string;
  email: string;
  gmailAddress: string;
  accentTheme: "crimson" | "blue";
  googleConfigured: boolean;
  hasRefreshToken: boolean;
  isCalendarConnected: boolean;
  paymentLinks: PaymentLink[];
  calendarLinks: CalendarLink[];
  stripeApiKey: string;
  stripeWebhookSecret: string;
  schedulingLinks: SchedulingLink[];
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  initialTab?: TabId;
}

export function SettingsShell(props: SettingsShellProps) {
  const [tab, setTab] = useState<TabId>(props.initialTab ?? "profile");

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 flex items-center px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl shrink-0">
        <h1 className="text-xl font-heading font-semibold text-on-surface">Settings</h1>
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
                  gmail_address: props.gmailAddress,
                }}
              />
            </div>
          )}

          {tab === "integrations" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading title="Integrations" description="Connect external services for calendar sync and payments." />
              <GoogleIntegrationSettings
                googleConfigured={props.googleConfigured}
                hasRefreshToken={props.hasRefreshToken}
                isCalendarConnected={props.isCalendarConnected}
              />
              <ExternalApiSettings
                initialStripeKey={props.stripeApiKey}
                initialStripeWebhookSecret={props.stripeWebhookSecret}
                artistId={props.artistId}
              />

            </div>
          )}

          {tab === "emails" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading title="Email Templates" description="Customize messages sent at each stage. Toggle auto-send to control whether emails go out automatically." />
              <EmailTemplatesSettings
                paymentLinks={props.paymentLinks}
                calendarLinks={props.calendarLinks}
                artistName={props.artistName}
              />
            </div>
          )}

          {tab === "reminders" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading title="Appointment Reminders" description="Send clients an automatic reminder email before their appointment." />
              <ReminderSettings
                initialEnabled={props.reminderEnabled}
                initialHoursBefore={props.reminderHoursBefore}
              />
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
