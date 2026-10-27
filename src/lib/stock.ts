// Sold-out rules shared by the product page and checkout (Figma 04b "Sold out").

export type VariantStock = { size: string | null; color: string | null; stock_count: number };

/**
 * A size is sold out when the brand tracks stock for it (has variant rows) and
 * none of them has stock left. With a colour chosen, only that colour counts.
 * Sizes without variant rows aren't tracked, so they stay available.
 */
export function isSoldOut(variants: VariantStock[], size: string | null, color?: string | null): boolean {
  if (!size) return false;
  const rows = variants.filter((v) => v.size === size && (!color || v.color === color || v.color === null));
  return rows.length > 0 && rows.every((v) => v.stock_count <= 0);
}
