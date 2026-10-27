import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { ORDER_FOR_UPDATE_COLUMNS, applyOrderStatus, type OrderForUpdate } from '@/lib/order-updates';

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
  const { status, carrier, tracking_number, tracking_url, note } = body;

  if (!status) {
    return NextResponse.json({ error: 'Missing status' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: brandProfile } = await admin
    .from('brand_profiles')
    .select('id, name')
    .eq('user_id', user.id)
    .single();

  if (!brandProfile) {
    return NextResponse.json({ error: 'Not a brand' }, { status: 403 });
  }

  const { data: order } = await admin
    .from('orders')
    .select(ORDER_FOR_UPDATE_COLUMNS)
    .eq('id', orderId)
    .eq('brand_id', brandProfile.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const result = await applyOrderStatus(
    admin,
    order as OrderForUpdate,
    { status, carrier, tracking_number, tracking_url, note },
    brandProfile.name
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, status });
}
