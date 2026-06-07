import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { product_id, scan_id } = await request.json();

  if (!product_id) {
    return NextResponse.json({ error: 'Missing product_id' }, { status: 400 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const { error } = await supabase.from('saved_products').upsert(
    {
      user_id: user.id,
      product_id,
      scan_id: scan_id || null,
      saved_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: 'user_id,product_id' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
