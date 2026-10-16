-- =============================================================================
-- RETAILER: READ ORDER ITEMS OF CREDITED ORDERS
-- The retailer dashboard lists credited purchases with the product name from
-- order_items. Until now only the consumer and the brand could read
-- order_items, so retailers saw "Unknown product". This lets a retailer read
-- the items of orders that are attributed to their store, and nothing else
-- (no consumer details: orders itself stays unreadable to retailers).
-- =============================================================================

create policy "Retailer can read items of credited orders" on public.order_items for select using (
  order_id in (
    select order_id from public.attributions
    where source_retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
  )
);
