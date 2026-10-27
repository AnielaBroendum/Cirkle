-- =============================================================================
-- RETAILER PAYOUTS AND MOST SCANNED (Figma update run 2, Part A;
-- Figma "Retail Portal / 02 Dashboard")
--
-- Each purchase credited to a store moves Return period → Ready → Paid out.
-- The status is derived from dates, never stored:
--   - Return period: not delivered yet, the return period hasn't ended, or a
--     return request is still open
--   - Ready: the return period has ended, waiting for the next payout date
--   - Paid out: paid_out_at is set
-- Cancelled orders and returned items (return approved, received or refunded)
-- aren't credited and are left out.
--
-- The return period length lives in the app (RETURN_PERIOD_DAYS in
-- src/lib/payouts.ts) and is written onto the order when it is delivered, so
-- a later change doesn't move old deadlines. The backfill below uses 14.
-- =============================================================================

alter table public.orders add column return_period_ends_at timestamptz;
alter table public.attributions add column paid_out_at timestamptz; -- no payout job yet

update public.orders
set return_period_ends_at = delivered_at + interval '14 days'
where delivered_at is not null and return_period_ends_at is null;

-- Every credited purchase for the calling store, newest first.
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
  payout_status text
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
    where a.source_retailer_id = (select id from store)
      and a.commission_amount_dkk is not null
      and o.status <> 'cancelled'
  )
  select c.id, c.order_id,
         (select oi.product_name from order_items oi where oi.order_id = c.order_id order by oi.created_at limit 1),
         bp.name,
         c.ordered_at, c.delivered_at, c.return_period_ends_at, c.paid_out_at,
         c.commission_amount_dkk,
         case
           when c.paid_out_at is not null then 'paid_out'
           when c.return_period_ends_at is null or c.return_period_ends_at > now() or c.return_open then 'return_period'
           else 'ready'
         end
  from credited c
  join brand_profiles bp on bp.id = c.brand_id
  where not c.returned
  order by c.ordered_at desc;
$$;

revoke all on function public.get_retailer_payouts() from public;
grant execute on function public.get_retailer_payouts() to authenticated;

-- Scans and purchases per product in the calling store for [p_start, p_end).
-- Purchases on cancelled orders don't count (same rule as get_brand_dashboard).
create or replace function public.get_retailer_most_scanned(
  p_start timestamptz,
  p_end timestamptz,
  p_limit int default 5
)
returns table (product_id uuid, product_name text, brand_name text, scans bigint, buys bigint)
language sql
stable
security definer
set search_path = public
as $$
  select t.product_id, p.name, bp.name, t.scans, t.buys
  from (
    select e.product_id,
           count(*) filter (where e.type = 'scan') as scans,
           coalesce(sum(e.quantity) filter (where e.type = 'purchase'), 0)::bigint as buys
    from events e
    left join orders o on o.id = e.order_id
    where e.retailer_id = (select id from retailer_profiles where user_id = auth.uid())
      and e.occurred_at >= p_start and e.occurred_at < p_end
      and e.type in ('scan', 'purchase')
      and (e.type <> 'purchase' or o.status is distinct from 'cancelled')
    group by e.product_id
  ) t
  join products p on p.id = t.product_id
  join brand_profiles bp on bp.id = p.brand_id
  where t.scans > 0 or t.buys > 0
  order by t.scans desc, t.buys desc
  limit p_limit;
$$;

revoke all on function public.get_retailer_most_scanned(timestamptz, timestamptz, int) from public;
grant execute on function public.get_retailer_most_scanned(timestamptz, timestamptz, int) to authenticated;
