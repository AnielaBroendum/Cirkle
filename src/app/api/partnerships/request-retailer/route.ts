import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateToken } from '@/lib/utils';

// A brand requests a partnership with an existing retailer on the platform.
// Brand-initiated rows carry an invitation_token (the convention that
// distinguishes them from retailer-initiated requests).
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { retailer_id, commission_direct, commission_deferred, commission_tier2 } = body;

  if (!retailer_id) {
    return NextResponse.json({ error: 'retailer_id is required' }, { status: 400 });
  }

  const { data: brandProfile } = await supabase
    .from('brand_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!brandProfile) {
    return NextResponse.json({ error: 'Brand profile not found' }, { status: 403 });
  }

  const brandId = (brandProfile as { id: string }).id;

  const { data: existing } = await supabase
    .from('brand_retailer_partnerships')
    .select('id, status')
    .eq('brand_id', brandId)
    .eq('retailer_id', retailer_id);

  const hasOpen = ((existing ?? []) as { status: string }[]).some((p) =>
    ['active', 'invited'].includes(p.status)
  );
  if (hasOpen) {
    return NextResponse.json(
      { error: 'A partnership already exists with this retailer' },
      { status: 409 }
    );
  }

  const { data: partnership, error: insertError } = await supabase
    .from('brand_retailer_partnerships')
    .insert({
      brand_id: brandId,
      retailer_id,
      status: 'invited' as const,
      invitation_token: generateToken(),
      ...(commission_direct ? { commission_direct } : {}),
      ...(commission_deferred ? { commission_deferred } : {}),
      ...(commission_tier2 ? { commission_tier2 } : {}),
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ partnership_id: (partnership as { id: string }).id });
}
