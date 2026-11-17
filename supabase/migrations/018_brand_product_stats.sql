-- =============================================================================
-- PRODUCT LIBRARY NUMBERS (Portals v2; Figma "Brand Portal v2 / 03 Product library" 364:238)
--
-- Read-only. Security definer, scoped to the caller's own brand like 009 and 016.
-- Months are calendar months in p_tz (Europe/Copenhagen by default).
--   scans_month       scans of the brand's products this month
--   scans_prev_month  scans last month (for "+18% vs. last month")
--   products[]        per product: scans this month, scans all time, pieces sold
--                     this month (purchases on orders that aren't cancelled) and
--                     the number of stores holding an active sample
-- Scans and purchases come from the events table (008), as on the dashboard.
-- =============================================================================

create or replace function public.get_brand_product_stats(p_tz text default 'Europe/Copenhagen')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_brand uuid;
  v_month timestamptz;
  v_prev timestamptz;
begin
  select id into v_brand from brand_profiles where user_id = auth.uid();
  if v_brand is null then
    return null;
  end if;
  v_month := date_trunc('month', now() at time zone p_tz) at time zone p_tz;
  v_prev := (date_trunc('month', now() at time zone p_tz) - interval '1 month') at time zone p_tz;

  return (
    with ev as (
      select e.type, e.product_id, e.quantity, e.occurred_at
      from events e
      left join orders o on o.id = e.order_id
      where e.brand_id = v_brand
        and e.type in ('scan', 'purchase')
        and (e.type <> 'purchase' or o.status is distinct from 'cancelled')
    )
    select jsonb_build_object(
      'scans_month', (select count(*) from ev where type = 'scan' and occurred_at >= v_month),
      'scans_prev_month', (select count(*) from ev where type = 'scan' and occurred_at >= v_prev and occurred_at < v_month),
      'products', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'scans_month', (select count(*) from ev where ev.product_id = p.id and type = 'scan' and occurred_at >= v_month),
          'scans_total', (select count(*) from ev where ev.product_id = p.id and type = 'scan'),
          'sold_month', (select coalesce(sum(quantity), 0) from ev where ev.product_id = p.id and type = 'purchase' and occurred_at >= v_month),
          'stores', (
            select count(distinct s.retailer_id) from samples s
            where s.product_id = p.id and s.brand_id = v_brand and s.status = 'active'
          )
        ))
        from products p
        where p.brand_id = v_brand
      ), '[]'::jsonb)
    )
  );
end;
$$;

grant execute on function public.get_brand_product_stats(text) to authenticated;
