import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendOrderStatusUpdate } from '@/lib/email';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped'],
  shipped: ['delivered'],
};

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orderId } = params;
  const body = await request.json();
  const { status, tracking_number, tracking_url, note } = body;

  if (!status) {
    return NextResponse.json({ error: 'Missing status' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: brandProfile } = await admin
    .from('brand_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!brandProfile) {
    return NextResponse.json({ error: 'Not a brand' }, { status: 403 });
  }

  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, status, consumer_user_id, brand_id, tracking_number, tracking_url')
    .eq('id', orderId)
    .eq('brand_id', brandProfile.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${order.status} to ${status}` },
      { status: 400 },
    );
  }

  const updateData: Record<string, unknown> = { status };
  if (status === 'shipped' && tracking_number) {
    updateData.tracking_number = tracking_number;
    if (tracking_url) updateData.tracking_url = tracking_url;
  }

  const { error: updateError } = await admin
    .from('orders')
    .update(updateData)
    .eq('id', orderId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await admin.from('order_events').insert({
    order_id: orderId,
    status,
    note: note || null,
  });

  // Send email notification to consumer
  const { data: consumer } = await admin
    .from('profiles')
    .select('email')
    .eq('id', order.consumer_user_id)
    .single();

  const { data: brand } = await admin
    .from('brand_profiles')
    .select('name')
    .eq('id', order.brand_id)
    .single();

  if (consumer?.email && brand?.name) {
    try {
      await sendOrderStatusUpdate(
        consumer.email,
        {
          order_number: order.order_number,
          status,
          tracking_number: tracking_number || order.tracking_number,
          tracking_url: tracking_url || order.tracking_url,
        },
        brand.name,
      );
    } catch (e) {
      console.error('Failed to send status email:', e);
    }
  }

  return NextResponse.json({ success: true, status });
}
