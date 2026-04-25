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
  studioAddress: string;
  email: string;
  gmailAddress: string;
  emailLogoEnabled: boolean;
  emailLogoBg: "light" | "dark";
  autoEmailsEnabled: boolean;
  hasLogo: boolean;
  logoUrl: string | null;
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
              <SectionHeading
                title="Profile"
                description={[
                  "Your public identity. This is what clients see on your booking page and in emails.",
                  "Set your name, the URL clients land on, and where reply emails go.",
                ]}
              />
              <ThemeSettings initialTheme={props.accentTheme} />
              <AccountSettings
                initialValues={{
                  name: props.artistName,
                  slug: props.slug,
                  studio_name: props.studioName,
                  studio_address: props.studioAddress,
                  email: props.email,
                  gmail_address: props.gmailAddress,
                  email_logo_enabled: props.emailLogoEnabled,
                  email_logo_bg: props.emailLogoBg,
                  has_logo: props.hasLogo,
                  logo_url: props.logoUrl,
                }}
              />
            </div>
          )}

          {tab === "integrations" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading
                title="Integrations"
                description={[
                  "Connect outside tools to automate parts of your workflow.",
                  "Both are optional. You can run FlashBooker without either and still get the full pipeline.",
                ]}
              />
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
              <SectionHeading
                title="Email Templates"
                description={[
                  "Customize the message that goes out at each booking stage.",
                  "Toggle auto-send to control whether emails go out on their own, or only when you click Send.",
                ]}
              />
              <EmailTemplatesSettings
                paymentLinks={props.paymentLinks}
                calendarLinks={props.calendarLinks}
                artistName={props.artistName}
                initialAutoEmailsEnabled={props.autoEmailsEnabled}
              />
            </div>
          )}

          {tab === "reminders" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading
                title="Appointment Reminders"
                description={[
                  "Send clients a reminder email before their appointment.",
                  "Pick how far ahead the reminder goes out. We&rsquo;ll only send for confirmed bookings.",
                ]}
              />
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

function SectionHeading({ title, description }: { title: string; description: string | string[] }) {
  const lines = Array.isArray(description) ? description : [description];
  return (
    <div className="mb-2">
      <h2 className="text-lg font-heading font-semibold text-on-surface">{title}</h2>
      <div className="mt-2 space-y-2">
        {lines.map((line, i) => (
          <p key={i} className="text-base text-on-surface-variant leading-relaxed">{line}</p>
        ))}
      </div>
    </div>
  );
}
