import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderedIds } = await req.json().catch(() => ({})) as { orderedIds?: string[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'orderedIds required' }, { status: 400 });
  }

  // Verify all IDs belong to this artist before writing
  const { data: existing } = await supabase
    .from('bookings')
    .select('id')
    .in('id', orderedIds)
    .eq('artist_id', user.id);

  const ownedIds = new Set((existing ?? []).map(r => r.id));
  const updates = orderedIds
    .filter(id => ownedIds.has(id))
    .map((id, i) => ({ id, sort_order: i + 1 }));

  if (updates.length === 0) return NextResponse.json({ ok: true });

  // Upsert each booking's sort_order — Supabase doesn't support bulk update by PK
  // with different values, so we do individual updates in parallel.
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from('bookings').update({ sort_order }).eq('id', id).eq('artist_id', user.id)
    )
  );

  return NextResponse.json({ ok: true });
}
