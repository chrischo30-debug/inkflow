import { Resend } from 'resend';
import { BookingState, EmailTemplate } from './types';
import type { CalendarLink, PaymentLink } from './pipeline-settings';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

const SENDING_DOMAIN = process.env.FLASHBOOKER_SENDING_DOMAIN || 'flashbooker.app';
const SENDING_LOCAL = process.env.FLASHBOOKER_SENDING_LOCAL || 'bookings';
const APP_NAME = 'FlashBooker';

// States whose automated emails thread together in the client's inbox.
// follow_up is intentionally excluded — it's back-and-forth conversation.
export const THREADING_STATES = new Set<string>([
  'inquiry', 'sent_deposit', 'sent_calendar', 'booked', 'confirmed', 'completed', 'rejected',
]);

function generateMessageId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `<flashbooker-${Date.now()}-${rand}@flashbooker.app>`;
}

// Per-stage default for auto-send when the artist has not saved a template row.
// Stages whose default body contains "REPLACE THIS" must never auto-send: the
// artist has to fill in something specific before it goes out.
export const STAGE_AUTOSEND_DEFAULTS: Record<Exclude<BookingState, 'cancelled'>, boolean> = {
  inquiry:       true,   // submission received — sent automatically when form comes in
  follow_up:     false,  // contains REPLACE THIS — must be edited
  accepted:      false,  // deposit request — artist should confirm deposit link first
  sent_deposit:  false,
  sent_calendar: true,   // calendar link — sent automatically when Stripe deposit clears
  booked:        true,
  confirmed:     true,
  completed:     false,  // off by default
  rejected:      false,
};

// Per-stage default for the `enabled` toggle when the artist has not saved a
// template row. `false` means the stage is fully off until the artist opts in.
export const STAGE_ENABLED_DEFAULTS: Partial<Record<Exclude<BookingState, 'cancelled'>, boolean>> = {
  completed: false,  // post-appointment thank-you is opt-in
};

