import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttributingScan } from './attribution';

// One row per scan, save and purchase (migration 008). Written with the admin
// client next to the existing scans / saved_products / orders rows. A failure
// is logged and never breaks the shopper's flow.

export type EventInput = {
  type: 'scan' | 'save' | 'purchase';
  userId: string | null;
  productId: string;
  /** Looked up from the product when not given. */
  brandId?: string;
  size?: string | null;
  /** The scan carrying store (retailer tag) and giver (peer share). */
  scan?: Pick<AttributingScan, 'id' | 'sample_id' | 'source_type' | 'source_retailer_id' | 'source_user_id'> | null;
  orderId?: string;
  orderItemId?: string;
  quantity?: number;
  unitPriceOre?: number;
};

export async function recordEvent(admin: SupabaseClient, e: EventInput): Promise<void> {
  try {
    let brandId = e.brandId;
    if (!brandId) {
      const { data } = await admin.from('products').select('brand_id').eq('id', e.productId).single();
      brandId = (data as { brand_id: string } | null)?.brand_id;
      if (!brandId) return;
    }
    const scan = e.scan ?? null;
    const { error } = await admin.from('events').insert({
      type: e.type,
      user_id: e.userId,
      brand_id: brandId,
      product_id: e.productId,
      size: e.type === 'scan' ? null : e.size || null,
      retailer_id: scan?.source_retailer_id ?? null,
      sample_id: scan?.sample_id ?? null,
      giver_user_id: scan?.source_type === 'peer' ? scan.source_user_id : null,
      scan_id: scan?.id ?? null,
      order_id: e.orderId ?? null,
      order_item_id: e.orderItemId ?? null,
      quantity: e.quantity ?? 1,
      unit_price_dkk: e.unitPriceOre ?? null,
    });
    if (error) console.error('[events] insert failed:', error.message);
  } catch (err) {
    console.error('[events] insert failed:', err);
  }
}
