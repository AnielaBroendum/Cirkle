-- =============================================================================
-- PASS-ON CHAIN, PART B2: store share on passed-on purchases (built, switched off)
--
-- platform_settings: one row. peer_store_commission_bps is the share (basis
-- points, like commission_rate 1500 = 15 %) the store where a passed-on product
-- was first scanned gets of the sale. 0 = off (the default). Change it with:
--   update public.platform_settings set peer_store_commission_bps = 500;
-- Read by /api/checkout (service role) when an order is placed.
--
-- attributions.store_commission_rate / store_commission_amount_dkk: the store
-- share on a peer attribution, saved at checkout on the item price (same base as
-- store commission: before points, no delivery fee). Saved per order, so changing
-- the setting never changes old orders. source_retailer_id stays null on peer rows.
--
-- Payouts and earnings: get_retailer_payouts now also returns peer shares where
-- origin_retailer_id is the store, with kind = 'passed_on' (store sales: 'store').
-- get_retailer_portal_shell (016), get_retailer_overview (023, adds 'kind' to
-- 'latest') and get_retailer_profile_stats (025) read it, so they include them.
-- Brand: get_brand_dashboard (009) store cut and get_brand_portal_shell (016)
-- payout box subtract the share like store commission.
-- With the setting at 0 no row has a share, so every number is unchanged.
-- =============================================================================

create table public.platform_settings (
  id boolean primary key default true check (id),
  peer_store_commission_bps integer not null default 0
    check (peer_store_commission_bps between 0 and 10000),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id, peer_store_commission_bps) values (true, 0);
alter table public.platform_settings enable row level security; -- no policies: service role only
create trigger set_updated_at before update on public.platform_settings
  for each row execute function public.handle_updated_at();

alter table public.attributions
  add column store_commission_rate integer check (store_commission_rate between 0 and 10000),
  add column store_commission_amount_dkk integer check (store_commission_amount_dkk >= 0);

-- Return type gains "kind", so drop and recreate. Callers (016, 023, 025) read it by name.
drop function public.get_retailer_payouts();

create or replace function public.get_retailer_payouts()
returns table (
  id uuid,
  order_id uuid,
  product_name text,
  brand_name text,
  ordered_at timestamptz,
  delivered_at timestamptz,
  return_period_ends_at timestamptz,
  paid_out_at timestamptz,
  amount_dkk int,
  payout_status text,
  kind text
)
language sql
stable
security definer
set search_path = public
as $$
  with store as (
    select id from retailer_profiles where user_id = auth.uid()
  ),
  credited as (
    select a.*, o.created_at as ordered_at, o.delivered_at, o.return_period_ends_at, o.brand_id,
           exists (
             select 1 from returns r
             where r.order_id = o.id and r.status in ('approved', 'received', 'refunded')
           ) as returned,
           exists (
             select 1 from returns r where r.order_id = o.id and r.status = 'requested'
           ) as return_open
    from attributions a
    join orders o on o.id = a.order_id
    where (
        -- Store sale: commission on the store's own tag scan.
        (a.source_retailer_id = (select id from store) and a.commission_amount_dkk is not null)
        -- Passed on: share of a sale whose chain started at this store (028).
        or (a.attribution_type = 'peer' and a.origin_retailer_id = (select id from store)
            and a.store_commission_amount_dkk is not null)
      )
      and o.status <> 'cancelled'
  )
  select c.id, c.order_id,
         (select oi.product_name from order_items oi where oi.order_id = c.order_id order by oi.created_at limit 1),
         bp.name,
         c.ordered_at, c.delivered_at, c.return_period_ends_at, c.paid_out_at,
         case when c.attribution_type = 'peer' then c.store_commission_amount_dkk else c.commission_amount_dkk end,
         case
           when c.paid_out_at is not null then 'paid_out'
           when c.return_period_ends_at is null or c.return_period_ends_at > now() or c.return_open then 'return_period'
           else 'ready'
         end,
         case when c.attribution_type = 'peer' then 'passed_on' else 'store' end
  from credited c
  join brand_profiles bp on bp.id = c.brand_id
  where not c.returned
  order by c.ordered_at desc;
$$;

