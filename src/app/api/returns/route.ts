import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// Return requests (Figma 11). Requires supabase/migrations/003_returns.sql.
// Runs as the signed-in user, so the RLS policies on `returns` apply too.

const REASONS = ['too_big', 'too_small', 'not_as_expected', 'faulty'] as const;

/** GET /api/returns?order_id=… → the user's return requests (optionally for one order). */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('returns')
    .select('id, order_id, order_item_id, reason, comment, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const orderId = request.nextUrl.searchParams.get('order_id');
  if (orderId) query = query.eq('order_id', orderId);

  const { data, error } = await query;
  if (error) {
    console.error('[api/returns] GET failed:', error.message);
    return NextResponse.json({ error: 'Could not load return requests' }, { status: 500 });
  }
  return NextResponse.json({ returns: data ?? [] });
}

/** POST /api/returns { order_item_id, reason, comment? } → creates a return request. */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderItemId = body?.order_item_id;
  const reason = body?.reason;
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 1000) || null : null;

  if (!orderItemId || !REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Missing order_item_id or invalid reason' }, { status: 400 });
  }

  // RLS on orders already limits this to the user's own orders.
  const { data: item } = await supabase
    .from('order_items')
    .select('id, order_id, orders!inner(id, status, consumer_user_id)')
    .eq('id', orderItemId)
    .eq('orders.consumer_user_id', user.id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
  }

  const order = (item as unknown as { orders: { status: string } }).orders;
  if (order.status !== 'delivered') {
    return NextResponse.json({ error: 'Only delivered orders can be returned' }, { status: 409 });
  }

  const { data: created, error } = await supabase
    .from('returns')
    .insert({
      order_id: (item as { order_id: string }).order_id,
      order_item_id: orderItemId,
      user_id: user.id,
      reason,
      comment,
    })
    .select('id, status, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A return has already been requested for this item' }, { status: 409 });
    }
    console.error('[api/returns] POST failed:', error.message);
    return NextResponse.json({ error: 'Could not send the return request. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ return: created }, { status: 201 });
}
