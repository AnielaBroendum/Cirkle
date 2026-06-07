import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sample_id, product_id, source_type, source_retailer_id, source_user_id, scanner_user_id } = body;

  if (!product_id || !source_type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const userAgent = request.headers.get('user-agent') || null;

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
