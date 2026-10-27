-- =============================================================================
-- BRAND DASHBOARD AGGREGATES (Figma update, Part B; Figma "Brand Portal / 02")
-- One call returns every block on the dashboard, counted in the database from
-- the events table (008) for the calling brand only.
--
-- Filters: product, store and size, plus the period [p_start, p_end) and the
-- previous period [p_prev_start, p_start) for the "vs. last …" deltas.
-- Size rule: scans have no size, so a size filter never narrows scans (they
-- count every size of the product); saves and purchases follow the size.
-- Purchases on cancelled orders don't count.
-- =============================================================================

create or replace function public.get_brand_dashboard(
  p_start timestamptz,
  p_prev_start timestamptz,
  p_end timestamptz,
  p_product uuid default null,
  p_retailer uuid default null,
  p_size text default null,
  p_bucket text default 'day', -- 'hour' | 'day' | 'month', for the activity chart
  p_tz text default 'Europe/Copenhagen'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_brand uuid;
  v_result jsonb;
begin
  select id into v_brand from brand_profiles where user_id = auth.uid();
  if v_brand is null then
    return null;
  end if;
  if p_bucket not in ('hour', 'day', 'month') then
    raise exception 'invalid bucket %', p_bucket;
  end if;

  with ev as (
    -- All filtered events from the previous period start to the end.
    select e.*
    from events e
    left join orders o on o.id = e.order_id
    where e.brand_id = v_brand
      and e.occurred_at >= p_prev_start and e.occurred_at < p_end
      and (p_product is null or e.product_id = p_product)
      and (p_retailer is null or e.retailer_id = p_retailer)
      and (p_size is null or e.type = 'scan' or e.size = p_size)
      and (e.type <> 'purchase' or o.status is distinct from 'cancelled')
  ),
  cur as (select * from ev where occurred_at >= p_start),
  prev as (select * from ev where occurred_at < p_start),
  -- Store cut: real commission on the orders behind the filtered purchases.
  cut as (
    select a.id, a.source_retailer_id, a.commission_amount_dkk, a.attribution_type, a.created_at, o.order_number
    from attributions a
    join orders o on o.id = a.order_id
    where a.order_id in (select order_id from cur where type = 'purchase' and order_id is not null)
      and a.source_retailer_id is not null
      and a.commission_amount_dkk is not null
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'scans', (select count(*) from cur where type = 'scan'),
      'saves', (select count(*) from cur where type = 'save'),
      'purchases', (select coalesce(sum(quantity), 0) from cur where type = 'purchase'),
      'sales', (select coalesce(sum(quantity * unit_price_dkk), 0) from cur where type = 'purchase'),
      'store_cut', (select coalesce(sum(commission_amount_dkk), 0) from cut),
      'prev_scans', (select count(*) from prev where type = 'scan'),
      'prev_saves', (select count(*) from prev where type = 'save'),
      'prev_purchases', (select coalesce(sum(quantity), 0) from prev where type = 'purchase')
    ),
    'saves_by_size', coalesce((
      select jsonb_agg(jsonb_build_object('size', size, 'saves', n))
      from (select size, count(*) n from cur where type = 'save' group by size) s
    ), '[]'::jsonb),
    'chart', coalesce((
      select jsonb_agg(jsonb_build_object('t', t, 'scans', scans, 'saves', saves, 'purchases', purchases) order by t)
      from (
        select date_trunc(p_bucket, occurred_at at time zone p_tz) t,
               count(*) filter (where type = 'scan') scans,
               count(*) filter (where type = 'save') saves,
               coalesce(sum(quantity) filter (where type = 'purchase'), 0) purchases
        from cur group by 1
      ) c
    ), '[]'::jsonb),
    'by_store', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.retailer_id, 'name', rp.name, 'scans', s.scans, 'buys', s.buys,
                                          'cut', coalesce(c.cut, 0)) order by s.scans desc, s.buys desc)
      from (
        select retailer_id,
               count(*) filter (where type = 'scan') scans,
               coalesce(sum(quantity) filter (where type = 'purchase'), 0) buys
        from cur where retailer_id is not null group by retailer_id
        order by 2 desc, 3 desc limit 5
      ) s
      join retailer_profiles rp on rp.id = s.retailer_id
      left join (select source_retailer_id, sum(commission_amount_dkk) cut from cut group by 1) c
        on c.source_retailer_id = s.retailer_id
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.product_id, 'name', p.name, 'scans', t.scans, 'buys', t.buys)
                       order by t.scans desc, t.buys desc)
      from (
        select product_id,
               count(*) filter (where type = 'scan') scans,
               coalesce(sum(quantity) filter (where type = 'purchase'), 0) buys
        from cur group by product_id
        order by 2 desc, 3 desc limit 5
      ) t
      join products p on p.id = t.product_id
    ), '[]'::jsonb),
    'commissions', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'retailer_name', rp.name, 'amount_dkk', c.commission_amount_dkk,
                                          'type', c.attribution_type, 'order_number', c.order_number,
                                          'created_at', c.created_at) order by c.created_at desc)
      from cut c join retailer_profiles rp on rp.id = c.source_retailer_id
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'type', r.type, 'product', p.name, 'store', rp.name,
                                          'size', r.size, 'time', r.occurred_at) order by r.occurred_at desc)
      from (select * from cur order by occurred_at desc limit 8) r
      join products p on p.id = r.product_id
      left join retailer_profiles rp on rp.id = r.retailer_id
    ), '[]'::jsonb),
    -- Deposits are a balance, not a period: product, store and sample size apply.
    'deposits', coalesce((
      select jsonb_agg(jsonb_build_object('retailer_name', rp.name, 'total', d.total) order by d.total desc)
      from (
        select retailer_id, sum(deposit_amount_dkk) total
        from samples
        where brand_id = v_brand and deposit_status = 'held'
          and (p_product is null or product_id = p_product)
          and (p_retailer is null or retailer_id = p_retailer)
          and (p_size is null or size = p_size)
        group by retailer_id
      ) d join retailer_profiles rp on rp.id = d.retailer_id
    ), '[]'::jsonb),
    'active_samples', (
      select count(*) from samples
      where brand_id = v_brand and status = 'active'
        and (p_product is null or product_id = p_product)
        and (p_retailer is null or retailer_id = p_retailer)
        and (p_size is null or size = p_size)
    ),
    'pending_orders', (select count(*) from orders where brand_id = v_brand and status = 'pending')
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_brand_dashboard(timestamptz, timestamptz, timestamptz, uuid, uuid, text, text, text) from public;
grant execute on function public.get_brand_dashboard(timestamptz, timestamptz, timestamptz, uuid, uuid, text, text, text) to authenticated;

-- Filter options: the stores where this brand's events or samples happened.
create or replace function public.get_brand_dashboard_stores()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct rp.id, rp.name
  from retailer_profiles rp
  join brand_profiles bp on bp.user_id = auth.uid()
  where rp.id in (select retailer_id from events where brand_id = bp.id and retailer_id is not null)
     or rp.id in (select retailer_id from samples where brand_id = bp.id)
  order by rp.name;
$$;

revoke all on function public.get_brand_dashboard_stores() from public;
grant execute on function public.get_brand_dashboard_stores() to authenticated;
