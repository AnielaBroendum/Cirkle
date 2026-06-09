import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { brand_id, partnership_id, items, note } = body;

  if (!brand_id || !partnership_id || !items?.length) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data: rp } = await supabase
    .from('retailer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!rp) return NextResponse.json({ error: 'Retailer profile not found' }, { status: 403 });

  const { data: sr, error: srErr } = await supabase
    .from('sample_requests')
    .insert({
      retailer_id: rp.id,
      brand_id,
      partnership_id,
      note: note || null,
    })
    .select('id')
    .single();

  if (srErr || !sr) {
    return NextResponse.json({ error: srErr?.message ?? 'Failed to create request' }, { status: 500 });
  }

  const itemRows = items.map((item: { product_id: string; size: string; color: string; deposit_amount_dkk: number }) => ({
    request_id: sr.id,
    product_id: item.product_id,
    size: item.size,
    color: item.color,
    deposit_amount_dkk: item.deposit_amount_dkk,
  }));

  const { error: itemErr } = await supabase.from('sample_request_items').insert(itemRows);

  if (itemErr) {
    await supabase.from('sample_requests').delete().eq('id', sr.id);
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: sr.id });
}
