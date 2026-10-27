import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { ORDER_FOR_UPDATE_COLUMNS, applyOrderStatus, type OrderForUpdate } from '@/lib/order-updates';
import { isCarrier } from '@/lib/orders';

// "Mark selected as shipped" (Figma 06): every order is shipped on its own,
// with its own timestamp, timeline event, email and push.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { order_ids, carrier } = await request.json();
  if (!Array.isArray(order_ids) || order_ids.length === 0 || order_ids.length > 100) {
    return NextResponse.json({ error: 'Pick between 1 and 100 orders' }, { status: 400 });
  }
  if (carrier && !isCarrier(carrier)) {
    return NextResponse.json({ error: 'Unknown carrier' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: brand } = await admin.from('brand_profiles').select('id, name').eq('user_id', user.id).single();
  if (!brand) {
    return NextResponse.json({ error: 'Not a brand' }, { status: 403 });
  }

  const { data: orders } = await admin
    .from('orders')
    .select(ORDER_FOR_UPDATE_COLUMNS)
    .in('id', order_ids)
    .eq('brand_id', brand.id);
  const found = (orders ?? []) as OrderForUpdate[];
  // All or nothing on ownership: never ship part of a list that includes someone else's order.
  if (found.length !== new Set(order_ids).size) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const results = [];
  for (const order of found) {
    const r = await applyOrderStatus(admin, order, { status: 'shipped', carrier }, brand.name);
    results.push({ id: order.id, order_number: order.order_number, ...(r.ok ? { ok: true } : { ok: false, error: r.error }) });
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({ results, shipped: results.length - failed.length }, { status: failed.length ? 207 : 200 });
}
