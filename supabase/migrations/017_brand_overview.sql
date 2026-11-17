-- =============================================================================
-- BRAND DASHBOARD v2 EXTRAS (Portals v2; Figma "Brand Portal v2 / 02 Dashboard" 358:161)
--
-- Read-only. Security definer, scoped to the caller's own brand like 009 and 016.
-- Adds what get_brand_dashboard (009) doesn't return:
--   stand         "Where things stand": live Done / Moving / Waiting per area
--   saves_by_size saves per size in the last p_saves_days days and the same
--                 number of days before that (for "M is up 24%")
--   buy_rate      purchases ÷ scans in [p_start, p_end), in percent, 1 decimal
--
-- Filters (product, store, size) work as in 009. "Where things stand" is live
-- (no period): product and store narrow every row; size narrows orders and
-- returns (by the ordered size). Definitions:
--   Products  done = in a store (active sample); moving = on an open sample
--             request (pending / approved / shipped); waiting = neither
--   Stores    done = active partnership with an active sample of this brand;
--             moving = active without one; waiting = invited, not accepted
--   Orders    done = delivered; moving = confirmed / packed / shipped;
--             waiting = pending. Cancelled orders are left out
--   Returns   done = refunded / rejected; moving = approved / received;
--             waiting = requested
-- =============================================================================

create or replace function public.get_brand_overview(
  p_start timestamptz,
  p_end timestamptz,
  p_saves_days int default 28,
  p_product uuid default null,
  p_retailer uuid default null,
  p_size text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_brand uuid;
  v_now timestamptz := now();
begin
  select id into v_brand from brand_profiles where user_id = auth.uid();
  if v_brand is null then
    return null;
  end if;
  if p_saves_days not between 1 and 366 then
    raise exception 'invalid saves range %', p_saves_days;
  end if;

  return (
    with prod as (
      select p.id,
        exists (
          select 1 from samples s
          where s.product_id = p.id and s.brand_id = v_brand and s.status = 'active'
            and (p_retailer is null or s.retailer_id = p_retailer)
        ) as placed,
        exists (
          select 1 from sample_request_items i
          join sample_requests r on r.id = i.request_id
          where i.product_id = p.id and r.brand_id = v_brand
            and r.status in ('pending', 'approved', 'shipped')
            and (p_retailer is null or r.retailer_id = p_retailer)
        ) as requested
      from products p
      where p.brand_id = v_brand and (p_product is null or p.id = p_product)
    ),
    stores as (
      select x.status,
        exists (
          select 1 from samples s
          where s.retailer_id = x.retailer_id and s.brand_id = v_brand and s.status = 'active'
            and (p_product is null or s.product_id = p_product)
        ) as stocked
      from brand_retailer_partnerships x
      where x.brand_id = v_brand and x.status in ('active', 'invited')
        and (p_retailer is null or x.retailer_id = p_retailer)
    ),
    ord as (
      select o.id, o.status
      from orders o
      where o.brand_id = v_brand and o.status <> 'cancelled'
        and (p_product is null and p_size is null or exists (
          select 1 from order_items oi
          where oi.order_id = o.id
            and (p_product is null or oi.product_id = p_product)
            and (p_size is null or oi.size = p_size)
        ))
        and (p_retailer is null or exists (
          select 1 from attributions a where a.order_id = o.id and a.source_retailer_id = p_retailer
        ))
    ),
    ret as (
      select r.status
      from returns r
      join order_items oi on oi.id = r.order_item_id
      join orders o on o.id = r.order_id
      where o.brand_id = v_brand
        and (p_product is null or oi.product_id = p_product)
        and (p_size is null or oi.size = p_size)
        and (p_retailer is null or exists (
          select 1 from attributions a where a.order_id = o.id and a.source_retailer_id = p_retailer
        ))
    ),
    sv as (
      select e.size, e.occurred_at >= v_now - make_interval(days => p_saves_days) as is_cur
      from events e
      where e.brand_id = v_brand and e.type = 'save'
        and e.occurred_at >= v_now - make_interval(days => 2 * p_saves_days) and e.occurred_at < v_now
        and (p_product is null or e.product_id = p_product)
        and (p_retailer is null or e.retailer_id = p_retailer)
        and (p_size is null or e.size = p_size)
    ),
    fun as (
      select e.type, e.quantity
      from events e
      left join orders o on o.id = e.order_id
      where e.brand_id = v_brand
        and e.occurred_at >= p_start and e.occurred_at < p_end
        and e.type in ('scan', 'purchase')
        and (p_product is null or e.product_id = p_product)
        and (p_retailer is null or e.retailer_id = p_retailer)
        and (p_size is null or e.type = 'scan' or e.size = p_size)
        and (e.type <> 'purchase' or o.status is distinct from 'cancelled')
    )
    select jsonb_build_object(
      'stand', jsonb_build_object(
        'products', jsonb_build_object(
          'total', (select count(*) from prod),
          'done', (select count(*) from prod where placed),
          'moving', (select count(*) from prod where not placed and requested),
          'waiting', (select count(*) from prod where not placed and not requested)
        ),
        'stores', jsonb_build_object(
          'total', (select count(*) from stores),
          'done', (select count(*) from stores where status = 'active' and stocked),
          'moving', (select count(*) from stores where status = 'active' and not stocked),
          'waiting', (select count(*) from stores where status = 'invited')
        ),
        'orders', jsonb_build_object(
          'total', (select count(*) from ord),
          'done', (select count(*) from ord where status = 'delivered'),
          'moving', (select count(*) from ord where status in ('confirmed', 'packed', 'shipped')),
          'waiting', (select count(*) from ord where status = 'pending')
        ),
        'returns', jsonb_build_object(
          'total', (select count(*) from ret),
          'done', (select count(*) from ret where status in ('refunded', 'rejected')),
          'moving', (select count(*) from ret where status in ('approved', 'received')),
          'waiting', (select count(*) from ret where status = 'requested')
        )
      ),
      'saves_by_size', coalesce((
        select jsonb_agg(jsonb_build_object('size', size, 'saves', cur, 'prev', prev))
        from (
          select size, count(*) filter (where is_cur) as cur, count(*) filter (where not is_cur) as prev
          from sv group by size
        ) s
      ), '[]'::jsonb),
      'buy_rate', (
        select case when count(*) filter (where type = 'scan') = 0 then null
          else round(
            coalesce(sum(quantity) filter (where type = 'purchase'), 0) * 100.0
              / count(*) filter (where type = 'scan'), 1)
        end
        from fun
      )
    )
  );
end;
$$;

grant execute on function public.get_brand_overview(timestamptz, timestamptz, int, uuid, uuid, text) to authenticated;
