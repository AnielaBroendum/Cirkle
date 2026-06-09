import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import QRCode from 'qrcode';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { status, tracking_number, inspection_note } = body;

  const { data: swap } = await supabase.from('swap_requests').select('*').eq('id', id).single();
  if (!swap) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const validTransitions: Record<string, string[]> = {
    requested: ['approved', 'cancelled'],
    approved: ['return_shipped'],
    return_shipped: ['return_received'],
    return_received: ['inspected_ok', 'inspected_damaged'],
    inspected_ok: ['new_shipped'],
    inspected_damaged: ['new_shipped'],
    new_shipped: ['completed'],
  };

  if (!validTransitions[swap.status]?.includes(status)) {
    return NextResponse.json({ error: `Cannot transition from ${swap.status} to ${status}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const updateData: Record<string, unknown> = { status };

  if (tracking_number) {
    if (status === 'return_shipped') updateData.return_tracking_number = tracking_number;
    if (status === 'new_shipped') updateData.new_tracking_number = tracking_number;
  }
  if (inspection_note) updateData.inspection_note = inspection_note;

  if (status === 'inspected_ok') {
    await admin.from('samples').update({ status: 'returned', deposit_status: 'refunded' }).eq('id', swap.return_sample_id);
    await admin.from('sample_transactions').insert({
      sample_id: swap.return_sample_id,
      retailer_id: swap.retailer_id,
      brand_id: swap.brand_id,
      transaction_type: 'deposit_refunded',
      amount_dkk: -(await getDepositAmount(admin, swap.return_sample_id)),
      note: 'Deposit refunded — sample returned in good condition',
      swap_request_id: id,
    });
  }

  if (status === 'inspected_damaged') {
    await admin.from('samples').update({ status: 'damaged', deposit_status: 'forfeited' }).eq('id', swap.return_sample_id);
    await admin.from('sample_transactions').insert({
      sample_id: swap.return_sample_id,
      retailer_id: swap.retailer_id,
      brand_id: swap.brand_id,
      transaction_type: 'deposit_forfeited',
      amount_dkk: 0,
      note: 'Deposit forfeited — sample returned damaged',
      swap_request_id: id,
    });
  }

  if (status === 'new_shipped') {
    const { data: newProduct } = await admin
      .from('products')
      .select('deposit_amount_dkk')
      .eq('id', swap.new_product_id)
      .single();

    const depositAmount = newProduct?.deposit_amount_dkk ?? 0;

    const { data: newSample } = await admin
      .from('samples')
      .insert({
        product_id: swap.new_product_id,
        retailer_id: swap.retailer_id,
        brand_id: swap.brand_id,
        status: 'active',
        deposit_amount_dkk: depositAmount,
        deposit_status: 'held',
        size: swap.new_size,
        color: swap.new_color,
        activated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (newSample) {
      updateData.new_sample_id = newSample.id;

      const qrBaseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      try {
        const qrBuffer = await QRCode.toBuffer(`${qrBaseUrl}/p/${newSample.id}`, {
          type: 'png', width: 400, margin: 2,
          color: { dark: '#071a2e', light: '#ffffff' },
        });
        const fileName = `qr-codes/${newSample.id}.png`;
        const { error: uploadErr } = await admin.storage
          .from('brand-assets')
          .upload(fileName, qrBuffer, { contentType: 'image/png', upsert: true });
        if (!uploadErr) {
          const { data: urlData } = admin.storage.from('brand-assets').getPublicUrl(fileName);
          await admin.from('samples').update({ qr_code_url: urlData.publicUrl }).eq('id', newSample.id);
        }
      } catch { /* non-fatal */ }

      if (depositAmount > 0) {
        await admin.from('sample_transactions').insert({
          sample_id: newSample.id,
          retailer_id: swap.retailer_id,
          brand_id: swap.brand_id,
          transaction_type: 'deposit_paid',
          amount_dkk: depositAmount,
          note: 'Deposit for replacement sample (swap)',
          swap_request_id: id,
        });
      }
    }
  }

  const { error } = await supabase.from('swap_requests').update(updateData).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

async function getDepositAmount(admin: ReturnType<typeof createAdminClient>, sampleId: string): Promise<number> {
  const { data } = await admin.from('samples').select('deposit_amount_dkk').eq('id', sampleId).single();
  return data?.deposit_amount_dkk ?? 0;
}
