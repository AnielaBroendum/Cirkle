-- 015: optional price per variant.
-- When set, product_variants.price_dkk (øre) overrides products.price_dkk for
-- that size/colour; NULL means the product's base price. Checkout reads it on
-- the server (src/lib/pricing.ts), never from the browser.
-- Already applied in the hosted project; IF NOT EXISTS keeps this re-runnable.

alter table public.product_variants
  add column if not exists price_dkk integer
  check (price_dkk is null or price_dkk >= 0);
