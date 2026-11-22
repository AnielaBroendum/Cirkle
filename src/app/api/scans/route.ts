import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { recordEvent } from '@/lib/events';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sample_id, product_id, source_type, source_user_id } = body;

  // The scanner is whoever is signed in (or nobody). Never trust a user ID
  // sent by the browser: it decides who gets credited for the sale.
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  // Every scan belongs to a signed-in shopper (the QR pages send signed-out
  // visitors to log in first), so the chain can continue from them.
  if (!user) {
    return NextResponse.json({ error: 'Sign in to scan' }, { status: 401 });
  }
  const scanner_user_id = user.id;

  if (!product_id || (source_type !== 'retailer' && source_type !== 'peer')) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  // A store scan always comes from a tag. The store is taken from the tag in the
  // database (scans_fill_chain trigger, migration 026), never from the browser.
  if (source_type === 'retailer' && !sample_id) {
    return NextResponse.json({ error: 'Missing sample' }, { status: 400 });
  }

  // A "peer" hit with no referring user is just in-app browsing, not a real
  // peer share. Recording it would wrongly overwrite an existing retailer
  // attribution (and create scans with nobody to credit), so skip it.
  if (source_type === 'peer' && !source_user_id) {
    return NextResponse.json({ id: null, skipped: 'browse' });
  }
  // Opening your own pass-on link isn't a pass-on (and would point your chain at yourself).
  if (source_type === 'peer' && scanner_user_id && source_user_id === scanner_user_id) {
    return NextResponse.json({ id: null, skipped: 'self' });
  }

  const supabase = createAdminClient();
  const userAgent = request.headers.get('user-agent') || null;

  // Never count the brand's own owner previewing their own product.
  if (scanner_user_id) {
    const { data: product } = await supabase
      .from('products')
      .select('brand_profiles ( user_id )')
      .eq('id', product_id)
      .single();
    const ownerId = (product as { brand_profiles?: { user_id?: string } } | null)?.brand_profiles?.user_id;
    if (ownerId && ownerId === scanner_user_id) {
      return NextResponse.json({ id: null, skipped: 'self' });
    }
  }

  // Record the scan.
  const { data, error } = await supabase
    .from('scans')
    .insert({
      sample_id: source_type === 'retailer' ? sample_id : null,
      product_id,
      scanner_user_id: scanner_user_id || null,
      source_type,
      // Store scans: filled from the sample by the trigger. Peer scans: never a store.
      source_retailer_id: null,
      source_user_id: source_type === 'peer' ? source_user_id : null,
      user_agent: userAgent,
    })
    .select('id, sample_id, source_type, source_retailer_id, source_user_id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordEvent(supabase, { type: 'scan', userId: scanner_user_id, productId: product_id, scan: data });

  return NextResponse.json({ id: data.id });
}
