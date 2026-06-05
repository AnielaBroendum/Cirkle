import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import QRCode from 'qrcode';

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
  const qrBaseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const scanUrl = `${qrBaseUrl}/p/${sampleId}`;

  const qrBuffer = await QRCode.toBuffer(scanUrl, {
    type: 'png',
    width: 400,
    margin: 2,
    color: { dark: '#071a2e', light: '#ffffff' },
  });

  const fileName = `qr-codes/${sampleId}.png`;
  const { error: uploadError } = await supabase.storage
    .from('brand-assets')
    .upload(fileName, qrBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  let qrCodeUrl: string | null = null;
  if (!uploadError) {
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(fileName);
    qrCodeUrl = urlData.publicUrl;

    await supabase.from('samples').update({ qr_code_url: qrCodeUrl }).eq('id', sampleId);
  }

  return NextResponse.json({ id: sampleId, qr_code_url: qrCodeUrl });
}
