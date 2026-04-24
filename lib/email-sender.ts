import { Resend } from 'resend';

export type SendingMethod = 'flashbooker' | 'custom_domain' | 'gmail_smtp';

export interface ArtistSender {
  method: SendingMethod;
  fromAddress: string;
  fromName: string;
  customDomainVerified?: boolean;
  smtpUser?: string | null;
  smtpPasswordEncrypted?: string | null;
}

export interface ArtistRow {
  id: string;
  slug: string | null;
  name: string | null;
  studio_name: string | null;
  sending_method: SendingMethod | null;
  sending_local_part: string | null;
  sending_display_name: string | null;
  custom_sending_domain: string | null;
  custom_sending_domain_verified: boolean | null;
  gmail_smtp_email: string | null;
  gmail_smtp_password_encrypted: string | null;
}

const FLASHBOOKER_DOMAIN = process.env.FLASHBOOKER_SENDING_DOMAIN || 'flashbooker.app';
const REPLIES_DOMAIN = process.env.FLASHBOOKER_REPLIES_DOMAIN || 'replies.flashbooker.app';

function sanitizeLocalPart(raw: string | null): string {
  const base = (raw ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return base || 'bookings';
}

export function resolveArtistSender(artist: ArtistRow): ArtistSender {
  const method = (artist.sending_method ?? 'flashbooker') as SendingMethod;
  const displayName =
    artist.sending_display_name ?? artist.name ?? artist.studio_name ?? 'Your Artist';

  switch (method) {
    case 'custom_domain': {
      const verified = !!artist.custom_sending_domain_verified;
      const domain = artist.custom_sending_domain;
      if (!verified || !domain) {
        return fallbackSender(artist, displayName);
      }
      const local = sanitizeLocalPart(artist.sending_local_part ?? 'hello');
      return {
        method: 'custom_domain',
        fromAddress: `${local}@${domain}`,
        fromName: displayName,
        customDomainVerified: true,
      };
    }
    case 'gmail_smtp': {
      if (!artist.gmail_smtp_email || !artist.gmail_smtp_password_encrypted) {
        return fallbackSender(artist, displayName);
      }
      return {
        method: 'gmail_smtp',
        fromAddress: artist.gmail_smtp_email,
        fromName: displayName,
        smtpUser: artist.gmail_smtp_email,
        smtpPasswordEncrypted: artist.gmail_smtp_password_encrypted,
      };
    }
    case 'flashbooker':
    default:
      return fallbackSender(artist, displayName);
  }
}

function fallbackSender(artist: ArtistRow, displayName: string): ArtistSender {
  const local = sanitizeLocalPart(artist.sending_local_part ?? artist.slug ?? 'bookings');
  return {
    method: 'flashbooker',
    fromAddress: `${local}@${FLASHBOOKER_DOMAIN}`,
    fromName: displayName,
  };
}

export function buildReplyTo(bookingId: string): string {
  return `reply-${bookingId}@${REPLIES_DOMAIN}`;
}

const ARTIST_SENDER_COLUMNS =
  'id, slug, name, studio_name, sending_method, sending_local_part, sending_display_name, custom_sending_domain, custom_sending_domain_verified, gmail_smtp_email, gmail_smtp_password_encrypted';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadArtistForSending(supabase: any, artistId: string): Promise<ArtistRow | null> {
  try {
    const { data } = await supabase.from('artists').select(ARTIST_SENDER_COLUMNS).eq('id', artistId).single();
    return (data as ArtistRow) ?? null;
  } catch {
    return null;
  }
}

export function fallbackArtistRow(artistId: string, name?: string | null, slug?: string | null): ArtistRow {
  return {
    id: artistId,
    slug: slug ?? null,
    name: name ?? null,
    studio_name: null,
    sending_method: 'flashbooker',
    sending_local_part: slug ?? null,
    sending_display_name: name ?? null,
    custom_sending_domain: null,
    custom_sending_domain_verified: false,
    gmail_smtp_email: null,
    gmail_smtp_password_encrypted: null,
  };
}

export function formatFromHeader(sender: ArtistSender): string {
  const safeName = sender.fromName.replace(/"/g, '').trim();
  return safeName ? `${safeName} <${sender.fromAddress}>` : sender.fromAddress;
}

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

export interface DispatchPayload {
  sender: ArtistSender;
  to: string;
  subject: string;
  text: string;
  bookingId: string;
}

export interface DispatchResult {
  providerMessageId?: string;
  mocked?: boolean;
}

export async function dispatchEmail(payload: DispatchPayload): Promise<DispatchResult> {
  const { sender, to, subject, text, bookingId } = payload;
  const replyTo = buildReplyTo(bookingId);

  if (sender.method === 'gmail_smtp') {
    // SMTP path will be wired up alongside Phase 2 onboarding. Until then we fall back
    // to Resend so sends never silently no-op during the transition.
    console.warn('[email-sender] gmail_smtp not yet implemented; falling back to flashbooker send');
    return sendViaResend({
      from: formatFromHeader({ ...sender, method: 'flashbooker', fromAddress: `bookings@${FLASHBOOKER_DOMAIN}` }),
      to, subject, text, replyTo,
    });
  }

  return sendViaResend({
    from: formatFromHeader(sender),
    to,
    subject,
    text,
    replyTo,
  });
}

async function sendViaResend(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo: string;
}): Promise<DispatchResult> {
  if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
    console.log('[MOCK EMAIL SENT]', { from: opts.from, to: opts.to, subject: opts.subject, replyTo: opts.replyTo });
    return { mocked: true };
  }

  try {
    const result = await resend.emails.send({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      replyTo: opts.replyTo,
    });
    return { providerMessageId: result.data?.id };
  } catch (err) {
    console.error('[email-sender] Resend send failed:', err);
    return {};
  }
}