revoke all on function public.get_retailer_payouts() from public;
grant execute on function public.get_retailer_payouts() to authenticated;

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
    -- Includes a store's share of a passed-on sale (028), credited to the chain's store.
    select a.id,
           coalesce(a.source_retailer_id, a.origin_retailer_id) as source_retailer_id,
           coalesce(a.commission_amount_dkk, a.store_commission_amount_dkk) as commission_amount_dkk,
           a.attribution_type, a.created_at, o.order_number
    from attributions a
    join orders o on o.id = a.order_id
    where a.order_id in (select order_id from cur where type = 'purchase' and order_id is not null)
      and (
        (a.source_retailer_id is not null and a.commission_amount_dkk is not null)
        or (a.attribution_type = 'peer' and a.origin_retailer_id is not null and a.store_commission_amount_dkk is not null)
      )
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

create or replace function public.get_brand_portal_shell(p_payout_day int default 1)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bp as (select id from brand_profiles where user_id = auth.uid()),
  per as (select * from payout_period(p_payout_day)),
  sold as (
    select oi.order_id, oi.quantity * oi.unit_price_dkk as amount
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.brand_id = (select id from bp)
      and o.status <> 'cancelled'
      and (o.created_at at time zone 'Europe/Copenhagen')::date >= (select period_start from per)
      and not exists (
        select 1 from returns r
        where r.order_item_id = oi.id and r.status in ('approved', 'received', 'refunded')
      )
  ),
  cut as (
    select coalesce(sum(coalesce(a.commission_amount_dkk, a.store_commission_amount_dkk)), 0) as amount
    from attributions a
    where a.order_id in (select distinct order_id from sold)
      and (
        (a.source_retailer_id is not null and a.commission_amount_dkk is not null)
        or (a.attribution_type = 'peer' and a.origin_retailer_id is not null and a.store_commission_amount_dkk is not null)
      )
  )
  select case when (select id from bp) is null then null else jsonb_build_object(
    'products', (select count(*) from products p where p.brand_id = (select id from bp)),
    'stores', (
      select count(*) from brand_retailer_partnerships x
      where x.brand_id = (select id from bp) and x.status = 'active'
    ),
    'orders', (
      select count(*) from orders o
      where o.brand_id = (select id from bp) and o.status in ('pending', 'confirmed', 'packed')
    ),
    'returns', (
      select count(*) from returns r join orders o on o.id = r.order_id
      where o.brand_id = (select id from bp) and r.status in ('requested', 'approved', 'received')
    ),
    'period_start', (select period_start from per),
    'next_payout', (select next_payout from per),
    'sales', (select coalesce(sum(amount), 0) from sold),
    'store_cut', (select amount from cut),
    'payout_amount', (select coalesce(sum(amount), 0) from sold) - (select amount from cut)
  ) end;
$$;

revoke all on function public.get_brand_portal_shell(int) from public;
grant execute on function public.get_brand_portal_shell(int) to authenticated;

