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
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const { data: partnership } = await supabase
    .from('brand_retailer_partnerships')
    .select('id, status, brand_id')
    .eq('invitation_token', token)
    .single();

  if (!partnership) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  const p = partnership as { id: string; status: string; brand_id: string };

  if (p.status !== 'invited') {
    return NextResponse.json({ error: 'Invitation already used' }, { status: 409 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', user.id)
    .single();

  const profileData = profile as { name: string; email: string } | null;

  let { data: retailerProfile } = await supabase
    .from('retailer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!retailerProfile) {
    const { data: newProfile, error: createError } = await supabase
      .from('retailer_profiles')
      .insert({
        user_id: user.id,
        name: profileData?.name ?? 'My Store',
      })
      .select('id')
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    retailerProfile = newProfile;
  }

  const retailerId = (retailerProfile as { id: string }).id;

  const { error: updateError } = await supabase
    .from('brand_retailer_partnerships')
    .update({
      retailer_id: retailerId,
      status: 'active' as const,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', p.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ partnership_id: p.id, retailer_id: retailerId });
}
