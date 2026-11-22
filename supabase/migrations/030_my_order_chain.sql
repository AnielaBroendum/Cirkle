-- =============================================================================
-- PASS-ON CHAIN, PART D: the people in a chain see it
--
-- get_my_order_chain(p_order)  the chain of one order (store, givers, buyer,
--   chain_id; see order_chain_detail, 029) for the buyer of the order or any
--   giver in its chain. Anyone else gets null. No store share, no user ids.
-- get_my_order_chains()        the same for every order the caller bought
--   (Your orders list).
-- get_my_passed_on()           orders bought from a pass-on the caller is part
--   of: product, buyer's first name, date, whether the caller passed it on
--   directly (then the points they earned) or further up the chain (then the
--   first name of the friend it went through). Cancelled orders left out.
--   No price, address or other order details.
-- =============================================================================

create or replace function public.get_my_order_chain(p_order uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_chain jsonb;
begin
  if v_me is null then
    return null;
  end if;
  v_chain := order_chain_detail(p_order);
  if v_chain is null then
    return null;
  end if;
  if not exists (select 1 from orders where id = p_order and consumer_user_id = v_me)
     and not (v_chain -> 'giver_ids') ? v_me::text then
    return null;
  end if;
  return v_chain - 'giver_ids' - 'store_share_dkk';
end;
$$;
revoke all on function public.get_my_order_chain(uuid) from public;
grant execute on function public.get_my_order_chain(uuid) to authenticated;

create or replace function public.get_my_order_chains()
returns table (order_id uuid, chain jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, order_chain_detail(o.id) - 'giver_ids' - 'store_share_dkk'
  from orders o
  where o.consumer_user_id = auth.uid();
$$;
revoke all on function public.get_my_order_chains() from public;
grant execute on function public.get_my_order_chains() to authenticated;

create or replace function public.get_my_passed_on()
returns table (
  order_id uuid,
  product_id uuid,
  product_name text,
  buyer text,
  bought_at timestamptz,
  direct boolean,
  via text,
  points int
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  r record;
  v_chain jsonb;
  v_ids jsonb;
  v_pos int;
begin
  if v_me is null then
    return;
  end if;
  for r in
    select distinct a.order_id, a.source_user_id, a.points_amount, o.created_at, o.consumer_user_id
    from attributions a
    join orders o on o.id = a.order_id
    where a.attribution_type = 'peer'
      and o.status <> 'cancelled'
      and o.consumer_user_id <> v_me
      and (
        a.source_user_id = v_me
        or a.chain_id in (select s.chain_id from scans s where s.source_user_id = v_me and s.chain_id is not null)
      )
  loop
    v_chain := order_chain_detail(r.order_id);
    v_ids := v_chain -> 'giver_ids';
    if not v_ids ? v_me::text then
      continue;
    end if;
    -- The friend right after me in the chain (who passed it to the buyer, or on).
    select t.i::int into v_pos from jsonb_array_elements_text(v_ids) with ordinality as t(g, i) where t.g = v_me::text limit 1;
    order_id := r.order_id;
    select oi.product_id, oi.product_name into product_id, product_name
    from order_items oi where oi.order_id = r.order_id order by oi.created_at limit 1;
    buyer := v_chain ->> 'buyer';
    bought_at := r.created_at;
    direct := r.source_user_id = v_me;
    via := case when direct then null else first_name_of((v_ids ->> v_pos)::uuid) end;
    points := case when direct then r.points_amount else null end;
    return next;
  end loop;
end;
$$;
revoke all on function public.get_my_passed_on() from public;
grant execute on function public.get_my_passed_on() to authenticated;
