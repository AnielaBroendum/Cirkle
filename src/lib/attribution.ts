import type { SupabaseClient } from '@supabase/supabase-js';

export const ATTRIBUTION_WINDOW_DAYS = 90;

export type AttributingScan = {
  id: string;
  sample_id: string | null;
  source_type: 'retailer' | 'peer';
  source_retailer_id: string | null;
  source_user_id: string | null;
  scanned_at: string;
};

// A scan credits someone only if it came from a store's tag or from a real
// peer share. In-app browsing ("peer" without a giver) credits nobody.
function credits(s: AttributingScan): boolean {
  return (s.source_type === 'retailer' && !!s.source_retailer_id) || (s.source_type === 'peer' && !!s.source_user_id);
}

/**
 * The scan that gets the credit for a save or purchase: last scan wins within
 * the 90-day window. Save and checkout both use this, so a save and the later
 * purchase credit the same store or giver. It never takes a scan id from the
 * browser: the browser must not pick who gets credited.
 */
export async function findAttributingScan(
  admin: SupabaseClient,
  userId: string,
  productId: string
): Promise<AttributingScan | null> {
  const since = new Date(Date.now() - ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { data } = await admin
    .from('scans')
    .select('id, sample_id, source_type, source_retailer_id, source_user_id, scanned_at')
    .eq('product_id', productId)
    .eq('scanner_user_id', userId)
    .gte('scanned_at', since.toISOString())
    .order('scanned_at', { ascending: false })
    .limit(10);
  return ((data ?? []) as AttributingScan[]).find(credits) ?? null;
}
