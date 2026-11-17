-- =============================================================================
-- EDIT PRODUCT → IN STORES (Portals v2; Figma "Brand Portal v2 / 04 Edit product" 364:587)
--
-- Read-only. Security definer, scoped to the caller's own brand.
-- One row per store with an active partnership: whether the product is placed
-- there (an active sample) and how often it was scanned there (all time, from
-- events). p_product null (a new product) gives every store unplaced, 0 scans.
-- A product of another brand gives no rows.
-- =============================================================================

create or replace function public.get_product_store_scans(p_product uuid default null)
returns table (retailer_id uuid, name text, placed boolean, scans bigint)
language sql
stable
security definer
set search_path = public
as $$
  with bp as (select id from brand_profiles where user_id = auth.uid())
  select x.retailer_id,
    r.name,
    exists (
      select 1 from samples s
      where s.product_id = p_product and s.retailer_id = x.retailer_id
        and s.brand_id = (select id from bp) and s.status = 'active'
    ) as placed,
    (
      select count(*) from events e
      where e.type = 'scan' and e.product_id = p_product and e.retailer_id = x.retailer_id
        and e.brand_id = (select id from bp)
    ) as scans
  from brand_retailer_partnerships x
  join retailer_profiles r on r.id = x.retailer_id
  where x.brand_id = (select id from bp)
    and x.status = 'active'
    and (p_product is null or exists (select 1 from products p where p.id = p_product and p.brand_id = (select id from bp)))
  order by r.name;
$$;

grant execute on function public.get_product_store_scans(uuid) to authenticated;
