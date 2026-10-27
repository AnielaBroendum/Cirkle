import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createSampleQr } from '@/lib/qr';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { product_id, retailer_id, brand_id } = body;

  if (!product_id || !retailer_id || !brand_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data: sample, error: sampleError } = await supabase
    .from('samples')
    .insert({
      product_id,
      retailer_id,
      brand_id,
      status: 'active' as const,
      activated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (sampleError || !sample) {
    return NextResponse.json({ error: sampleError?.message ?? 'Failed to create sample' }, { status: 500 });
  }

  const sampleId = (sample as { id: string }).id;
  const qrCodeUrl = await createSampleQr(supabase, request, sampleId);

  return NextResponse.json({ id: sampleId, qr_code_url: qrCodeUrl });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing sample id' }, { status: 400 });
  }

  // Best-effort cleanup of the stored QR image.
  await supabase.storage.from('brand-assets').remove([`qr-codes/${id}.png`]);

  // RLS ("Brand can manage samples") ensures only the owning brand can delete.
  const { error } = await supabase.from('samples').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
