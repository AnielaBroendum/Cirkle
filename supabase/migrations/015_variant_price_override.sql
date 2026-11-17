-- =============================================================================
-- VARIANT PRICE OVERRIDE
--
-- Already applied in production on 30 Oct 2026 (as "add_variant_price_override",
-- recorded twice) but missing from the repo. Captured here so a database built
-- from these files matches production. Idempotent.
-- =============================================================================

alter table public.product_variants
  add column if not exists price_dkk integer check (price_dkk is null or price_dkk >= 0);

comment on column public.product_variants.price_dkk is
  'Optional price in øre for this variant. NULL = use products.price_dkk. products.price_dkk is the base/"fra"-price.';
