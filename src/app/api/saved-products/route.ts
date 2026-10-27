import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { findAttributingScan } from '@/lib/attribution';
import { recordEvent } from '@/lib/events';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { product_id, size } = await request.json();

  if (!product_id) {
    return NextResponse.json({ error: 'Missing product_id' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: product } = await admin.from('products').select('brand_id, sizes').eq('id', product_id).single();
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // A save carries a size. One-size products (or none listed) need no choice.
  const sizes: string[] = product.sizes ?? [];
  const savedSize: string | null = sizes.length === 1 ? sizes[0] : size || null;
  if (sizes.length > 1 && (!savedSize || !sizes.includes(savedSize))) {
    return NextResponse.json({ error: 'Pick a size to save' }, { status: 400 });
  }

  // Same rule as checkout: the latest scan in the window gets the credit.
  const scan = await findAttributingScan(admin, user.id, product_id);

  const { data: existing } = await supabase
    .from('saved_products')
    .select('id, size')
    .eq('user_id', user.id)
    .eq('product_id', product_id)
    .maybeSingle();

  if (existing) {
    // Already saved: only a new size counts as a new save.
    if (existing.size === savedSize) return NextResponse.json({ saved: true });
    const { error } = await supabase.from('saved_products').update({ size: savedSize }).eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    const { error } = await supabase.from('saved_products').insert({
      user_id: user.id,
      product_id,
      size: savedSize,
      scan_id: scan?.id ?? null,
      saved_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordEvent(admin, {
    type: 'save',
    userId: user.id,
    productId: product_id,
    brandId: product.brand_id,
    size: savedSize,
    scan,
  });

  return NextResponse.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { product_id } = await request.json();

  if (!product_id) {
    return NextResponse.json({ error: 'Missing product_id' }, { status: 400 });
  }

  await supabase
    .from('saved_products')
    .delete()
    .eq('user_id', user.id)
    .eq('product_id', product_id);

  return NextResponse.json({ removed: true });
}
