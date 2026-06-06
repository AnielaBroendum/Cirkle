import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { brand_id } = body;

  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
  }

  const { data: retailerProfile } = await supabase
    .from('retailer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!retailerProfile) {
    return NextResponse.json({ error: 'Retailer profile not found' }, { status: 403 });
  }

  const retailerId = (retailerProfile as { id: string }).id;

  const { data: existing } = await supabase
    .from('brand_retailer_partnerships')
    .select('id, status')
    .eq('brand_id', brand_id)
    .eq('retailer_id', retailerId);

  const existingList = (existing ?? []) as { id: string; status: string }[];
  const hasActive = existingList.some((p) =>
    ['active', 'invited'].includes(p.status)
  );

  if (hasActive) {
    return NextResponse.json(
      { error: 'A partnership already exists with this brand' },
      { status: 409 }
    );
  }

  const { data: partnership, error: insertError } = await supabase
    .from('brand_retailer_partnerships')
    .insert({
      brand_id,
      retailer_id: retailerId,
      status: 'invited' as const,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ partnership_id: (partnership as { id: string }).id });
}
