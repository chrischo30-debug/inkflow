import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BookingState, EmailTemplate } from '@/lib/types';
import { sendEmail, buildTemplateVars, applyPlaceholders, DEFAULT_EMAIL_TEMPLATES, STAGE_AUTOSEND_DEFAULTS, templateRequiresEdit } from '@/lib/email';
import type { CalendarLink, SchedulingLink } from '@/lib/pipeline-settings';
import { normalizePaymentLinks } from '@/lib/pipeline-settings';

async function loadContext(supabase: Awaited<ReturnType<typeof createClient>>, bookingId: string, userId: string) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('state, client_email, client_name, artist_id, payment_link_sent, appointment_date, scheduling_link_id')
    .eq('id', bookingId)
    .eq('artist_id', userId)
    .single();

  if (error || !booking) return null;

  const [{ data: artistRaw }, { data: templateRows }] = await Promise.all([
    supabase
      .from('artists')
      .select('name, studio_name, payment_links, gmail_address, email, calendar_links, scheduling_links, logo_url, email_logo_enabled, email_logo_bg, studio_address')
      .eq('id', userId)
      .single(),
    supabase
      .from('email_templates')
      .select('id, name, state, subject, body, auto_send, enabled')
      .eq('artist_id', userId),
  ]);

  type ArtistRow = {
    name?: string; studio_name?: string; payment_links?: unknown; gmail_address?: string; email?: string;
    calendar_links?: CalendarLink[]; scheduling_links?: SchedulingLink[];
    logo_url?: string | null; email_logo_enabled?: boolean | null; email_logo_bg?: "light" | "dark" | null;
    studio_address?: string | null;
  };
  const a = artistRaw as ArtistRow | null;
  const artist = a ? {
    name: a.name,
    studio_name: a.studio_name,
    payment_links: a.payment_links,
    gmail_address: a.gmail_address,
    email: a.email,
    calendar_links: Array.isArray(a.calendar_links) ? a.calendar_links : [],
    scheduling_links: Array.isArray(a.scheduling_links) ? a.scheduling_links : [] as SchedulingLink[],
    logo_url: a.logo_url ?? null,
    email_logo_enabled: a.email_logo_enabled !== false,
    email_logo_bg: (a.email_logo_bg ?? "light") as "light" | "dark",
    studio_address: a.studio_address ?? '',
  } : null;

  return { booking, artist, templateRows: templateRows ?? [] };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ctx = await loadContext(supabase, id, user.id);
  if (!ctx) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const { booking, artist, templateRows } = ctx;
  if (booking.state === 'cancelled' || booking.state === 'rejected') return NextResponse.json({ error: 'No email for cancelled/rejected bookings' }, { status: 400 });

  const paymentLinksList = normalizePaymentLinks(artist?.payment_links);
  const calendarLinksList = (artist?.calendar_links ?? []) as CalendarLink[];

  const allSchedulingLinks: SchedulingLink[] = artist?.scheduling_links ?? [];
  const bookingSchedulingLinkId = (booking as { scheduling_link_id?: string | null }).scheduling_link_id;
  const matchedLink = bookingSchedulingLinkId
    ? allSchedulingLinks.find(l => l.id === bookingSchedulingLinkId)
    : allSchedulingLinks[0]; // fall back to first link if none assigned
  const appOrigin = new URL(req.url).origin;
  const schedulingUrl = matchedLink
    ? `${appOrigin}/schedule/${user.id}/${matchedLink.id}?bid=${id}`
    : '';

  const vars = buildTemplateVars({
    clientName: booking.client_name,
    artistName: artist?.name || artist?.studio_name || 'Your Artist',
    paymentLinksList,
    calendarLinksList,
    primaryPaymentLink: booking.payment_link_sent ?? undefined,
    appointmentDate: booking.appointment_date ?? undefined,
    studioAddress: artist?.studio_address ?? undefined,
    schedulingLink: schedulingUrl,
    schedulingLinkLabel: matchedLink?.label,
  });

  // Build the full template list for the picker — return RAW (unresolved) text so variables
  // remain visible as {tokens} in the modal editor. POST handler resolves at send time.
  const stateDefaults = DEFAULT_EMAIL_TEMPLATES as Record<string, { subject: string; body: string }>;
  const savedByState = new Map(templateRows.filter(r => r.state).map(r => [r.state as string, r]));
  const customTemplates = templateRows.filter(r => !r.state);

  // State-linked templates (one per emailable state, in pipeline order). Includes
  // auto_send so the frontend can decide whether to auto-fire or pop the modal.
  const STATE_ORDER = ['inquiry', 'follow_up', 'accepted', 'sent_calendar', 'booked', 'completed', 'rejected'];
  const stateTemplates = STATE_ORDER
    .filter(state => savedByState.has(state) || !!stateDefaults[state])
    .map(state => {
      const saved = savedByState.get(state);
      const raw = saved ?? stateDefaults[state];
      const stageDefault = STAGE_AUTOSEND_DEFAULTS[state as keyof typeof STAGE_AUTOSEND_DEFAULTS] ?? false;
      const rawAutoSend = saved ? saved.auto_send : stageDefault;
      const autoSend = templateRequiresEdit(state, raw.body) ? false : rawAutoSend;
      const enabled = saved ? (saved as { enabled?: boolean | null }).enabled !== false : true;
      return {
        id: saved?.id ?? null,
        name: saved?.name ?? stateLabel(state),
        state,
        subject: raw.subject,
        body: raw.body,
        auto_send: autoSend,
        enabled,
      };
    });

  // Custom (non-state) templates
  const custom = customTemplates.map(t => ({
    id: t.id,
    name: t.name ?? 'Custom template',
    state: null,
    subject: t.subject,
    body: t.body,
    auto_send: t.auto_send,
    enabled: (t as { enabled?: boolean | null }).enabled !== false,
  }));

  const allTemplates = [...stateTemplates, ...custom];

  // Default selection: match current booking state
  const currentState = booking.state as string;
  const defaultTemplate = allTemplates.find(t => t.state === currentState) ?? allTemplates[0];

  return NextResponse.json({
    subject: defaultTemplate?.subject ?? '',
    body: defaultTemplate?.body ?? '',
    defaultTemplateState: currentState,
    templates: allTemplates,
    paymentLinks: paymentLinksList,
    calendarLinks: calendarLinksList,
    schedulingLinks: allSchedulingLinks.map(l => ({ id: l.id, label: l.label })),
    previewVars: vars as unknown as Record<string, string>,
  });
}

