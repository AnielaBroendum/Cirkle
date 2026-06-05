-- Cirkle MVP — Initial Schema
-- Run this in Supabase SQL Editor or via supabase db push

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

create type user_role as enum ('consumer', 'brand', 'retailer');
create type order_status as enum ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled');
create type sample_status as enum ('active', 'returned', 'damaged', 'inactive');
create type partnership_status as enum ('invited', 'active', 'paused', 'declined');
create type attribution_source as enum ('retailer', 'peer');
create type attribution_type as enum ('direct', 'deferred', 'tier2', 'peer');
create type commission_status as enum ('pending', 'confirmed', 'paid', 'reversed');

-- =============================================================================
-- USERS & PROFILES
-- =============================================================================

-- Extends Supabase auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  name text not null,
  email text not null,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brand_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  logo_url text,
  website text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.retailer_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  address text,
  city text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  logo_url text,
  store_photos text[] default '{}',
  store_type text, -- 'boutique', 'cafe', 'museum', 'flower_shop', 'other'
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- PRODUCTS & VARIANTS
-- =============================================================================

create table public.products (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  name text not null,
  description text,
  price_dkk integer not null, -- stored in øre (1 kr = 100 øre)
  images text[] default '{}',
  sizes text[] default '{}',
  colors text[] default '{}',
  materials text, -- free-text for MVP (DPP placeholder)
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  sku text,
  stock_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, size, color)
);

-- =============================================================================
-- PARTNERSHIPS
-- =============================================================================

create table public.brand_retailer_partnerships (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  retailer_id uuid not null references public.retailer_profiles(id) on delete cascade,
  status partnership_status not null default 'invited',
  commission_direct integer not null default 2500, -- basis points: 2500 = 25%
  commission_deferred integer not null default 1500, -- 15%
  commission_tier2 integer not null default 1000, -- 10%
  invitation_token text unique,
  invitation_email text,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand_id, retailer_id)
);

-- =============================================================================
-- SAMPLES & QR CODES
-- =============================================================================

