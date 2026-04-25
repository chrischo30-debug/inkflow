import { Resend } from 'resend';
import { BookingState, EmailTemplate } from './types';
import type { CalendarLink, PaymentLink } from './pipeline-settings';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

const SENDING_DOMAIN = process.env.FLASHBOOKER_SENDING_DOMAIN || 'flashbooker.app';
const SENDING_LOCAL = process.env.FLASHBOOKER_SENDING_LOCAL || 'bookings';
const APP_NAME = 'FlashBooker';

export const DEFAULT_EMAIL_TEMPLATES: Record<Exclude<BookingState, 'cancelled'>, { subject: string; body: string }> = {
  inquiry: {
    subject: `Submission Received – {artistName}`,
    body: `Hi {clientFirstName},\n\nWe received your submission. {artistName} is reviewing it and will get back to you shortly.\n\nThanks,\n{artistName}`,
  },
  follow_up: {
    subject: `Following up on your tattoo request – {artistName}`,
    body: `Hi {clientFirstName},\n\nThank you for reaching out! I had a few questions about your tattoo idea before moving forward:\n\n✏️ REPLACE THIS: Add your questions here\n\nLooking forward to hearing from you!\n\nThanks,\n{artistName}`,
  },
  accepted: {
    subject: `You're in! Next steps from {artistName}`,
    body: `Hi {clientFirstName},\n\nGreat news — {artistName} would love to work with you!\n\nTo secure your spot, please send your deposit:\n{paymentLink}\n\nOnce your deposit is received, use this link to book your appointment time:\n{calendarLink}\n\nThanks,\n{artistName}`,
  },
  confirmed: {
    subject: `Appointment Booked – {artistName}`,
    body: `Hi {clientFirstName},\n\nYou're locked in! See you on {appointmentDate}.\n\nThanks,\n{artistName}`,
  },
  completed: {
    subject: `Thanks for coming in – {artistName}`,
    body: `Hi {clientFirstName},\n\nIt was a pleasure working with you. Take care of your new tattoo!\n\nThanks,\n{artistName}`,
  },
  rejected: {
    subject: `Update on your tattoo request – {artistName}`,
    body: `Hi {clientFirstName},\n\nThank you so much for your interest. Unfortunately, I'm unable to take on this project at this time.\n\nI hope you find the perfect artist for your vision!\n\nThanks,\n{artistName}`,
  },
};

export interface TemplateVars {
  clientFirstName: string;
  clientName: string;       // kept for backwards compat with existing saved templates
  artistName: string;
  paymentLink: string;      // primary payment link URL (or empty)
  calendarLink: string;     // first calendar link URL (or empty)
  appointmentDate: string;
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
    paymentLinksList: opts.paymentLinksList,
    calendarLinksList: opts.calendarLinksList,
  };
}

function findLinkByLabel(links: { label: string; url: string }[], label: string): string | null {
  const target = label.trim().toLowerCase();
  return links.find((l) => l.label.trim().toLowerCase() === target)?.url ?? null;
}

export function applyPlaceholders(template: string, vars: TemplateVars): string {
  return template
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
    .replace(/\{appointmentDate\}/g, vars.appointmentDate);
}

function buildFromHeader(artistName: string): string {
  const cleanedName = (artistName || 'Your Artist').replace(/"/g, '').trim();
  return `${cleanedName} via ${APP_NAME} <${SENDING_LOCAL}@${SENDING_DOMAIN}>`;
}

interface SendEmailPayload {
  toEmail: string;
  vars: TemplateVars;
  template: { subject: string; body: string };
  artistReplyTo?: string | null;
}

interface SendEmailResult {
  subject?: string;
  providerMessageId?: string;
}

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { toEmail, vars, template, artistReplyTo } = payload;

  const subject = applyPlaceholders(template.subject, vars);
  const text = applyPlaceholders(template.body, vars);
  const from = buildFromHeader(vars.artistName);

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
  });
}
