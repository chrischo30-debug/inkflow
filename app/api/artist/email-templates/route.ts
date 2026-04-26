import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BookingState, EmailTemplate } from '@/lib/types';
import { DEFAULT_EMAIL_TEMPLATES, STAGE_AUTOSEND_DEFAULTS, templateRequiresEdit } from '@/lib/email';

const EMAILABLE_STATES: Exclude<BookingState, 'cancelled'>[] = [
  'inquiry', 'follow_up', 'accepted', 'sent_calendar', 'booked', 'completed', 'rejected',
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: rows } = await supabase
    .from('email_templates')
    .select('*')
    .eq('artist_id', user.id);

  const saved = new Map((rows ?? []).filter(r => r.state).map(r => [r.state as BookingState, r]));

  const stateTemplates: EmailTemplate[] = EMAILABLE_STATES.map(state => {
    const row = saved.get(state);
    return row
      ? { id: row.id, artist_id: row.artist_id, state, name: row.name, subject: row.subject, body: row.body, auto_send: row.auto_send, enabled: row.enabled !== false }
      : { state, subject: DEFAULT_EMAIL_TEMPLATES[state].subject, body: DEFAULT_EMAIL_TEMPLATES[state].body, auto_send: STAGE_AUTOSEND_DEFAULTS[state] ?? false, enabled: true };
  });

  const customTemplates: EmailTemplate[] = (rows ?? [])
    .filter(r => !r.state)
    .map(r => ({ id: r.id, artist_id: r.artist_id, state: null, name: r.name ?? 'Custom', subject: r.subject, body: r.body, auto_send: r.auto_send, enabled: r.enabled !== false }));

  return NextResponse.json({ templates: stateTemplates, customTemplates });
}

// Update a state-linked template
export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { state, subject, body: templateBody, auto_send, enabled } = body as {
    state: BookingState; subject: string; body: string; auto_send: boolean; enabled?: boolean;
  };

  if (!state || !subject || !templateBody) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Templates that require editing (e.g. follow_up with REPLACE THIS) can never auto-send
  const safeAutoSend = templateRequiresEdit(state, templateBody) ? false : auto_send;
  const safeEnabled = enabled !== false; // default true

  let { error } = await supabase
    .from('email_templates')
    .upsert(
      { artist_id: user.id, state, subject, body: templateBody, auto_send: safeAutoSend, enabled: safeEnabled },
      { onConflict: 'artist_id,state' }
    );

  // Retry without `enabled` if the column doesn't exist yet (migration pending)
  if (error && error.message?.includes('enabled')) {
    ({ error } = await supabase
      .from('email_templates')
      .upsert(
        { artist_id: user.id, state, subject, body: templateBody, auto_send: safeAutoSend },
        { onConflict: 'artist_id,state' }
      ));
  }

  if (error) return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  return NextResponse.json({ success: true });
}

// Create a new custom (non-state-linked) template
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, subject, body: templateBody } = body as { name: string; subject: string; body: string };

  if (!name?.trim() || !subject?.trim() || !templateBody?.trim()) {
    return NextResponse.json({ error: 'Name, subject, and body are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({ artist_id: user.id, state: null, name: name.trim(), subject, body: templateBody, auto_send: false })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}

// Delete a custom template by id
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('artist_id', user.id)
    .is('state', null); // only allow deleting custom templates

  if (error) return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  return NextResponse.json({ success: true });
}
