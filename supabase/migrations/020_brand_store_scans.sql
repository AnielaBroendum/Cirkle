-- =============================================================================
-- STORES & QR TAGS NUMBERS (Portals v2; Figma "Brand Portal v2 / 05 Stores and QR tags" 365:318)
--
-- Read-only. Security definer, scoped to the caller's own brand.
-- For every store the brand works with (a partnership in any status, or a sample):
--   stores[]         scans of the brand's products in that store (all time) and the
--                    number of products with an active sample there
--   product_scans[]  scans per product per store (all time)
-- Scans come from events (008) by the store on the scanned tag, as on the dashboard
-- and in Edit product → In stores (019), so the numbers agree across screens.
-- =============================================================================

create or replace function public.get_brand_store_scans()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_brand uuid;
begin
  select id into v_brand from brand_profiles where user_id = auth.uid();
  if v_brand is null then
    return null;
  end if;

  return (
    with st as (
      select retailer_id from brand_retailer_partnerships where brand_id = v_brand and retailer_id is not null
      union
      select retailer_id from samples where brand_id = v_brand
    ),
    sc as (
      select e.retailer_id, e.product_id, count(*) as scans
      from events e
      where e.brand_id = v_brand and e.type = 'scan' and e.retailer_id in (select retailer_id from st)
      group by e.retailer_id, e.product_id
    )
    select jsonb_build_object(
      'stores', coalesce((
        select jsonb_agg(jsonb_build_object(
          'retailer_id', st.retailer_id,
          'scans', coalesce((select sum(scans) from sc where sc.retailer_id = st.retailer_id), 0),
          'products', (
            select count(distinct s.product_id) from samples s
            where s.retailer_id = st.retailer_id and s.brand_id = v_brand and s.status = 'active'
          )
        ))
        from st
      ), '[]'::jsonb),
      'product_scans', coalesce((
        select jsonb_agg(jsonb_build_object('retailer_id', retailer_id, 'product_id', product_id, 'scans', scans)) from sc
      ), '[]'::jsonb)
    )
  );
end;
$$;

grant execute on function public.get_brand_store_scans() to authenticated;
