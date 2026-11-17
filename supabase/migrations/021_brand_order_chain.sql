-- =============================================================================
-- ORDERS → THE CHAIN (Portals v2; Figma "Brand Portal v2 / 06 Orders" 365:645)
--
-- Read-only. Security definer; only answers for an order of the caller's brand.
-- "Scanned at → Passed on by → Bought by" for one order:
--   store       the store credited on the order's attribution; for a sale passed
--               on by a friend (peer attribution, no store), the store credited on
--               the friend's own earlier purchase of one of this order's products,
--               if there is one (store_traced = true then)
--   giver       the friend's first name (peer attribution)
--   buyer       the customer's first name
-- First names only: the brand never sees a friend's full name or email here.
-- =============================================================================

create or replace function public.get_brand_order_chain(p_order uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_attr attributions%rowtype;
  v_store uuid;
  v_traced boolean := false;
begin
  select o.* into v_order
  from orders o
  where o.id = p_order and o.brand_id = (select id from brand_profiles where user_id = auth.uid());
  if v_order.id is null then
    return null;
  end if;

  select * into v_attr from attributions where order_id = p_order order by created_at desc limit 1;
  v_store := v_attr.source_retailer_id;

  if v_store is null and v_attr.source_user_id is not null then
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
    'giver', (select nullif(split_part(trim(name), ' ', 1), '') from profiles where id = v_attr.source_user_id),
    'buyer', coalesce(
      (select nullif(split_part(trim(name), ' ', 1), '') from profiles where id = v_order.consumer_user_id),
      nullif(split_part(trim(v_order.shipping_name), ' ', 1), '')
    )
  );
end;
$$;

grant execute on function public.get_brand_order_chain(uuid) to authenticated;
