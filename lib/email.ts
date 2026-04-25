import { Resend } from 'resend';
import { BookingState, EmailTemplate } from './types';
import type { CalendarLink, PaymentLink } from './pipeline-settings';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

const SENDING_DOMAIN = process.env.FLASHBOOKER_SENDING_DOMAIN || 'flashbooker.app';
const SENDING_LOCAL = process.env.FLASHBOOKER_SENDING_LOCAL || 'bookings';
const APP_NAME = 'FlashBooker';

export const DEFAULT_EMAIL_TEMPLATES: Record<Exclude<BookingState, 'cancelled'>, { subject: string; body: string }> = {
  inquiry: {
    subject: `Got your submission`,
    body: `Hi {clientFirstName},\n\nGot your submission. I'll take a look and get back to you soon.\n\n{artistName}`,
  },
  follow_up: {
    subject: `Quick question about your tattoo idea`,
    body: `Hi {clientFirstName},\n\nThanks for sending this over. Before I can quote it, a few quick questions:\n\nREPLACE THIS with your questions\n\nReply whenever you can.\n\n{artistName}`,
  },
  accepted: {
    subject: `Ready to book`,
    body: `Hi {clientFirstName},\n\nI'd like to do this one. To save your spot, send the deposit here:\n{paymentLink}\n\nOnce that's in I'll send a link to pick your appointment time.\n\n{artistName}`,
  },
  sent_deposit: {
    subject: `Deposit reminder`,
    body: `Hi {clientFirstName},\n\nQuick reminder to send the deposit so I can lock in your spot:\n{paymentLink}\n\n{artistName}`,
  },
  sent_calendar: {
    subject: `Pick your appointment time`,
    body: `Hi {clientFirstName},\n\nDeposit is in, thanks. Pick a time that works for you:\n{schedulingLink}\n\n{artistName}`,
  },
  booked: {
    subject: `You're booked`,
    body: `Hi {clientFirstName},\n\nYou're booked for {appointmentDate}. See you then.\n\n{artistName}`,
  },
  confirmed: {
    subject: `You're booked`,
    body: `Hi {clientFirstName},\n\nYou're booked for {appointmentDate}. See you then.\n\n{artistName}`,
  },
  completed: {
    subject: `Thanks for coming in`,
    body: `Hi {clientFirstName},\n\nThanks for coming in today. Take care of the tattoo and let me know if anything looks off during the heal.\n\n{artistName}`,
  },
  rejected: {
    subject: `About your tattoo request`,
    body: `Hi {clientFirstName},\n\nThanks for reaching out. I'm not able to take this one on, but I appreciate you considering me. Good luck with the project.\n\n{artistName}`,
  },
};

export interface TemplateVars {
  clientFirstName: string;
  clientName: string;       // kept for backwards compat with existing saved templates
  artistName: string;
  paymentLink: string;      // primary payment link URL (or empty)
  calendarLink: string;     // first calendar link URL (or empty)
  appointmentDate: string;
  stripePaymentLink: string; // Stripe-generated payment link for this booking (or empty)
  // Full link lists used by the {paymentLink:Label} and {calendarLink:Label}
  // placeholder resolver. Not meant to be inserted as a single token.
  paymentLinksList: PaymentLink[];
  calendarLinksList: CalendarLink[];
}

export function buildTemplateVars(opts: {
  clientName: string;
  artistName: string;
  paymentLinksList: PaymentLink[];
  calendarLinksList: CalendarLink[];
  appointmentDate?: string;
  primaryPaymentLink?: string;
  stripePaymentLink?: string;
}): TemplateVars {
  const paymentLink = opts.primaryPaymentLink || opts.paymentLinksList[0]?.url || '';
  const calendarLink = opts.calendarLinksList[0]?.url || '';

  return {
    clientFirstName: opts.clientName.split(' ')[0],
    clientName: opts.clientName,
    artistName: opts.artistName,
    paymentLink,
    calendarLink,
    appointmentDate: opts.appointmentDate ?? '',
    stripePaymentLink: opts.stripePaymentLink ?? '',
    paymentLinksList: opts.paymentLinksList,
    calendarLinksList: opts.calendarLinksList,
  };
}

function findLinkByLabel(links: { label: string; url: string }[], label: string): string | null {
  const target = label.trim().toLowerCase();
  return links.find((l) => l.label.trim().toLowerCase() === target)?.url ?? null;
}

// Strip lines whose placeholders would resolve to empty strings — keeps blank
// values from rendering as awkward sentences ("See you on .") in client emails.
function stripLinesWithEmptyPlaceholders(template: string, vars: TemplateVars): string {
  const empty: string[] = [];
  if (!vars.paymentLink) empty.push("paymentLink");
  if (!vars.calendarLink) empty.push("calendarLink");
  if (!vars.appointmentDate) empty.push("appointmentDate");
  if (!vars.stripePaymentLink) empty.push("stripePaymentLink");
  if (empty.length === 0) return template;

  return template
    .split("\n")
    .filter(line => {
      for (const key of empty) {
        if (line.includes(`{${key}}`)) return false;
        // Labeled variants: {paymentLink:Foo} / {calendarLink:Foo}
        if ((key === "paymentLink" || key === "calendarLink") && line.includes(`{${key}:`)) {
          // Only drop if the label-resolved url is also empty — handled by the
          // resolver's own fallback; here we conservatively keep the line and
          // let the resolver fall through to the (empty) default.
          // To avoid leaking an empty url, drop the line in that case too:
          return false;
        }
      }
      return true;
    })
    .join("\n");
}

