-- =============================================================================
-- PASS-ON CHAIN, PART C: the brand sees the whole chain
--
-- order_chain_detail(p_order)  internal, not callable by clients. The chain of
--   one order, from the attribution and its scan (026/027):
--     store        attributions.origin_retailer_id, else the scan's; only when
--                  both are null, the old guess from 021 (the giver's earlier
--                  store-credited purchase of the product; store_traced = true)
--     givers       first names, first giver first, by walking parent_scan_id
--     giver        the direct giver's first name (kept from 021)
--     buyer        the customer's first name
--     chain_id     attributions.chain_id, else the scan's
--     store_share_dkk  the store's share of a passed-on sale (028), or null
--     credited     the order has an attribution (false: bought without a scan)
--     passed_on    the attribution is a pass-on (peer)
--     giver_ids    user ids of the givers (stripped before anything is returned
--                  to a client; used to check who may see a chain, 030)
--
-- get_brand_order_chain(p_order)      rewritten: same keys as 021 (store,
--   store_traced, giver, buyer) plus chain_id, givers, store_share_dkk. Still
--   only for an order of the caller's brand.
-- get_brand_order_chains(p_orders[])  the same for many orders (CSV export);
--   orders of other brands are left out.
-- First names only: the brand never sees a full name, email or user id here.
-- =============================================================================

create or replace function public.first_name_of(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(split_part(trim(name), ' ', 1), '') from profiles where id = p_user;
$$;
revoke all on function public.first_name_of(uuid) from public, anon, authenticated;

create or replace function public.order_chain_detail(p_order uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_attr attributions%rowtype;
  v_scan scans%rowtype;
  v_step scans%rowtype;
  v_store uuid;
  v_traced boolean := false;
  v_giver_ids uuid[] := '{}';
  v_guard int := 0;
begin
  select * into v_order from orders where id = p_order;
  if v_order.id is null then
    return null;
  end if;

  select * into v_attr from attributions where order_id = p_order order by created_at desc limit 1;
  if v_attr.scan_id is not null then
    select * into v_scan from scans where id = v_attr.scan_id;
  end if;

  -- Givers, last (direct) giver first while walking, reversed below.
  if v_scan.id is not null then
    v_step := v_scan;
    while v_step.id is not null and v_step.source_type = 'peer' and v_guard < 50 loop
      if v_step.source_user_id is not null then
        v_giver_ids := v_giver_ids || v_step.source_user_id;
      end if;
      v_guard := v_guard + 1;
      if v_step.parent_scan_id is null then
        exit;
      end if;
      select * into v_step from scans where id = v_step.parent_scan_id;
    end loop;
  elsif v_attr.source_user_id is not null then
    v_giver_ids := array[v_attr.source_user_id];
  end if;
  select coalesce(array_agg(g order by i desc), '{}') into v_giver_ids
  from unnest(v_giver_ids) with ordinality as t(g, i);

  v_store := coalesce(v_attr.origin_retailer_id, v_scan.origin_retailer_id);

  -- Old guess (021), only when the chain has no store at all.
  if v_store is null and v_attr.source_retailer_id is not null then
    v_store := v_attr.source_retailer_id;
  elsif v_store is null and v_attr.source_user_id is not null then
    select a.source_retailer_id into v_store
    from orders o
    join attributions a on a.order_id = o.id
    where o.consumer_user_id = v_attr.source_user_id
      and o.brand_id = v_order.brand_id
      and o.status <> 'cancelled'
      and o.created_at < v_order.created_at
      and a.source_retailer_id is not null
      and exists (
        select 1 from order_items mine
        join order_items theirs on theirs.product_id = mine.product_id
        where mine.order_id = p_order and theirs.order_id = o.id
      )
    order by o.created_at desc
    limit 1;
    v_traced := v_store is not null;
  end if;

  return jsonb_build_object(
    'store', (select name from retailer_profiles where id = v_store),
    'store_traced', v_traced,
    'giver', first_name_of(v_attr.source_user_id),
    'givers', coalesce((
      select jsonb_agg(coalesce(first_name_of(g), 'Unknown') order by i)
      from unnest(v_giver_ids) with ordinality as t(g, i)
    ), '[]'::jsonb),
    'buyer', coalesce(
      first_name_of(v_order.consumer_user_id),
      nullif(split_part(trim(v_order.shipping_name), ' ', 1), '')
    ),
    'chain_id', coalesce(v_attr.chain_id, v_scan.chain_id),
    'store_share_dkk', v_attr.store_commission_amount_dkk,
    'credited', v_attr.id is not null,
    'passed_on', coalesce(v_attr.attribution_type = 'peer', false),
    'giver_ids', to_jsonb(v_giver_ids)
  );
end;
$$;
revoke all on function public.order_chain_detail(uuid) from public, anon, authenticated;

create or replace function public.get_brand_order_chain(p_order uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from orders o
    where o.id = p_order and o.brand_id = (select id from brand_profiles where user_id = auth.uid())
  ) then
    return null;
  end if;
  return order_chain_detail(p_order) - 'giver_ids';
end;
$$;
grant execute on function public.get_brand_order_chain(uuid) to authenticated;

create or replace function public.get_brand_order_chains(p_orders uuid[])
returns table (order_id uuid, chain jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, order_chain_detail(o.id) - 'giver_ids'
  from orders o
  where o.id = any(p_orders)
    and o.brand_id = (select id from brand_profiles where user_id = auth.uid());
$$;
revoke all on function public.get_brand_order_chains(uuid[]) from public;
grant execute on function public.get_brand_order_chains(uuid[]) to authenticated;
