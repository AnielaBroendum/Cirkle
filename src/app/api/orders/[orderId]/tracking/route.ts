import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isCarrier, trackingUrl } from '@/lib/orders';

// Add or correct carrier and tracking on a shipped order (e.g. after a bulk
// "Mark selected as shipped"). Not a new step, so no extra message is sent.
export async function POST(request: NextRequest, { params }: { params: { orderId: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { carrier, tracking_number, tracking_url } = await request.json();
  if (carrier && !isCarrier(carrier)) {
    return NextResponse.json({ error: 'Unknown carrier' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: brand } = await admin.from('brand_profiles').select('id').eq('user_id', user.id).single();
  if (!brand) {
    return NextResponse.json({ error: 'Not a brand' }, { status: 403 });
  }

  const { data: order } = await admin
    .from('orders')
    .select('id, status')
    .eq('id', params.orderId)
    .eq('brand_id', brand.id)
    .single();
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.status !== 'shipped') {
    return NextResponse.json({ error: 'Tracking can be changed while the order is on its way' }, { status: 409 });
  }

  const number = typeof tracking_number === 'string' && tracking_number.trim() ? tracking_number.trim() : null;
  const { error } = await admin
    .from('orders')
    .update({
      carrier: carrier || null,
      tracking_number: number,
      tracking_url: trackingUrl(carrier, number) ?? (typeof tracking_url === 'string' && tracking_url.trim() ? tracking_url.trim() : null),
    })
    .eq('id', order.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