create table public.samples (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  retailer_id uuid not null references public.retailer_profiles(id) on delete cascade,
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  qr_code_url text, -- URL to generated QR image in storage
  status sample_status not null default 'active',
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- SCANS & ATTRIBUTION
-- =============================================================================

create table public.scans (
  id uuid primary key default uuid_generate_v4(),
  sample_id uuid references public.samples(id) on delete set null, -- null for peer scans
  product_id uuid not null references public.products(id) on delete cascade,
  scanner_user_id uuid references public.profiles(id) on delete set null, -- null if anonymous
  source_type attribution_source not null,
  source_retailer_id uuid references public.retailer_profiles(id) on delete set null,
  source_user_id uuid references public.profiles(id) on delete set null, -- peer who owns the product
  scanned_at timestamptz not null default now(),
  user_agent text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- ORDERS & FULFILLMENT
-- =============================================================================

create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  order_number serial, -- human-readable order number
  consumer_user_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  status order_status not null default 'pending',
  total_dkk integer not null, -- in øre
  points_used integer not null default 0,
  discount_dkk integer not null default 0, -- points discount in øre
  shipping_name text not null,
  shipping_address text not null,
  shipping_city text not null,
  shipping_postal_code text not null,
  shipping_country text not null default 'DK',
  tracking_number text,
  tracking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null, -- snapshot at time of order
  size text,
  color text,
  quantity integer not null default 1,
  unit_price_dkk integer not null, -- in øre
  created_at timestamptz not null default now()
);

-- Wolt-style status timeline
create table public.order_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status order_status not null,
  note text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- ATTRIBUTION (links orders to scans)
-- =============================================================================

create table public.attributions (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  attribution_type attribution_type not null,
  source_retailer_id uuid references public.retailer_profiles(id) on delete set null,
  source_user_id uuid references public.profiles(id) on delete set null,
  commission_rate integer, -- basis points
  commission_amount_dkk integer, -- in øre
  points_amount integer, -- for peer attributions
  status commission_status not null default 'pending',
  attribution_window_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- POINTS
-- =============================================================================

create table public.points_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null, -- positive = earn, negative = spend
  reason text not null, -- 'welcome_bonus', 'peer_referral', 'redeemed', etc.
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- SAVED PRODUCTS (wishlist)
-- =============================================================================

create table public.saved_products (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  saved_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  unique(user_id, product_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_products_brand on public.products(brand_id);
create index idx_products_active on public.products(is_active) where is_active = true;
create index idx_product_variants_product on public.product_variants(product_id);
create index idx_samples_retailer on public.samples(retailer_id);
create index idx_samples_brand on public.samples(brand_id);
create index idx_samples_product on public.samples(product_id);
create index idx_scans_product on public.scans(product_id);
create index idx_scans_scanner on public.scans(scanner_user_id);
create index idx_scans_scanned_at on public.scans(scanned_at);
create index idx_orders_consumer on public.orders(consumer_user_id);
create index idx_orders_brand on public.orders(brand_id);
create index idx_orders_status on public.orders(status);
create index idx_order_items_order on public.order_items(order_id);
create index idx_order_events_order on public.order_events(order_id);
create index idx_attributions_order on public.attributions(order_id);
create index idx_points_user on public.points_ledger(user_id);
create index idx_saved_user on public.saved_products(user_id);
create index idx_partnerships_brand on public.brand_retailer_partnerships(brand_id);
create index idx_partnerships_retailer on public.brand_retailer_partnerships(retailer_id);
create index idx_partnerships_token on public.brand_retailer_partnerships(invitation_token);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.retailer_profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.samples enable row level security;
alter table public.scans enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.attributions enable row level security;
alter table public.points_ledger enable row level security;
alter table public.saved_products enable row level security;
alter table public.brand_retailer_partnerships enable row level security;

-- Profiles: users can read their own, update their own
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Brand profiles: owner can CRUD, everyone can read (for product pages)
create policy "Public can read brand profiles" on public.brand_profiles for select using (true);
create policy "Brand owner can update" on public.brand_profiles for update using (auth.uid() = user_id);
create policy "Brand owner can insert" on public.brand_profiles for insert with check (auth.uid() = user_id);

-- Retailer profiles: owner can CRUD, everyone can read
create policy "Public can read retailer profiles" on public.retailer_profiles for select using (true);
create policy "Retailer owner can update" on public.retailer_profiles for update using (auth.uid() = user_id);
create policy "Retailer owner can insert" on public.retailer_profiles for insert with check (auth.uid() = user_id);

-- Products: brand owner can CRUD, everyone can read active products
create policy "Public can read active products" on public.products for select using (is_active = true);
create policy "Brand can read own products" on public.products for select using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "Brand can insert products" on public.products for insert with check (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "Brand can update products" on public.products for update using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "Brand can delete products" on public.products for delete using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);

-- Product variants: same as products
create policy "Public can read variants" on public.product_variants for select using (true);
create policy "Brand can manage variants" on public.product_variants for all using (
  product_id in (
    select p.id from public.products p
    join public.brand_profiles bp on p.brand_id = bp.id
    where bp.user_id = auth.uid()
  )
);

-- Samples: brand and assigned retailer can read
create policy "Brand can manage samples" on public.samples for all using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "Retailer can read own samples" on public.samples for select using (
  retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
);
create policy "Public can read active samples" on public.samples for select using (status = 'active');

-- Scans: public insert (anyone can scan), restricted read
create policy "Anyone can insert scans" on public.scans for insert with check (true);
create policy "Brand can read scans on own products" on public.scans for select using (
  product_id in (
    select p.id from public.products p
    join public.brand_profiles bp on p.brand_id = bp.id
    where bp.user_id = auth.uid()
  )
);
create policy "Retailer can read scans from own samples" on public.scans for select using (
  source_retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
);
create policy "Consumer can read own scans" on public.scans for select using (scanner_user_id = auth.uid());

-- Orders: consumer sees own, brand sees incoming
create policy "Consumer can read own orders" on public.orders for select using (consumer_user_id = auth.uid());
create policy "Consumer can insert orders" on public.orders for insert with check (consumer_user_id = auth.uid());
create policy "Brand can read incoming orders" on public.orders for select using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "Brand can update order status" on public.orders for update using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);

-- Order items: same access as orders
create policy "Consumer can read own order items" on public.order_items for select using (
  order_id in (select id from public.orders where consumer_user_id = auth.uid())
);
create policy "Consumer can insert order items" on public.order_items for insert with check (
  order_id in (select id from public.orders where consumer_user_id = auth.uid())
);
create policy "Brand can read order items" on public.order_items for select using (
  order_id in (select id from public.orders where brand_id in (
    select id from public.brand_profiles where user_id = auth.uid()
  ))
);

-- Order events: readable by consumer and brand
create policy "Consumer can read order events" on public.order_events for select using (
  order_id in (select id from public.orders where consumer_user_id = auth.uid())
);
create policy "Brand can manage order events" on public.order_events for all using (
  order_id in (select id from public.orders where brand_id in (
    select id from public.brand_profiles where user_id = auth.uid()
  ))
);

-- Attributions: brand and retailer can read relevant
create policy "Brand can read own attributions" on public.attributions for select using (
  order_id in (select id from public.orders where brand_id in (
    select id from public.brand_profiles where user_id = auth.uid()
  ))
);
create policy "Retailer can read own attributions" on public.attributions for select using (
  source_retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
);

-- Points: users can read own
create policy "Users can read own points" on public.points_ledger for select using (user_id = auth.uid());
create policy "System can insert points" on public.points_ledger for insert with check (true);

-- Saved products: users can manage own
create policy "Users can manage saved products" on public.saved_products for all using (user_id = auth.uid());

-- Partnerships: brand and retailer can read/manage own
create policy "Brand can manage partnerships" on public.brand_retailer_partnerships for all using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "Retailer can read own partnerships" on public.brand_retailer_partnerships for select using (
  retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
);
create policy "Retailer can update own partnerships" on public.brand_retailer_partnerships for update using (
  retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
);
create policy "Public can read by invitation token" on public.brand_retailer_partnerships for select using (
  invitation_token is not null
);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
create trigger set_updated_at before update on public.profiles for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.brand_profiles for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.retailer_profiles for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.products for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.product_variants for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.samples for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.orders for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.attributions for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.brand_retailer_partnerships for each row execute function public.handle_updated_at();

-- Auto-create profile after signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'consumer')::user_role,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Get user's points balance
create or replace function public.get_points_balance(p_user_id uuid)
returns integer as $$
  select coalesce(sum(amount), 0)::integer
  from public.points_ledger
  where user_id = p_user_id;
$$ language sql stable;
