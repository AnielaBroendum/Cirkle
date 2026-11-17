-- =============================================================================
-- PRODUCTS IN THE STORE (Portals v2; Figma "Retail Portal v2 / 03 Products in the store" 368:558)
--
-- Read-only. Security definer, scoped to the caller's own store like 013.
-- One row per product with at least one active sample in the store:
--   sample_ids     the product's active samples with a QR tag, oldest first
--                  (Print tag re-prints these codes through /print/tags)
--   scans          scans of the product in this store, all time (events, 008)
--   buys           pieces bought after a scan in this store, all time; purchases
--                  on cancelled orders don't count (same rule as
--                  get_retailer_most_scanned, 013)
--   price_min/max  lowest and highest price of the product's variants (variant
--                  price or the product price, 015); equal when there are none
--   placed_at      when the oldest active sample was created
-- =============================================================================

create or replace function public.get_retailer_product_stats()
returns table (
  product_id uuid,
  product_name text,
  brand_id uuid,
  brand_name text,
  image text,
  price_min int,
  price_max int,
  sample_ids uuid[],
  placed_at timestamptz,
  scans bigint,
  buys bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with store as (select id from retailer_profiles where user_id = auth.uid()),
  placed as (
    select s.product_id,
           array_agg(s.id order by s.created_at) filter (where s.qr_code_url is not null) as sample_ids,
           min(s.created_at) as placed_at
    from samples s
    where s.retailer_id = (select id from store) and s.status = 'active'
    group by s.product_id
  ),
  ev as (
    select e.product_id,
           count(*) filter (where e.type = 'scan') as scans,
           coalesce(sum(e.quantity) filter (where e.type = 'purchase'), 0)::bigint as buys
    from events e
    left join orders o on o.id = e.order_id
    where e.retailer_id = (select id from store)
      and e.type in ('scan', 'purchase')
      and (e.type <> 'purchase' or o.status is distinct from 'cancelled')
    group by e.product_id
  )
  select p.id, p.name, p.brand_id, bp.name, p.images[1],
         coalesce((select min(coalesce(v.price_dkk, p.price_dkk)) from product_variants v where v.product_id = p.id), p.price_dkk),
         coalesce((select max(coalesce(v.price_dkk, p.price_dkk)) from product_variants v where v.product_id = p.id), p.price_dkk),
         coalesce(pl.sample_ids, '{}'),
         pl.placed_at,
         coalesce(ev.scans, 0),
         coalesce(ev.buys, 0)
  from placed pl
  join products p on p.id = pl.product_id
  join brand_profiles bp on bp.id = p.brand_id
  left join ev on ev.product_id = p.id
  order by coalesce(ev.scans, 0) desc, p.name;
$$;

revoke all on function public.get_retailer_product_stats() from public;
grant execute on function public.get_retailer_product_stats() to authenticated;
