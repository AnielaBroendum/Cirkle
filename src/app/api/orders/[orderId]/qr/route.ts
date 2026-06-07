import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import QRCode from 'qrcode';

export async function GET(
  _request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, status, consumer_user_id')
    .eq('id', params.orderId)
    .eq('consumer_user_id', user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status !== 'delivered') {
    return NextResponse.json({ error: 'Order not yet delivered' }, { status: 400 });
  }

  const { data: items } = await admin
    .from('order_items')
    .select('product_id')
    .eq('order_id', order.id);

  if (!items?.length) {
    return NextResponse.json({ error: 'No items' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const qrCodes = await Promise.all(
    items.map(async (item: { product_id: string }) => {
      const url = `${appUrl}/d/${item.product_id}?ref=${user.id}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      });
      return { product_id: item.product_id, url, qr_data_url: dataUrl };
    }),
  );

  return NextResponse.json({ qr_codes: qrCodes });
}
