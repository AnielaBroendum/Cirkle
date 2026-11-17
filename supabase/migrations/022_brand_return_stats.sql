-- =============================================================================
-- RETURNS TILES (Portals v2; Figma "Brand Portal v2 / 07 Returns" 367:400)
--
-- Read-only. Security definer, scoped to the caller's own brand.
-- Months are calendar months in p_tz (Europe/Copenhagen by default).
--   waiting           return requests waiting for the brand (status requested)
--   oldest_waiting_at when the oldest of those was requested
--   rate / prev_rate  return rate this month and last month, in percent (1 decimal):
--                     return requests made in the month that weren't declined,
--                     ÷ pieces sold in the month (order items on orders that
--                     aren't cancelled). Null when nothing was sold
--   refunded_amount   refunds marked this month, in øre (price × quantity of the
--   refunded_count    returned item). There is no refunded_at column: the month
--                     is taken from the return's updated_at, which is set when
--                     it is marked refunded and not changed after that
--   top_reason        most common reason over all returns that weren't declined,
--                     with Too big + Too small counted together as "size":
--                     reason key, its count and the total
-- =============================================================================

create or replace function public.get_brand_return_stats(p_tz text default 'Europe/Copenhagen')
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
    with ret as (
      select r.status, r.reason, r.created_at, r.updated_at, oi.quantity * oi.unit_price_dkk as amount
      from returns r
      join orders o on o.id = r.order_id
      join order_items oi on oi.id = r.order_item_id
      where o.brand_id = v_brand
    ),
    sold as (
      select o.created_at, oi.quantity
      from order_items oi
      join orders o on o.id = oi.order_id
      where o.brand_id = v_brand and o.status <> 'cancelled'
    ),
    reasons as (
      select case when reason in ('too_big', 'too_small') then 'size' else reason::text end as reason, count(*) as n
      from ret where status <> 'rejected'
      group by 1
    ),
    rates as (
      select
        (select count(*) from ret where status <> 'rejected' and created_at >= v_month) as ret_cur,
        (select count(*) from ret where status <> 'rejected' and created_at >= v_prev and created_at < v_month) as ret_prev,
        (select coalesce(sum(quantity), 0) from sold where created_at >= v_month) as sold_cur,
        (select coalesce(sum(quantity), 0) from sold where created_at >= v_prev and created_at < v_month) as sold_prev
    )
    select jsonb_build_object(
      'waiting', (select count(*) from ret where status = 'requested'),
      'oldest_waiting_at', (select min(created_at) from ret where status = 'requested'),
      'rate', (select case when sold_cur = 0 then null else round(ret_cur * 100.0 / sold_cur, 1) end from rates),
      'prev_rate', (select case when sold_prev = 0 then null else round(ret_prev * 100.0 / sold_prev, 1) end from rates),
      'refunded_amount', (select coalesce(sum(amount), 0) from ret where status = 'refunded' and updated_at >= v_month),
      'refunded_count', (select count(*) from ret where status = 'refunded' and updated_at >= v_month),
      'top_reason', (
        select jsonb_build_object('reason', reason, 'count', n, 'total', (select sum(n) from reasons))
        from reasons order by n desc, reason limit 1
      )
    )
  );
end;
$$;

grant execute on function public.get_brand_return_stats(text) to authenticated;
