import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { return_sample_id, new_product_id, new_size, new_color, reason } = body;

  if (!return_sample_id || !new_product_id || !new_size || !new_color) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data: rp } = await supabase
    .from('retailer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!rp) return NextResponse.json({ error: 'Retailer not found' }, { status: 403 });

  const { data: sample } = await supabase
    .from('samples')
    .select('*')
    .eq('id', return_sample_id)
    .eq('retailer_id', rp.id)
    .eq('status', 'active')
    .single();
  if (!sample) return NextResponse.json({ error: 'Sample not found or not active' }, { status: 404 });

  const { data: swap, error } = await supabase
    .from('swap_requests')
    .insert({
      retailer_id: rp.id,
      brand_id: sample.brand_id,
      return_sample_id,
      new_product_id,
      new_size,
      new_color,
      reason: reason || null,
    })
    .select('id')
    .single();

  if (error || !swap) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create swap' }, { status: 500 });
  }

  return NextResponse.json({ id: swap.id });
}
