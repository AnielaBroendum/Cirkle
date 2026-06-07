import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendOrderConfirmation, sendNewOrderToBrand } from '@/lib/email';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    product_id,
    size,
    color,
    shipping_name,
    shipping_address,
    shipping_city,
    shipping_postal_code,
    points_to_use,
  } = body;

  if (!product_id || !shipping_name || !shipping_address || !shipping_city || !shipping_postal_code) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: product, error: productError } = await admin
    .from('products')
    .select('*, brand_profiles!inner(id, name)')
    .eq('id', product_id)
    .eq('is_active', true)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const { data: balanceResult } = await admin.rpc('get_points_balance', { p_user_id: user.id });
  const pointsBalance = balanceResult ?? 0;
  const pointsToUse = Math.min(Math.max(points_to_use || 0, 0), pointsBalance);
  const discountOre = pointsToUse * 100;
  const totalOre = Math.max(product.price_dkk - discountOre, 0);

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      consumer_user_id: user.id,
      brand_id: product.brand_id,
      status: 'pending',
      total_dkk: totalOre,
      points_used: pointsToUse,
      discount_dkk: discountOre,
      shipping_name,
      shipping_address,
      shipping_city,
      shipping_postal_code,
      shipping_country: 'DK',
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? 'Failed to create order' }, { status: 500 });
  }

  let variantId: string | null = null;
  if (size && color) {
    const { data: variant } = await admin
      .from('product_variants')
      .select('id')
      .eq('product_id', product_id)
      .eq('size', size)
      .eq('color', color)
      .single();
    variantId = variant?.id ?? null;
  }

  await admin.from('order_items').insert({
    order_id: order.id,
    product_id: product.id,
    product_variant_id: variantId,
    product_name: product.name,
    size: size || null,
    color: color || null,
    quantity: 1,
    unit_price_dkk: product.price_dkk,
  });

  await admin.from('order_events').insert({
    order_id: order.id,
    status: 'pending',
    note: 'Order placed',
  });

  if (pointsToUse > 0) {
    await admin.from('points_ledger').insert({
      user_id: user.id,
      amount: -pointsToUse,
      reason: 'redeemed',
      order_id: order.id,
    });
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: recentScan } = await admin
    .from('scans')
    .select('*')
    .eq('product_id', product_id)
    .eq('scanner_user_id', user.id)
    .gte('scanned_at', ninetyDaysAgo.toISOString())
    .order('scanned_at', { ascending: false })
    .limit(1)
    .single();

  if (recentScan) {
    const isPeer = recentScan.source_type === 'peer';
    const attributionType = isPeer ? 'peer' : 'deferred';

    await admin.from('attributions').insert({
      order_id: order.id,
      scan_id: recentScan.id,
      attribution_type: attributionType,
      source_retailer_id: recentScan.source_retailer_id,
      source_user_id: recentScan.source_user_id,
      commission_rate: isPeer ? null : 1500,
      commission_amount_dkk: isPeer ? null : Math.round(product.price_dkk * 0.15),
      points_amount: isPeer ? 50 : null,
      status: 'pending',
      attribution_window_expires_at: new Date(
        new Date(recentScan.scanned_at).getTime() + 90 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });

    if (isPeer && recentScan.source_user_id) {
      await admin.from('points_ledger').insert({
        user_id: recentScan.source_user_id,
        amount: 50,
        reason: 'peer_referral',
        order_id: order.id,
      });
    }
  }

  const { data: existingPoints } = await admin
    .from('points_ledger')
    .select('id')
    .eq('user_id', user.id)
    .eq('reason', 'welcome_bonus')
    .limit(1);

  if (!existingPoints || existingPoints.length === 0) {
    await admin.from('points_ledger').insert({
      user_id: user.id,
      amount: 100,
      reason: 'welcome_bonus',
      order_id: order.id,
    });
  }

  // Send email notifications
  try {
    const { data: consumerProfile } = await admin
      .from('profiles')
      .select('email, name')
      .eq('id', user.id)
      .single();

    const { data: brandUser } = await admin
      .from('brand_profiles')
      .select('user_id')
      .eq('id', product.brand_id)
      .single();

    if (consumerProfile?.email) {
      await sendOrderConfirmation(
        consumerProfile.email,
        {
          order_number: order.order_number,
          total_dkk: totalOre,
          items: [{ name: product.name, size, color }],
        },
        product.brand_profiles.name,
      );
    }

    if (brandUser?.user_id) {
      const { data: brandProfile } = await admin
        .from('profiles')
        .select('email')
        .eq('id', brandUser.user_id)
        .single();

      if (brandProfile?.email) {
        await sendNewOrderToBrand(brandProfile.email, {
          order_number: order.order_number,
          total_dkk: totalOre,
          consumer_name: consumerProfile?.name || shipping_name,
          items: [{ name: product.name }],
        });
      }
    }
  } catch (e) {
    console.error('Failed to send order emails:', e);
  }

  return NextResponse.json({
    order_id: order.id,
    order_number: order.order_number,
    brand_name: product.brand_profiles.name,
    product_name: product.name,
  });
}
