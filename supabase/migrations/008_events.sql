-- =============================================================================
-- EVENTS: ONE LOG FOR SCANS, SAVES AND PURCHASES (Figma update, Part A)
-- Every scan, save and purchase becomes one row with the same shape:
-- who, which product, which size (save/purchase only), which store (from the
-- scanned QR tag), who passed it on (giver) and when. The brand dashboard
-- aggregates over this table (Part B).
--
-- scans, saved_products, orders and attributions stay as they are: they still
-- drive attribution, the wishlist and checkout. Events are written next to them
-- by the API routes with the service role, so there are no insert policies.
-- =============================================================================

create type public.event_type as enum ('scan', 'save', 'purchase');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  type public.event_type not null,
  user_id uuid references public.profiles(id) on delete set null, -- null for anonymous scans
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  size text, -- save and purchase only
  retailer_id uuid references public.retailer_profiles(id) on delete set null, -- store from the QR tag
  sample_id uuid references public.samples(id) on delete set null, -- the tag itself
  giver_user_id uuid references public.profiles(id) on delete set null, -- passed on by
  scan_id uuid references public.scans(id) on delete set null, -- the scan that carries store/giver
  order_id uuid references public.orders(id) on delete cascade,
  order_item_id uuid unique references public.order_items(id) on delete cascade,
  quantity int not null default 1,
  unit_price_dkk int, -- purchase only, in øre
  occurred_at timestamptz not null default now(),
  origin text not null default 'live' check (origin in ('live', 'backfill', 'seed')),
  constraint events_scan_has_no_size check (type <> 'scan' or size is null),
  constraint events_purchase_has_order check (type <> 'purchase' or order_id is not null or origin = 'seed')
);

create unique index events_scan_once on public.events (scan_id) where type = 'scan';
create index events_brand_time on public.events (brand_id, occurred_at);
create index events_brand_type_time on public.events (brand_id, type, occurred_at);
create index events_product_time on public.events (product_id, occurred_at);
create index events_store_time on public.events (retailer_id, occurred_at) where retailer_id is not null;
create index events_brand_size on public.events (brand_id, size) where size is not null;
create index events_time on public.events (occurred_at);

alter table public.events enable row level security;

create policy "Brand can read own events" on public.events for select using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "Retailer can read events from own store" on public.events for select using (
  retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
);
create policy "User can read own events" on public.events for select using (user_id = auth.uid());

-- Saves now carry the chosen size.
alter table public.saved_products add column size text;

-- Save and checkout both look up "the user's latest scan of this product".
create index scans_user_product_time on public.scans (scanner_user_id, product_id, scanned_at desc);

-- -----------------------------------------------------------------------------
-- BACKFILL
-- Scans and purchases are complete. Saves have no size (it was never stored),
-- un-saved items were hard-deleted, and anonymous scans were never linked to
-- the account created afterwards: none of that can be recovered.
-- -----------------------------------------------------------------------------

insert into public.events (type, user_id, brand_id, product_id, retailer_id, sample_id, giver_user_id, scan_id, occurred_at, origin)
select 'scan', s.scanner_user_id, p.brand_id, s.product_id,
       s.source_retailer_id, s.sample_id,
       case when s.source_type = 'peer' then s.source_user_id end,
       s.id, s.scanned_at, 'backfill'
from public.scans s
join public.products p on p.id = s.product_id;

insert into public.events (type, user_id, brand_id, product_id, retailer_id, sample_id, giver_user_id, scan_id, occurred_at, origin)
select 'save', sp.user_id, p.brand_id, sp.product_id,
       sc.source_retailer_id, sc.sample_id,
       case when sc.source_type = 'peer' then sc.source_user_id end,
       sp.scan_id, sp.saved_at, 'backfill'
from public.saved_products sp
join public.products p on p.id = sp.product_id
left join public.scans sc on sc.id = sp.scan_id;

insert into public.events (type, user_id, brand_id, product_id, size, retailer_id, sample_id, giver_user_id, scan_id,
                           order_id, order_item_id, quantity, unit_price_dkk, occurred_at, origin)
select 'purchase', o.consumer_user_id, o.brand_id, oi.product_id, oi.size,
       a.source_retailer_id, sc.sample_id, a.source_user_id, a.scan_id,
       o.id, oi.id, oi.quantity, oi.unit_price_dkk, o.created_at, 'backfill'
from public.order_items oi
join public.orders o on o.id = oi.order_id
left join lateral (
  select * from public.attributions a where a.order_id = o.id order by a.created_at limit 1
) a on true
left join public.scans sc on sc.id = a.scan_id
where oi.product_id is not null;
