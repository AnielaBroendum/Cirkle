import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateToken } from '@/lib/utils';
import { sendRetailerInvitation } from '@/lib/email';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { email, commission_direct, commission_deferred, commission_tier2 } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const { data: brandProfile } = await supabase
    .from('brand_profiles')
    .select('id, name')
    .eq('user_id', user.id)
    .single();

  if (!brandProfile) {
    return NextResponse.json({ error: 'Brand profile not found' }, { status: 403 });
  }

  const bp = brandProfile as { id: string; name: string };

  const { data: existing } = await supabase
    .from('brand_retailer_partnerships')
    .select('id, status')
    .eq('brand_id', bp.id)
    .eq('invitation_email', email)
    .in('status', ['invited', 'active']);

  if ((existing as { id: string }[] | null)?.length) {
    return NextResponse.json(
      { error: 'An invitation has already been sent to this email' },
      { status: 409 }
    );
  }

  const token = generateToken();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const invitationUrl = `${appUrl}/invite/${token}`;

  const { data: partnership, error: insertError } = await supabase
    .from('brand_retailer_partnerships')
    .insert({
      brand_id: bp.id,
      status: 'invited' as const,
      commission_direct: commission_direct ?? 2500,
      commission_deferred: commission_deferred ?? 1500,
      commission_tier2: commission_tier2 ?? 1000,
      invitation_token: token,
      invitation_email: email,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    await sendRetailerInvitation(email, bp.name, invitationUrl);
  } catch (e) {
    console.error('Failed to send invitation email:', e);
  }

  return NextResponse.json({
    id: (partnership as { id: string }).id,
    token,
    invitation_url: invitationUrl,
  });
}
