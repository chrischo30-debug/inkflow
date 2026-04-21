import { Resend } from 'resend';
import { BookingState, EmailTemplate } from './types';
import { sendViaGmail } from './gmail';
import type { CalendarLink, PaymentLink } from './pipeline-settings';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

export const DEFAULT_EMAIL_TEMPLATES: Record<Exclude<BookingState, 'cancelled'>, { subject: string; body: string }> = {
  inquiry: {
    subject: `Inquiry Received – {artistName}`,
    body: `Hi {clientName},\n\nWe received your inquiry. {artistName} is reviewing it and will get back to you shortly.\n\nThanks,\n{artistName}`,
  },
  reviewed: {
    subject: `Good news! Your inquiry was reviewed – {artistName}`,
    body: `Hi {clientName},\n\nYour tattoo idea looks great! {artistName} has reviewed your inquiry. Please wait for official deposit instructions shortly.\n\nThanks,\n{artistName}`,
  },
  deposit_sent: {
    subject: `Action Required: Deposit for {artistName}`,
    body: `Hi {clientName},\n\nYour booking requires a deposit to hold your spot.\n\n{paymentLinks}\n\nThanks,\n{artistName}`,
  },
  deposit_paid: {
    subject: `Deposit Received – {artistName}`,
    body: `Hi {clientName},\n\nYour deposit was received. We're moving your booking to confirmed!\n\nThanks,\n{artistName}`,
  },
  confirmed: {
    subject: `Appointment Confirmed – {artistName}`,
    body: `Hi {clientName},\n\nYou're locked in!\n\n{calendarLinks}\n\nThanks,\n{artistName}`,
  },
  completed: {
    subject: `Thanks for coming in – {artistName}`,
    body: `Hi {clientName},\n\nIt was a pleasure working with you. Take care of your new tattoo!\n\nThanks,\n{artistName}`,
  },
};

export interface TemplateVars {
  clientName: string;
  artistName: string;
  paymentLink: string;    // first payment link URL (or empty)
  paymentLinks: string;   // all payment links formatted as labeled list
  calendarLink: string;   // first calendar link URL (or empty)
  calendarLinks: string;  // all calendar links formatted as labeled list
  appointmentDate: string;
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
  const paymentLinks = opts.paymentLinksList.length
    ? opts.paymentLinksList.map(l => `${l.label}: ${l.url}`).join('\n')
    : paymentLink;

  const calendarLink = opts.calendarLinksList[0]?.url || '';
  const calendarLinks = opts.calendarLinksList.length
    ? opts.calendarLinksList.map(l => `${l.label}: ${l.url}`).join('\n')
    : calendarLink;

  return {
    clientName: opts.clientName,
    artistName: opts.artistName,
    paymentLink,
    paymentLinks,
    calendarLink,
    calendarLinks,
    appointmentDate: opts.appointmentDate ?? '',
  };
}

export function applyPlaceholders(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{clientName\}/g, vars.clientName)
    .replace(/\{artistName\}/g, vars.artistName)
    .replace(/\{paymentLink\}/g, vars.paymentLink)
    .replace(/\{paymentLinks\}/g, vars.paymentLinks)
    .replace(/\{calendarLink\}/g, vars.calendarLink)
    .replace(/\{calendarLinks\}/g, vars.calendarLinks)
    .replace(/\{appointmentDate\}/g, vars.appointmentDate);
}

export interface GmailContext {
  refreshToken: string;
  gmailAddress: string;
}

interface SendEmailPayload {
  toEmail: string;
  vars: TemplateVars;
  template: { subject: string; body: string };
  gmailContext?: GmailContext | null;
  existingThreadId?: string | null;
}

interface SendEmailResult {
  threadId?: string;
}

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { toEmail, vars, template, gmailContext, existingThreadId } = payload;

  const subject = applyPlaceholders(template.subject, vars);
  const text = applyPlaceholders(template.body, vars);

  if (gmailContext) {
    try {
      const result = await sendViaGmail({
        refreshToken: gmailContext.refreshToken,
        fromAddress: gmailContext.gmailAddress,
        fromName: vars.artistName,
        to: toEmail,
        subject,
        body: text,
        threadId: existingThreadId ?? undefined,
      });
      return { threadId: result.threadId };
    } catch (err) {
      console.error('Gmail send failed, falling back to Resend:', err);
    }
  }

  if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
    console.log('[MOCK EMAIL SENT]', { to: toEmail, subject, text });
    return {};
  }

  try {
    await resend.emails.send({
      from: 'FlashBook <noreply@flashbook.app>',
      to: [toEmail],
      subject,
      text,
    });
  } catch (error) {
    console.error('Failed to send email via Resend:', error);
  }

  return {};
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
  gmailContext?: GmailContext | null;
  existingThreadId?: string | null;
}): Promise<SendEmailResult> {
  const { newState } = payload;
  if (newState === 'cancelled') return {};

  const defaults = DEFAULT_EMAIL_TEMPLATES[newState as Exclude<BookingState, 'cancelled'>];
  if (!defaults) return {};

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
    gmailContext: payload.gmailContext,
    existingThreadId: payload.existingThreadId,
  });
}
