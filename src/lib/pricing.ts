// Variant prices (migration 015), shared by the product page, lists and checkout.
// A variant's price_dkk overrides the product's base price; NULL means the base.

import { formatDKK } from './utils';

export type VariantPrice = { size: string | null; color: string | null; price_dkk?: number | null };

export type PriceRange = { min: number; max: number };

/** Label before the lowest price when variants cost different amounts. */
export const FROM_LABEL = 'From';

/**
 * Lowest and highest price for what the shopper has picked so far. With both a
 * size and a colour this is the one variant's price; with less, it spans every
 * variant that still fits. No matching variant rows means the base price.
 */
export function priceRange(
  basePrice: number,
  variants: VariantPrice[],
  size?: string | null,
  color?: string | null
): PriceRange {
  const prices = variants
    .filter((v) => (!size || v.size === size) && (!color || v.color === color))
    .map((v) => v.price_dkk ?? basePrice);
  if (prices.length === 0) return { min: basePrice, max: basePrice };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** "299 kr", or "From 249 kr" when the range isn't a single price. */
export function formatPriceRange({ min, max }: PriceRange): string {
  return min === max ? formatDKK(min) : `${FROM_LABEL} ${formatDKK(min)}`;
}
