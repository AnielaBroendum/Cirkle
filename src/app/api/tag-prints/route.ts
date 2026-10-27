import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

// Print QR tags again (Figma 05 / Retail 03). Never makes a new code: each
// product + store resolves to its oldest active sample, whose stored QR image
// is printed. Brands print their own products' tags; stores only their own
// store's tags. Every printed tag is logged in tag_prints.

type SampleRow = {
  id: string;
  product_id: string;
  retailer_id: string;
  brand_id: string;
  status: string;
  qr_code_url: string | null;
  created_at: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sample_ids, portal } = await request.json().catch(() => ({}));
  if (portal !== 'brand' && portal !== 'retail') {
    return NextResponse.json({ error: 'Unknown portal' }, { status: 400 });
  }
  if (!Array.isArray(sample_ids) || sample_ids.length === 0 || sample_ids.length > 200) {
    return NextResponse.json({ error: 'Pick between 1 and 200 tags' }, { status: 400 });
  }

  const admin = createAdminClient();
  const owner =
    portal === 'brand'
      ? await admin.from('brand_profiles').select('id').eq('user_id', user.id).maybeSingle()
      : await admin.from('retailer_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (!owner.data) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }
  const ownerId = (owner.data as { id: string }).id;
  const ownerColumn = portal === 'brand' ? 'brand_id' : 'retailer_id';

  const { data: requested } = await admin
    .from('samples')
    .select('id, product_id, retailer_id, brand_id, status, qr_code_url, created_at')
    .in('id', sample_ids);
  const rows = (requested ?? []) as SampleRow[];
  if (rows.length !== new Set(sample_ids).size) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }
  // All or nothing: a store asking for another store's tag gets nothing.
  if (rows.some((s) => s[ownerColumn] !== ownerId)) {
    return NextResponse.json({ error: 'You can only print your own tags' }, { status: 403 });
  }

  // One tag per product + store: the oldest active sample's code.
  const { data: candidates } = await admin
    .from('samples')
    .select('id, product_id, retailer_id, brand_id, status, qr_code_url, created_at')
    .in('product_id', Array.from(new Set(rows.map((s) => s.product_id))))
    .in('retailer_id', Array.from(new Set(rows.map((s) => s.retailer_id))))
    .eq('status', 'active')
    .not('qr_code_url', 'is', null)
    .order('created_at', { ascending: true });
  const oldest = new Map<string, SampleRow>();
  for (const s of (candidates ?? []) as SampleRow[]) {
    const key = `${s.product_id}:${s.retailer_id}`;
    if (!oldest.has(key)) oldest.set(key, s);
  }
  const chosen = new Map<string, SampleRow>();
  for (const s of rows) {
    const key = `${s.product_id}:${s.retailer_id}`;
    const pick = oldest.get(key) ?? (s.qr_code_url ? s : null); // no active sample left: reprint the one asked for
    if (pick) chosen.set(key, pick);
  }
  const tags = Array.from(chosen.values());
  if (tags.length === 0) {
    return NextResponse.json({ error: 'These samples have no QR code yet' }, { status: 409 });
  }

  const [products, brands, stores] = await Promise.all([
    admin.from('products').select('id, name').in('id', tags.map((t) => t.product_id)),
    admin.from('brand_profiles').select('id, name').in('id', tags.map((t) => t.brand_id)),
    admin.from('retailer_profiles').select('id, name').in('id', tags.map((t) => t.retailer_id)),
  ]);
  const name = (res: { data: { id: string; name: string }[] | null }) => new Map((res.data ?? []).map((r) => [r.id, r.name]));
  const productName = name(products);
  const brandName = name(brands);
  const storeName = name(stores);

  const { error: logError } = await admin
    .from('tag_prints')
    .insert(tags.map((t) => ({ sample_id: t.id, user_id: user.id, portal })));
  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  return NextResponse.json({
    tags: tags.map((t) => ({
      sample_id: t.id,
      qr_code_url: t.qr_code_url,
      product: productName.get(t.product_id) ?? 'Product',
      brand: brandName.get(t.brand_id) ?? '',
      store: storeName.get(t.retailer_id) ?? '',
    })),
  });
}
