import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// Repeat views of the same product by the same visitor inside this window are
// treated as one scan, so navigating/refreshing the app can't inflate counts.
const DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sample_id, product_id, source_type, source_retailer_id, source_user_id, scanner_user_id } = body;

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

  // 1) Never count the brand's own owner previewing their own product.
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

  // 2) De-duplicate repeat views within the window.
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  let dedupe = supabase
    .from('scans')
    .select('id')
    .eq('product_id', product_id)
    .gte('scanned_at', since)
    .limit(1);

  if (scanner_user_id) {
    dedupe = dedupe.eq('scanner_user_id', scanner_user_id);
  } else {
    dedupe = dedupe.is('scanner_user_id', null);
    if (userAgent) dedupe = dedupe.eq('user_agent', userAgent);
  }

  const { data: recent } = await dedupe;
  if (recent && recent.length > 0) {
    return NextResponse.json({ id: (recent[0] as { id: string }).id, deduped: true });
  }

  // 3) Record a genuinely new scan.
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
