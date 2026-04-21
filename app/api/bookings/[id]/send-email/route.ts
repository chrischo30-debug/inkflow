import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BookingState, EmailTemplate } from '@/lib/types';
import { sendEmail, buildTemplateVars, DEFAULT_EMAIL_TEMPLATES, applyPlaceholders } from '@/lib/email';
import type { CalendarLink } from '@/lib/pipeline-settings';
import { normalizePaymentLinks } from '@/lib/pipeline-settings';

async function loadContext(supabase: Awaited<ReturnType<typeof createClient>>, bookingId: string, userId: string) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('state, client_email, client_name, artist_id, payment_link_sent, appointment_date, gmail_thread_id')
    .eq('id', bookingId)
    .eq('artist_id', userId)
    .single();

  if (error || !booking) return null;

  const [{ data: artist }, { data: templateRows }] = await Promise.all([
    supabase
      .from('artists')
      .select('name, payment_links, gmail_connected, google_refresh_token, gmail_address, calendar_links')
      .eq('id', userId)
      .single(),
    supabase
      .from('email_templates')
      .select('*')
      .eq('artist_id', userId),
  ]);

  return { booking, artist, templateRows: templateRows ?? [] };
}

function resolveTemplate(
  tmpl: { subject: string; body: string },
  vars: ReturnType<typeof buildTemplateVars>
) {
  return {
    subject: applyPlaceholders(tmpl.subject, vars),
    body: applyPlaceholders(tmpl.body, vars),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ctx = await loadContext(supabase, id, user.id);
  if (!ctx) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const { booking, artist, templateRows } = ctx;
  if (booking.state === 'cancelled') return NextResponse.json({ error: 'No email for cancelled bookings' }, { status: 400 });

  const paymentLinksList = normalizePaymentLinks(artist?.payment_links);
  const calendarLinksList = (artist?.calendar_links ?? []) as CalendarLink[];

  const vars = buildTemplateVars({
    clientName: booking.client_name,
    artistName: artist?.name ?? 'Your Artist',
    paymentLinksList,
    calendarLinksList,
    primaryPaymentLink: booking.payment_link_sent ?? undefined,
    appointmentDate: booking.appointment_date ?? undefined,
  });

  // Build the full resolved template list for the picker
  const stateDefaults = DEFAULT_EMAIL_TEMPLATES as Record<string, { subject: string; body: string }>;
  const savedByState = new Map(templateRows.filter(r => r.state).map(r => [r.state as string, r]));
  const customTemplates = templateRows.filter(r => !r.state);

  // State-linked templates (one per emailable state)
  const STATE_ORDER = ['inquiry', 'reviewed', 'deposit_sent', 'deposit_paid', 'confirmed', 'completed'];
  const stateTemplates = STATE_ORDER.map(state => {
    const saved = savedByState.get(state);
    const raw = saved ?? stateDefaults[state];
    const resolved = resolveTemplate(raw, vars);
    return {
      id: saved?.id ?? null,
      name: saved?.name ?? stateDefaults[state] ? stateLabel(state) : state,
      state,
      ...resolved,
    };
  });

  // Custom (non-state) templates
  const custom = customTemplates.map(t => ({
    id: t.id,
    name: t.name ?? 'Custom template',
    state: null,
    ...resolveTemplate(t, vars),
  }));

  const allTemplates = [...stateTemplates, ...custom];

  // Default selection: match current booking state
  const currentState = booking.state as string;
  const defaultTemplate = allTemplates.find(t => t.state === currentState) ?? allTemplates[0];

  return NextResponse.json({
    subject: defaultTemplate.subject,
    body: defaultTemplate.body,
    defaultTemplateState: currentState,
    templates: allTemplates,
  });
}

function stateLabel(state: string): string {
  const map: Record<string, string> = {
    inquiry: 'Inquiry Received',
    reviewed: 'Inquiry Reviewed',
    deposit_sent: 'Deposit Requested',
    deposit_paid: 'Deposit Received',
    confirmed: 'Appointment Confirmed',
    completed: 'Appointment Completed',
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
  // subject/body are already resolved (user may have edited them)
  const subject: string = reqBody.subject ?? '';
  const body: string = reqBody.body ?? '';

  const gmailContext =
    artist?.gmail_connected && artist.google_refresh_token && artist.gmail_address
      ? { refreshToken: artist.google_refresh_token, gmailAddress: artist.gmail_address }
      : null;

  // vars only needed if subject/body still contain placeholders (edge case)
  const paymentLinksList = normalizePaymentLinks(artist?.payment_links);
  const calendarLinksList = (artist?.calendar_links ?? []) as CalendarLink[];
  const vars = buildTemplateVars({
    clientName: booking.client_name,
    artistName: artist?.name ?? 'Your Artist',
    paymentLinksList,
    calendarLinksList,
    primaryPaymentLink: booking.payment_link_sent ?? undefined,
    appointmentDate: booking.appointment_date ?? undefined,
  });

  const { threadId } = await sendEmail({
    toEmail: booking.client_email,
    vars,
    template: { subject, body },
    gmailContext,
    existingThreadId: booking.gmail_thread_id ?? null,
  });

  await supabase
    .from('bookings')
    .update({
      last_email_sent_at: new Date().toISOString(),
      ...(threadId ? { gmail_thread_id: threadId } : {}),
    })
    .eq('id', id);

  return NextResponse.json({ success: true, threadId: threadId ?? null });
}
