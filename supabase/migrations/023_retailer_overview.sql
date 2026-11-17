-- =============================================================================
-- RETAIL DASHBOARD (Portals v2; Figma "Retail Portal v2 / 02 Dashboard" 359:204)
--
-- Read-only. Security definer, scoped to the caller's own store like 013 and 016.
-- Months and weeks are calendar months / ISO weeks (Monday) in p_tz.
-- "Credited" = the rows get_retailer_payouts (013) returns: store-credited
-- purchases with a store cut, cancelled orders and returned items left out.
--
--   scans / saves         events in the store (retailer_id = store) this month,
--                         last month, and weekly counts for the last 7 weeks
--   purchases             credited purchases (one per order) by order date, same
--                         month / last month / weeks
--   earned_month          store cut on purchases credited this month, split by
--   earned_ready /        payout status (Return period → Ready → Paid out, 013)
--   earned_return_period /
--   earned_paid_out
--   last_paid_out_at      latest paid_out_at over every credited purchase
--   next_payout           next payout date (payout_period, 016)
--   earnings_week/_month/_year
--                         store cut on credited purchases per bucket by order
--                         date: last 7 weeks, last 7 months, last 3 years
--   latest                the 50 newest credited purchases with payout status and
--                         the first item's product image
--   missing_tags          active samples in the store whose tag has never been
--                         printed (no tag_prints row). tag_prints has no policies,
--                         so this needs security definer
-- =============================================================================

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