// Stages that the artist must edit before sending (REPLACE THIS markers, etc).
// The settings UI hides the auto-send toggle for these.
export function templateRequiresEdit(state: string | null | undefined, body: string): boolean {
  if (state === 'follow_up') return true;
  return /REPLACE THIS/.test(body);
}

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
    subject: `Save your spot — deposit to book`,
    body: `Hi {clientFirstName},\n\nI'd love to do this tattoo. To save your spot, send the deposit here:\n{paymentLink}\n\nOnce the deposit is in, you'll get a link to pick your appointment time.\n\n{artistName}`,
  },
  // Aliased to the `accepted` ("Deposit Request") template. The dedicated
  // deposit-reminder template was removed — every deposit email uses the
  // same Deposit Request copy.
  sent_deposit: {
    subject: `Save your spot — deposit to book`,
    body: `Hi {clientFirstName},\n\nI'd love to do this tattoo. To save your spot, send the deposit here:\n{paymentLink}\n\nOnce the deposit is in, you'll get a link to pick your appointment time.\n\n{artistName}`,
  },
  sent_calendar: {
    subject: `Pick your appointment time`,
    body: `Hi {clientFirstName},\n\nDeposit is in, thanks. Pick a time that works for you:\n{schedulingLink}\n\n{artistName}`,
  },
  booked: {
    subject: `You're booked`,
    body: `Hi {clientFirstName},\n\nYou're booked for {appointmentDate}.\n\n{studioAddress}\n{studioMapsUrl}\n\nSee you then.\n\n{artistName}`,
  },
  confirmed: {
    subject: `You're booked`,
    body: `Hi {clientFirstName},\n\nYou're booked for {appointmentDate}.\n\n{studioAddress}\n{studioMapsUrl}\n\nSee you then.\n\n{artistName}`,
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
  schedulingLink: string;      // per-booking scheduling URL (or empty)
  schedulingLinkLabel: string; // label for the matched scheduling link (or empty)
  studioAddress: string;     // artist's saved studio address (or empty)
  studioMapsUrl: string;     // Google Maps search URL for studioAddress (or empty)
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
  schedulingLink?: string;
  schedulingLinkLabel?: string;
  studioAddress?: string;
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
    schedulingLink: opts.schedulingLink ?? '',
    schedulingLinkLabel: opts.schedulingLinkLabel ?? '',
    studioAddress: opts.studioAddress ?? '',
    studioMapsUrl: opts.studioAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opts.studioAddress)}`
      : '',
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
  if (!vars.schedulingLink) empty.push("schedulingLink");
  if (!vars.studioAddress) empty.push("studioAddress");
  if (!vars.studioMapsUrl) empty.push("studioMapsUrl");
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
    // Resolve to [Label](url) markdown so textToHtmlBody renders the label, not the bare URL.
    .replace(/\{paymentLink:([^}]+)\}/g, (_match, rawLabel: string) => {
      const url = findLinkByLabel(vars.paymentLinksList, rawLabel) ?? vars.paymentLink;
      return url ? `[${rawLabel.trim()}](${url})` : rawLabel.trim();
    })
    .replace(/\{calendarLink:([^}]+)\}/g, (_match, rawLabel: string) => {
      const url = findLinkByLabel(vars.calendarLinksList, rawLabel) ?? vars.calendarLink;
      return url ? `[${rawLabel.trim()}](${url})` : rawLabel.trim();
    })
    .replace(/\{clientFirstName\}/g, vars.clientFirstName)
    .replace(/\{clientName\}/g, vars.clientName)
    .replace(/\{artistName\}/g, vars.artistName)
    .replace(/\{paymentLink\}/g, () => {
      const url = vars.paymentLink;
      const label = vars.paymentLinksList[0]?.label ?? 'Payment link';
      return url ? `[${label}](${url})` : url;
    })
    .replace(/\{calendarLink\}/g, () => {
      const url = vars.calendarLink;
      const label = vars.calendarLinksList[0]?.label ?? 'Scheduling link';
      return url ? `[${label}](${url})` : url;
    })
    .replace(/\{appointmentDate\}/g, vars.appointmentDate)
    .replace(/\{stripePaymentLink\}/g, vars.stripePaymentLink)
    .replace(/\{schedulingLink\}/g, () => {
      const url = vars.schedulingLink;
      const label = vars.schedulingLinkLabel || 'Scheduling link';
      return url ? `[${label}](${url})` : url;
    })
    .replace(/\{studioAddress\}/g, vars.studioAddress)
    .replace(/\{studioMapsUrl\}/g, vars.studioMapsUrl);
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
  threadMessageId?: string;
}

interface SendEmailResult {
  subject?: string;
  providerMessageId?: string;
  messageId?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Process a single inline segment: escape HTML, apply **bold** / *italic*, linkify bare URLs.
// Markdown link tokens [label](url) are handled separately before this is called.
function processInlineHtml(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Linkify remaining bare URLs (after bold/italic so * inside URLs isn't parsed)
  t = t.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#2563eb;text-decoration:underline;word-break:break-all">$1</a>',
  );
  return t;
}

// Convert a markdown-formatted plain-text body into safe HTML.
// Supports: [label](url) links, **bold**, *italic*, - bullet lists, bare URLs.
function textToHtmlBody(text: string): string {
  const lines = text.split('\n');
  const htmlParts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const bulletMatch = lines[i].match(/^- (.*)$/);
    if (bulletMatch) {
      // Collect consecutive bullet lines into a <ul>
      const items: string[] = [];
      while (i < lines.length) {
        const bm = lines[i].match(/^- (.*)$/);
        if (!bm) break;
        items.push(bm[1]);
        i++;
      }
      const listItems = items
        .map(item => `<li style="margin:2px 0">${processLine(item)}</li>`)
        .join('');
      htmlParts.push(`<ul style="margin:4px 0;padding-left:1.5em">${listItems}</ul>`);
    } else {
      htmlParts.push(processLine(lines[i]));
      i++;
    }
  }

  return htmlParts.join('<br>');
}

// Process one line: split on [label](url) markdown links, then apply inline formatting.
function processLine(line: string): string {
  const MD = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const parts: { kind: 'text' | 'link'; text?: string; label?: string; url?: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = MD.exec(line)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: line.slice(last, m.index) });
    parts.push({ kind: 'link', label: m[1], url: m[2] });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ kind: 'text', text: line.slice(last) });
  return parts
    .map(p =>
      p.kind === 'link'
        ? `<a href="${escapeHtml(p.url!)}" style="color:#2563eb;text-decoration:underline;word-break:break-word">${escapeHtml(p.label!)}</a>`
        : processInlineHtml(p.text!),
    )
    .join('');
}

// For the plain-text email part, render [label](url) as "label (url)" and strip
// markdown bold/italic markers so plain-text clients see clean copy.
function markdownLinksToText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label: string, url: string) => `${label} (${url})`)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
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

// Send a one-off transactional email (password reset, etc.) that doesn't go
// through the templated booking pipeline. Body supports the same lightweight
// markdown as state-transition emails.
export async function sendTransactionalEmail(payload: {
  toEmail: string;
  subject: string;
  body: string;
  fromName?: string;
  replyTo?: string | null;
  branding?: EmailBranding;
}): Promise<SendEmailResult> {
  const { toEmail, subject, body, fromName, replyTo, branding } = payload;
  const from = buildFromHeader(fromName ?? APP_NAME);
  const html = buildHtmlEmail(body, branding);
  const text = markdownLinksToText(body);
  const messageId = generateMessageId();

  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is not set — refusing to send email in production');
    }
    console.log('[MOCK EMAIL SENT]', { from, to: toEmail, subject, replyTo, messageId, text });
    return { subject, messageId };
  }

  try {
    const result = await resend.emails.send({
      from,
      to: [toEmail],
      subject,
      text,
      html,
      headers: { 'Message-ID': messageId },
      ...(replyTo ? { replyTo } : {}),
    });
    return { subject, providerMessageId: result.data?.id, messageId };
  } catch (error) {
    console.error('Failed to send transactional email via Resend:', error);
    return { subject, messageId };
  }
}

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { toEmail, vars, template, artistReplyTo, branding, threadMessageId } = payload;

  const subject = applyPlaceholders(template.subject, vars);
  const resolved = applyPlaceholders(template.body, vars);
  const from = buildFromHeader(vars.artistName);
  const html = buildHtmlEmail(resolved, branding);
  const text = markdownLinksToText(resolved);
  const messageId = generateMessageId();

  const headers: Record<string, string> = { 'Message-ID': messageId };
  if (threadMessageId) {
    headers['In-Reply-To'] = threadMessageId;
    headers['References'] = threadMessageId;
  }

  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === 'production') {
      // Fail loud in production: the placeholder key would 401 at Resend and
      // get silently swallowed by the try/catch below, leaving callers thinking
      // the email went out.
      throw new Error('RESEND_API_KEY is not set — refusing to send email in production');
    }
    console.log('[MOCK EMAIL SENT]', { from, to: toEmail, subject, replyTo: artistReplyTo, messageId, threadMessageId, text });
    return { subject, messageId };
  }

  try {
    const result = await resend.emails.send({
      from,
      to: [toEmail],
      subject,
      text,
      html,
      headers,
      ...(artistReplyTo ? { replyTo: artistReplyTo } : {}),
    });
    return { subject, providerMessageId: result.data?.id, messageId };
  } catch (error) {
    console.error('Failed to send email via Resend:', error);
    return { subject, messageId };
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
  studioAddress?: string;
  template?: EmailTemplate | null;
  artistReplyTo?: string | null;
  branding?: EmailBranding;
  threadMessageId?: string;
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
    studioAddress: payload.studioAddress,
  });

  return sendEmail({
    toEmail: payload.toEmail,
    vars,
    template: payload.template
      ? { subject: payload.template.subject, body: payload.template.body }
      : defaults,
    artistReplyTo: payload.artistReplyTo,
    branding: payload.branding,
    threadMessageId: payload.threadMessageId,
  });
}