create or replace function public.get_retailer_overview(
  p_tz text default 'Europe/Copenhagen',
  p_payout_day int default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_local timestamp;
  v_month timestamptz;
  v_prev timestamptz;
  v_week timestamp;
begin
  select id into v_store from retailer_profiles where user_id = auth.uid();
  if v_store is null then
    return null;
  end if;
  v_local := now() at time zone p_tz;
  v_month := date_trunc('month', v_local) at time zone p_tz;
  v_prev := (date_trunc('month', v_local) - interval '1 month') at time zone p_tz;
  v_week := date_trunc('week', v_local);

  return (
    with ev as (
      select e.type, e.occurred_at
      from events e
      where e.retailer_id = v_store and e.type in ('scan', 'save')
    ),
    pay as (select * from get_retailer_payouts()),
    weeks as (
      select g.n, v_week - (g.n || ' weeks')::interval as wk_start
      from generate_series(6, 0, -1) as g(n)
    ),
    months as (
      select g.n, date_trunc('month', v_local) - (g.n || ' months')::interval as m_start
      from generate_series(6, 0, -1) as g(n)
    ),
    years as (
      select g.n, date_trunc('year', v_local) - (g.n || ' years')::interval as y_start
      from generate_series(2, 0, -1) as g(n)
    )
    select jsonb_build_object(
      'scans', jsonb_build_object(
        'month', (select count(*) from ev where type = 'scan' and occurred_at >= v_month),
        'prev_month', (select count(*) from ev where type = 'scan' and occurred_at >= v_prev and occurred_at < v_month),
        'weeks', (
          select jsonb_agg((
            select count(*) from ev
            where type = 'scan'
              and (occurred_at at time zone p_tz) >= w.wk_start
              and (occurred_at at time zone p_tz) < w.wk_start + interval '1 week'
          ) order by w.wk_start)
          from weeks w
        )
      ),
      'saves', jsonb_build_object(
        'month', (select count(*) from ev where type = 'save' and occurred_at >= v_month),
        'prev_month', (select count(*) from ev where type = 'save' and occurred_at >= v_prev and occurred_at < v_month),
        'weeks', (
          select jsonb_agg((
            select count(*) from ev
            where type = 'save'
              and (occurred_at at time zone p_tz) >= w.wk_start
              and (occurred_at at time zone p_tz) < w.wk_start + interval '1 week'
          ) order by w.wk_start)
          from weeks w
        )
      ),
      'purchases', jsonb_build_object(
        'month', (select count(*) from pay where ordered_at >= v_month),
        'prev_month', (select count(*) from pay where ordered_at >= v_prev and ordered_at < v_month),
        'weeks', (
          select jsonb_agg((
            select count(*) from pay
            where (ordered_at at time zone p_tz) >= w.wk_start
              and (ordered_at at time zone p_tz) < w.wk_start + interval '1 week'
          ) order by w.wk_start)
          from weeks w
        )
      ),
      'earned_month', (select coalesce(sum(amount_dkk), 0) from pay where ordered_at >= v_month),
      'earned_ready', (select coalesce(sum(amount_dkk), 0) from pay where ordered_at >= v_month and payout_status = 'ready'),
      'earned_return_period', (select coalesce(sum(amount_dkk), 0) from pay where ordered_at >= v_month and payout_status = 'return_period'),
      'earned_paid_out', (select coalesce(sum(amount_dkk), 0) from pay where ordered_at >= v_month and payout_status = 'paid_out'),
      'last_paid_out_at', (select max(paid_out_at) from pay),
      'next_payout', (select next_payout from payout_period(p_payout_day)),
      'earnings_week', (
        select jsonb_agg(jsonb_build_object(
          'start', w.wk_start::date,
          'amount', (
            select coalesce(sum(amount_dkk), 0) from pay
            where (ordered_at at time zone p_tz) >= w.wk_start
              and (ordered_at at time zone p_tz) < w.wk_start + interval '1 week'
          )
        ) order by w.wk_start)
        from weeks w
      ),
      'earnings_month', (
        select jsonb_agg(jsonb_build_object(
          'start', m.m_start::date,
          'amount', (
            select coalesce(sum(amount_dkk), 0) from pay
            where (ordered_at at time zone p_tz) >= m.m_start
              and (ordered_at at time zone p_tz) < m.m_start + interval '1 month'
          )
        ) order by m.m_start)
        from months m
      ),
      'earnings_year', (
        select jsonb_agg(jsonb_build_object(
          'start', y.y_start::date,
          'amount', (
            select coalesce(sum(amount_dkk), 0) from pay
            where (ordered_at at time zone p_tz) >= y.y_start
              and (ordered_at at time zone p_tz) < y.y_start + interval '1 year'
          )
        ) order by y.y_start)
        from years y
      ),
      'latest', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id,
          'product_name', l.product_name,
          'brand_name', l.brand_name,
          'amount', l.amount_dkk,
          'payout_status', l.payout_status,
          'kind', l.kind,
          'ordered_at', l.ordered_at,
          'return_period_ends_at', l.return_period_ends_at,
          'paid_out_at', l.paid_out_at,
          'image', (
            select p.images[1] from order_items oi
            join products p on p.id = oi.product_id
            where oi.order_id = l.order_id
            order by oi.created_at limit 1
          )
        ) order by l.ordered_at desc)
        from (select * from pay order by ordered_at desc limit 50) l
      ), '[]'::jsonb),
      'missing_tags', coalesce((
        select jsonb_agg(s.id order by s.created_at)
        from samples s
        where s.retailer_id = v_store
          and s.status = 'active'
          and s.qr_code_url is not null
          and not exists (select 1 from tag_prints t where t.sample_id = s.id)
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_retailer_overview(text, int) from public;
grant execute on function public.get_retailer_overview(text, int) to authenticated;
