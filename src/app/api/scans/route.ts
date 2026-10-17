import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sample_id, product_id, source_type, source_retailer_id, source_user_id } = body;

  // The scanner is whoever is signed in (or nobody). Never trust a user ID
  // sent by the browser: it decides who gets credited for the sale.
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  const scanner_user_id = user?.id ?? null;

  if (!product_id || !source_type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // A "peer" hit with no referring user is just in-app browsing, not a real
  // peer share. Recording it would wrongly overwrite an existing retailer
  // attribution (and create scans with nobody to credit), so skip it.
  if (source_type === 'peer' && !source_user_id) {
    return NextResponse.json({ id: null, skipped: 'browse' });
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
      sample_id: sample_id || null,
      product_id,
      scanner_user_id: scanner_user_id || null,
      source_type,
      source_retailer_id: source_retailer_id || null,
      source_user_id: source_user_id || null,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