function stateLabel(state: string): string {
  const map: Record<string, string> = {
    inquiry:                 'Submission Received',
    follow_up:               'Follow Ups',
    accepted:                'Submission Accepted',
    deposit_sent:            'Deposit Requested',
    paid_calendar_link_sent: 'Deposit Received – Calendar Sent',
    confirmed:               'Appointment Booked',
    completed:               'Appointment Completed',
    rejected:                'Submission Rejected',
  };
  return map[state] ?? state;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ctx = await loadContext(supabase, id, user.id);
  if (!ctx) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const { booking, artist } = ctx;

  const reqBody = await req.json().catch(() => ({}));
  const subject: string = reqBody.subject ?? '';
  const body: string = reqBody.body ?? '';

  // subject/body may contain {variable} tokens — sendEmail resolves them at send time
  const paymentLinksList = normalizePaymentLinks(artist?.payment_links);
  const calendarLinksList = (artist?.calendar_links ?? []) as CalendarLink[];
  const bookingSchedulingLinkIdPost = (booking as { scheduling_link_id?: string | null }).scheduling_link_id;
  const matchedLinkPost = bookingSchedulingLinkIdPost
    ? artist?.scheduling_links.find(l => l.id === bookingSchedulingLinkIdPost)
    : artist?.scheduling_links[0];
  const appOriginPost = new URL(req.url).origin;
  const schedulingUrlPost = matchedLinkPost ? `${appOriginPost}/schedule/${user.id}/${matchedLinkPost.id}?bid=${id}` : '';
  const vars = buildTemplateVars({
    clientName: booking.client_name,
    artistName: artist?.name || artist?.studio_name || 'Your Artist',
    paymentLinksList,
    calendarLinksList,
    primaryPaymentLink: booking.payment_link_sent ?? undefined,
    appointmentDate: booking.appointment_date ?? undefined,
    studioAddress: artist?.studio_address ?? undefined,
    schedulingLink: schedulingUrlPost,
    schedulingLinkLabel: matchedLinkPost?.label,
  });

  await sendEmail({
    toEmail: booking.client_email,
    vars,
    template: { subject, body },
    artistReplyTo: artist?.gmail_address ?? artist?.email ?? null,
    branding: { logoUrl: artist?.logo_url ?? null, logoEnabled: artist?.email_logo_enabled !== false, logoBg: artist?.email_logo_bg ?? "light" },
  });

  const nowIso = new Date().toISOString();
  await supabase
    .from('bookings')
    .update({ last_email_sent_at: nowIso })
    .eq('id', id);

  // Append to sent_emails history — separate update degrades gracefully if migration not yet run
  const sentEmailLabel = applyPlaceholders(subject, vars).slice(0, 80);
  try {
    const { data: emailLog } = await supabase.from('bookings').select('sent_emails').eq('id', id).single();
    const row = emailLog as { sent_emails?: {label:string;sent_at:string}[] } | null;
    const existing = row?.sent_emails ?? [];
    await supabase.from('bookings')
      .update({ sent_emails: [...existing, { label: sentEmailLabel, sent_at: nowIso }] })
      .eq('id', id);
  } catch { /* sent_emails column may not exist yet */ }

  return NextResponse.json({ success: true, sentEmailLabel });
}
