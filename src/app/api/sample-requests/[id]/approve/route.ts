import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createSampleQr } from '@/lib/qr';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const review_note = body.review_note || null;

  const { data: bp } = await supabase
    .from('brand_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!bp) return NextResponse.json({ error: 'Not a brand' }, { status: 403 });

  const { data: sr } = await supabase
    .from('sample_requests')
    .select('*')
    .eq('id', id)
    .eq('brand_id', bp.id)
    .single();
  if (!sr) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  if (sr.status !== 'pending') {
    return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
  }

  const { data: items } = await supabase
    .from('sample_request_items')
    .select('*')
    .eq('request_id', id);

  if (!items?.length) {
    return NextResponse.json({ error: 'No items in request' }, { status: 400 });
  }

  const admin = createAdminClient();

  for (const item of items) {
    const { data: sample, error: sampleErr } = await admin
      .from('samples')
      .insert({
        product_id: item.product_id,
        retailer_id: sr.retailer_id,
        brand_id: sr.brand_id,
        status: 'active',
        deposit_amount_dkk: item.deposit_amount_dkk,
        deposit_status: 'held',
        size: item.size,
        color: item.color,
        activated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (sampleErr || !sample) continue;

    try {
      await createSampleQr(admin, request, sample.id);
    } catch {
      // QR generation failure is non-fatal
    }

    await admin.from('sample_request_items').update({ sample_id: sample.id }).eq('id', item.id);

    await admin.from('sample_transactions').insert({
      sample_id: sample.id,
      retailer_id: sr.retailer_id,
      brand_id: sr.brand_id,
      transaction_type: 'deposit_paid',
      amount_dkk: item.deposit_amount_dkk,
      note: `Deposit for sample request`,
    });
  }

  await supabase
    .from('sample_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      review_note,
    })
    .eq('id', id);

  return NextResponse.json({ success: true });
}
