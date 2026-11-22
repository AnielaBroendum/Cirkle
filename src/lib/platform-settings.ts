import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The store's share of a passed-on sale, in basis points (1500 = 15 %).
 * Lives in the one-row platform_settings table (migration 028) so it can be
 * changed without a deploy; 0 = off. Needs the service-role client (no RLS
 * policies). Any read error counts as 0, so a failure never pays a share.
 */
export async function getPeerStoreCommissionBps(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.from('platform_settings').select('peer_store_commission_bps').eq('id', true).maybeSingle();
  if (error || !data) return 0;
  const bps = Number((data as { peer_store_commission_bps: number }).peer_store_commission_bps);
  return Number.isFinite(bps) && bps > 0 ? bps : 0;
}
