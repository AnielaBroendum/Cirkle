import type { OrderChain } from '@/lib/database.types';

/**
 * "Found at [store] · Passed on by [giver]" for the buyer (get_my_order_chain, 030).
 * Only the parts that exist; null when there is nothing to say.
 */
export function chainLine(chain: Pick<OrderChain, 'store' | 'giver' | 'passed_on'> | null | undefined): string | null {
  if (!chain) return null;
  const parts = [
    chain.store ? `Found at ${chain.store}` : null,
    chain.passed_on && chain.giver ? `Passed on by ${chain.giver}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
