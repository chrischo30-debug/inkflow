import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BookingState, EmailTemplate } from '@/lib/types';
import { sendEmail, buildTemplateVars, applyPlaceholders, DEFAULT_EMAIL_TEMPLATES } from '@/lib/email';
import type { CalendarLink } from '@/lib/pipeline-settings';
import { normalizePaymentLinks } from '@/lib/pipeline-settings';

async function loadContext(supabase: Awaited<ReturnType<typeof createClient>>, bookingId: string, userId: string) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('state, client_email, client_name, artist_id, payment_link_sent, appointment_date')
    .eq('id', bookingId)
    .eq('artist_id', userId)
    .single();

  if (error || !booking) return null;

  const [{ data: artistCore }, { data: artistExtra }, { data: templateRows }] = await Promise.all([
    supabase
      .from('artists')
      .select('name, studio_name, payment_links, gmail_address, email')
      .eq('id', userId)
      .single(),
    supabase
      .from('artists')
      .select('calendar_links')
      .eq('id', userId)
      .single(),
    supabase
      .from('email_templates')
      .select('*')
      .eq('artist_id', userId),
  ]);

  const artist = artistCore ? {
    ...artistCore,
    calendar_links: artistExtra?.calendar_links ?? [],
  } : null;

  return { booking, artist, templateRows: templateRows ?? [] };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const vars = buildTemplateVars({
    clientName: booking.client_name,
    artistName: artist?.name || artist?.studio_name || 'Your Artist',
    paymentLinksList,
    calendarLinksList,
    primaryPaymentLink: booking.payment_link_sent ?? undefined,
    appointmentDate: booking.appointment_date ?? undefined,
  });

  // Build the full template list for the picker — return RAW (unresolved) text so variables
  // remain visible as {tokens} in the modal editor. POST handler resolves at send time.
  const stateDefaults = DEFAULT_EMAIL_TEMPLATES as Record<string, { subject: string; body: string }>;
  const savedByState = new Map(templateRows.filter(r => r.state).map(r => [r.state as string, r]));
  const customTemplates = templateRows.filter(r => !r.state);

  // State-linked templates (one per emailable state, in pipeline order)
  const STATE_ORDER = ['inquiry', 'follow_up', 'accepted', 'confirmed', 'completed', 'rejected'];
  const stateTemplates = STATE_ORDER
    .filter(state => savedByState.has(state) || !!stateDefaults[state])
    .map(state => {
      const saved = savedByState.get(state);
      const raw = saved ?? stateDefaults[state];
      return {
        id: saved?.id ?? null,
        name: saved?.name ?? stateLabel(state),
        state,
        subject: raw.subject,
        body: raw.body,
      };
    });

  // Custom (non-state) templates
  const custom = customTemplates.map(t => ({
    id: t.id,
    name: t.name ?? 'Custom template',
    state: null,
    subject: t.subject,
    body: t.body,
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
  const vars = buildTemplateVars({
    clientName: booking.client_name,
    artistName: artist?.name || artist?.studio_name || 'Your Artist',
    paymentLinksList,
    calendarLinksList,
    primaryPaymentLink: booking.payment_link_sent ?? undefined,
    appointmentDate: booking.appointment_date ?? undefined,
  });

  await sendEmail({
    toEmail: booking.client_email,
    vars,
    template: { subject, body },
    artistReplyTo: artist?.gmail_address ?? artist?.email ?? null,
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