export function applyPlaceholders(template: string, vars: TemplateVars): string {
  const cleaned = stripLinesWithEmptyPlaceholders(template, vars);
  return cleaned
    // Labeled link variables: {paymentLink:Label} / {calendarLink:Label}
    .replace(/\{paymentLink:([^}]+)\}/g, (_match, rawLabel: string) => {
      return findLinkByLabel(vars.paymentLinksList, rawLabel) ?? vars.paymentLink;
    })
    .replace(/\{calendarLink:([^}]+)\}/g, (_match, rawLabel: string) => {
      return findLinkByLabel(vars.calendarLinksList, rawLabel) ?? vars.calendarLink;
    })
    .replace(/\{clientFirstName\}/g, vars.clientFirstName)
    .replace(/\{clientName\}/g, vars.clientName)
    .replace(/\{artistName\}/g, vars.artistName)
    .replace(/\{paymentLink\}/g, vars.paymentLink)
    .replace(/\{calendarLink\}/g, vars.calendarLink)
    .replace(/\{appointmentDate\}/g, vars.appointmentDate)
    .replace(/\{stripePaymentLink\}/g, vars.stripePaymentLink);
}

function buildFromHeader(artistName: string): string {
  const cleanedName = (artistName || 'Your Artist').replace(/"/g, '').trim();
  return `${cleanedName} via ${APP_NAME} <${SENDING_LOCAL}@${SENDING_DOMAIN}>`;
}

export interface EmailBranding {
  logoUrl?: string | null;
  logoEnabled?: boolean;
  logoBg?: "light" | "dark";
}

interface SendEmailPayload {
  toEmail: string;
  vars: TemplateVars;
  template: { subject: string; body: string };
  artistReplyTo?: string | null;
  branding?: EmailBranding;
}

interface SendEmailResult {
  subject?: string;
  providerMessageId?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Convert a plain-text body into safe HTML: escape, then linkify URLs and
// preserve line breaks. Used for the HTML version when a logo header is shown.
function textToHtmlBody(text: string): string {
  const escaped = escapeHtml(text);
  const linkified = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#2563eb;text-decoration:underline;word-break:break-all">$1</a>',
  );
  return linkified.replace(/\n/g, '<br>');
}

function buildHtmlEmail(bodyText: string, branding?: EmailBranding): string {
  const showLogo = Boolean(branding?.logoEnabled && branding?.logoUrl);
  const isDark = branding?.logoBg === "dark";
  const headerBg = isDark ? "#111111" : "#ffffff";
  const headerBorder = isDark ? "#111111" : "#f3f4f6";
  const logoBlock = showLogo
    ? `<tr><td align="center" style="background:${headerBg};border-top-left-radius:12px;border-top-right-radius:12px;border-bottom:1px solid ${headerBorder};padding:24px 16px"><img src="${escapeHtml(
        branding!.logoUrl!,
      )}" alt="" style="max-height:64px;max-width:200px;height:auto;width:auto;display:block" /></td></tr>`
    : '';
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
${logoBlock}
<tr><td style="padding:24px 32px 32px;color:#111827;font-size:15px;line-height:1.6">${textToHtmlBody(bodyText)}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { toEmail, vars, template, artistReplyTo, branding } = payload;

  const subject = applyPlaceholders(template.subject, vars);
  const text = applyPlaceholders(template.body, vars);
  const from = buildFromHeader(vars.artistName);
  const html = buildHtmlEmail(text, branding);

  if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
    console.log('[MOCK EMAIL SENT]', { from, to: toEmail, subject, replyTo: artistReplyTo, text });
    return { subject };
  }

  try {
    const result = await resend.emails.send({
      from,
      to: [toEmail],
      subject,
      text,
      html,
      ...(artistReplyTo ? { replyTo: artistReplyTo } : {}),
    });
    return { subject, providerMessageId: result.data?.id };
  } catch (error) {
    console.error('Failed to send email via Resend:', error);
    return { subject };
  }
}

// Legacy wrapper used by auto-send on state transitions
export async function sendStateTransitionEmail(payload: {
  toEmail: string;
  clientName: string;
  artistName: string;
  newState: BookingState;
  paymentLinksList: PaymentLink[];
  calendarLinksList: CalendarLink[];
  primaryPaymentLink?: string;
  appointmentDate?: string;
  template?: EmailTemplate | null;
  artistReplyTo?: string | null;
  branding?: EmailBranding;
}): Promise<SendEmailResult> {
  const { newState } = payload;
  if (newState === 'cancelled') return {};

  const defaults = DEFAULT_EMAIL_TEMPLATES[newState as Exclude<BookingState, 'cancelled'>];
  if (!defaults) return {}; // no template for this state

  const vars = buildTemplateVars({
    clientName: payload.clientName,
    artistName: payload.artistName,
    paymentLinksList: payload.paymentLinksList,
    calendarLinksList: payload.calendarLinksList,
    primaryPaymentLink: payload.primaryPaymentLink,
    appointmentDate: payload.appointmentDate,
  });

  return sendEmail({
    toEmail: payload.toEmail,
    vars,
    template: payload.template
      ? { subject: payload.template.subject, body: payload.template.body }
      : defaults,
    artistReplyTo: payload.artistReplyTo,
    branding: payload.branding,
  });
}
