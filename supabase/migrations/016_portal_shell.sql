-- =============================================================================
-- PORTAL SHELL (Portals v2, Part B; Figma "Portals v2 · Dynamic", sidebar 358:170)
--
-- Read-only. One call per portal for the sidebar: nav counts and the Next payout
-- box. Security definer, scoped to the caller's own brand / store like 009 and 013.
--
-- Payout period: Flaym pays out on day p_payout_day of every month
-- (PAYOUT_DAY_OF_MONTH in src/lib/payouts.ts). The next payout is that day this
-- month if it hasn't passed (today counts), otherwise next month. The period runs
-- from the payout day before it. Dates are Europe/Copenhagen.
-- =============================================================================

create or replace function public.payout_period(p_payout_day int default 1)
returns table (period_start date, next_payout date)
language sql
stable
set search_path = public
as $$
  with t as (select (now() at time zone 'Europe/Copenhagen')::date as today),
  n as (
    select case
      when make_date(extract(year from today)::int, extract(month from today)::int, p_payout_day) >= today
        then make_date(extract(year from today)::int, extract(month from today)::int, p_payout_day)
      else (make_date(extract(year from today)::int, extract(month from today)::int, p_payout_day) + interval '1 month')::date
    end as next_payout
    from t
  )
  select (next_payout - interval '1 month')::date, next_payout from n;
$$;

grant execute on function public.payout_period(int) to authenticated;

-- -----------------------------------------------------------------------------
-- Brand: nav counts + estimated payout.
--   products       all of the brand's products
--   stores         stores with an active partnership
--   orders         not shipped yet (same rule as get_brand_nav_counts)
--   returns        waiting for the brand to act (same rule as get_brand_nav_counts)
--   payout_amount  ESTIMATE in øre: sales via Flaym in the payout period minus
--                  the store cut on those orders. Cancelled orders and returned
--                  items (approved, received, refunded) are left out. No Flaym
--                  fee: the app has none yet.
-- -----------------------------------------------------------------------------
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
    select coalesce(sum(a.commission_amount_dkk), 0) as amount
    from attributions a
    where a.order_id in (select distinct order_id from sold)
      and a.source_retailer_id is not null
      and a.commission_amount_dkk is not null
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

-- -----------------------------------------------------------------------------
-- Store: nav count + payout box, from the same rules as get_retailer_payouts (013).
--   products              distinct products with an active sample in the store
--   payout_amount         every credited cut not paid out yet (ready + return period)
--   ready_amount          paid out on the next payout date
--   return_period_amount  still in the return period
--   last_paid_out_at      latest paid_out_at
-- -----------------------------------------------------------------------------
create or replace function public.get_retailer_portal_shell(p_payout_day int default 1)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with store as (select id from retailer_profiles where user_id = auth.uid()),
  per as (select * from payout_period(p_payout_day)),
  pay as (select * from get_retailer_payouts())
  select case when (select id from store) is null then null else jsonb_build_object(
    'products', (
      select count(distinct s.product_id) from samples s
      where s.retailer_id = (select id from store) and s.status = 'active'
    ),
    'period_start', (select period_start from per),
    'next_payout', (select next_payout from per),
    'payout_amount', (select coalesce(sum(amount_dkk), 0) from pay where payout_status in ('ready', 'return_period')),
    'ready_amount', (select coalesce(sum(amount_dkk), 0) from pay where payout_status = 'ready'),
    'return_period_amount', (select coalesce(sum(amount_dkk), 0) from pay where payout_status = 'return_period'),
    'last_paid_out_at', (select max(paid_out_at) from pay)
  ) end;
$$;

revoke all on function public.get_retailer_portal_shell(int) from public;
grant execute on function public.get_retailer_portal_shell(int) to authenticated;
