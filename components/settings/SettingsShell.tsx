"use client";

import { useState } from "react";
import { User, Link2, Mail, Bell, BookOpen, ExternalLink } from "lucide-react";
import { AccountSettings } from "./AccountSettings";
import { ThemeSettings } from "./ThemeSettings";
import { GoogleIntegrationSettings } from "./GoogleIntegrationSettings";
import { EmailTemplatesSettings } from "./EmailTemplatesSettings";
import { ExternalApiSettings } from "./ExternalApiSettings";
import { ReminderSettings } from "./ReminderSettings";
import { BooksSettings } from "./BooksSettings";
import type { CalendarLink, PaymentLink } from "@/lib/pipeline-settings";
// CalendarLink/PaymentLink still used by SettingsShellProps (passed in from page but no longer rendered here)

const TABS = [
  { id: "profile",      label: "Profile",      icon: User },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "emails",       label: "Emails",       icon: Mail },
  { id: "reminders",    label: "Reminders",    icon: Bell },
  { id: "books",        label: "Books",        icon: BookOpen },
] as const;

type TabId = typeof TABS[number]["id"];

export interface SettingsShellProps {
  artistId: string;
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
  stripeApiKey: string;
  stripeWebhookSecret: string;
  calcomApiKey: string;
  kitApiKey: string;
  kitFormId: string;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  booksOpen: boolean;
  booksClosedMessage: string;
  booksOpenAt: string;
  booksCloseAt: string;
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
              <SectionHeading title="Integrations" description="Connect external services for email and calendar sync." />
              <GoogleIntegrationSettings
                googleConfigured={props.googleConfigured}
                hasRefreshToken={props.hasRefreshToken}
                isCalendarConnected={props.isCalendarConnected}
                isGmailConnected={props.isGmailConnected}
                gmailAddress={props.gmailAddress}
              />
              <ExternalApiSettings
                initialStripeKey={props.stripeApiKey}
                initialStripeWebhookSecret={props.stripeWebhookSecret}
                initialCalcomKey={props.calcomApiKey}
                initialKitApiKey={props.kitApiKey}
                initialKitFormId={props.kitFormId}
                artistId={props.artistId}
              />
            </div>
          )}

          {tab === "emails" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading title="Email Templates" description="Customize messages sent at each stage. Toggle auto-send to control whether emails go out automatically." />
              <EmailTemplatesSettings />
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

          {tab === "books" && (
            <div className="max-w-2xl space-y-6">
              <SectionHeading title="Books Open / Closed" description="Control whether your booking form accepts new inquiries, and optionally schedule a drop window." />
              <BooksSettings
                initialOpen={props.booksOpen}
                initialClosedMessage={props.booksClosedMessage}
                initialOpenAt={props.booksOpenAt}
                initialCloseAt={props.booksCloseAt}
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
