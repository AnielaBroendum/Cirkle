-- =============================================================================
-- PASS-ON CHAIN, PART E: Top stores on the brand dashboard
--
-- get_brand_top_stores(p_start, p_end, p_product, p_retailer, p_limit)
--   Stores ranked by scans in [p_start, p_end), most first (ties by name).
--   A store's scans = scans of its own tags plus scans of QRs passed on from
--   it. One number per store. Counted from scan events, like every other
--   number on the dashboard (009), so seed events count too:
--     tag scan        events.retailer_id (the store on the tag)
--     passed-on scan  events.retailer_id is null; the store is the scan's
--                     scans.origin_retailer_id (026), where the chain started
--   Only the caller's own brand; optional product and store filters like the
--   rest of the dashboard (scans have no size, so the size filter doesn't
--   apply). Read-only: events.retailer_id and source_retailer_id are not
--   changed, so no other number moves.
-- =============================================================================

create or replace function public.get_brand_top_stores(
  p_start timestamptz,
  p_end timestamptz,
  p_product uuid default null,
  p_retailer uuid default null,
  p_limit int default 5
)
returns table (retailer_id uuid, name text, scans bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(e.retailer_id, sc.origin_retailer_id) as retailer_id, rp.name, count(*) as scans
  from events e
  left join scans sc on sc.id = e.scan_id and e.retailer_id is null
  join retailer_profiles rp on rp.id = coalesce(e.retailer_id, sc.origin_retailer_id)
  where e.type = 'scan'
    and e.brand_id = (select id from brand_profiles where user_id = auth.uid())
    and e.occurred_at >= p_start and e.occurred_at < p_end
    and (p_product is null or e.product_id = p_product)
    and (p_retailer is null or coalesce(e.retailer_id, sc.origin_retailer_id) = p_retailer)
  group by 1, rp.name
  order by count(*) desc, rp.name
  limit greatest(coalesce(p_limit, 5), 0);
$$;

revoke all on function public.get_brand_top_stores(timestamptz, timestamptz, uuid, uuid, int) from public;
grant execute on function public.get_brand_top_stores(timestamptz, timestamptz, uuid, uuid, int) to authenticated;
