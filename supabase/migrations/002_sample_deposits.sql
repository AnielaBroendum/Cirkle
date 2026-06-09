-- Cirkle MVP — Sample Deposit & Swap System
-- Run this in Supabase SQL Editor after 001_initial_schema.sql

-- =============================================================================
-- ENUMS
-- =============================================================================

create type sample_request_status as enum ('pending', 'approved', 'shipped', 'received', 'rejected');
create type sample_transaction_type as enum ('deposit_paid', 'deposit_refunded', 'deposit_forfeited', 'swap_out', 'swap_in');
create type swap_request_status as enum ('requested', 'approved', 'return_shipped', 'return_received', 'inspected_ok', 'inspected_damaged', 'new_shipped', 'completed', 'cancelled');

-- =============================================================================
-- ADD DEPOSIT FIELDS TO SAMPLES
-- =============================================================================

alter table public.samples add column if not exists deposit_amount_dkk integer; -- in øre
alter table public.samples add column if not exists deposit_status text default 'none'; -- none, held, refunded, forfeited
alter table public.samples add column if not exists size text;
alter table public.samples add column if not exists color text;

-- =============================================================================
-- SAMPLE REQUESTS (retailer orders samples from brand)
-- =============================================================================

create table public.sample_requests (
  id uuid primary key default uuid_generate_v4(),
  retailer_id uuid not null references public.retailer_profiles(id) on delete cascade,
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  partnership_id uuid not null references public.brand_retailer_partnerships(id) on delete cascade,
  status sample_request_status not null default 'pending',
  note text, -- retailer can add a note to the request
  reviewed_at timestamptz,
  review_note text, -- brand can add a note when approving/rejecting
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Individual items within a sample request
create table public.sample_request_items (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references public.sample_requests(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  deposit_amount_dkk integer not null, -- in øre, set by brand
  sample_id uuid references public.samples(id) on delete set null, -- linked after sample is created
  created_at timestamptz not null default now()
);

-- =============================================================================
-- SAMPLE TRANSACTIONS (financial ledger for deposits)
-- =============================================================================

create table public.sample_transactions (
  id uuid primary key default uuid_generate_v4(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  retailer_id uuid not null references public.retailer_profiles(id) on delete cascade,
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  transaction_type sample_transaction_type not null,
  amount_dkk integer not null, -- in øre, positive = retailer pays, negative = retailer receives
  note text,
  swap_request_id uuid, -- linked to swap if applicable (FK added after swap_requests table)
  created_at timestamptz not null default now()
);

-- =============================================================================
-- SWAP REQUESTS
-- =============================================================================

create table public.swap_requests (
  id uuid primary key default uuid_generate_v4(),
  retailer_id uuid not null references public.retailer_profiles(id) on delete cascade,
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,

  -- The sample being returned
  return_sample_id uuid not null references public.samples(id) on delete cascade,

  -- The product being requested as replacement
  new_product_id uuid not null references public.products(id) on delete cascade,
  new_size text not null,
  new_color text not null,

  -- The new sample (created after brand ships replacement)
  new_sample_id uuid references public.samples(id) on delete set null,

  status swap_request_status not null default 'requested',
  reason text, -- why the retailer wants to swap (not performing, wrong size, etc.)
  inspection_note text, -- brand's note after inspecting returned sample
  return_tracking_number text,
  new_tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add FK for swap_request_id on sample_transactions now that swap_requests exists
alter table public.sample_transactions
  add constraint fk_swap_request
  foreign key (swap_request_id) references public.swap_requests(id) on delete set null;

-- =============================================================================
-- ADD DEFAULT DEPOSIT AMOUNT TO PRODUCTS
-- =============================================================================

alter table public.products add column if not exists deposit_amount_dkk integer; -- brand sets default deposit per product, in øre

-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_sample_requests_retailer on public.sample_requests(retailer_id);
create index idx_sample_requests_brand on public.sample_requests(brand_id);
create index idx_sample_requests_status on public.sample_requests(status);
create index idx_sample_request_items_request on public.sample_request_items(request_id);
create index idx_sample_transactions_sample on public.sample_transactions(sample_id);
create index idx_sample_transactions_retailer on public.sample_transactions(retailer_id);
create index idx_sample_transactions_brand on public.sample_transactions(brand_id);
create index idx_swap_requests_retailer on public.swap_requests(retailer_id);
create index idx_swap_requests_brand on public.swap_requests(brand_id);
create index idx_swap_requests_status on public.swap_requests(status);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.sample_requests enable row level security;
alter table public.sample_request_items enable row level security;
alter table public.sample_transactions enable row level security;
alter table public.swap_requests enable row level security;

-- Sample requests: retailer can create/read own, brand can read/update incoming
create policy "Retailer can manage own sample requests" on public.sample_requests for all using (
  retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
);
create policy "Brand can read incoming sample requests" on public.sample_requests for select using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "Brand can update sample requests" on public.sample_requests for update using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);

-- Sample request items: same access as parent request
create policy "Retailer can manage own request items" on public.sample_request_items for all using (
  request_id in (select id from public.sample_requests where retailer_id in (
    select id from public.retailer_profiles where user_id = auth.uid()
  ))
);
create policy "Brand can read request items" on public.sample_request_items for select using (
  request_id in (select id from public.sample_requests where brand_id in (
    select id from public.brand_profiles where user_id = auth.uid()
  ))
);
create policy "Brand can update request items" on public.sample_request_items for update using (
  request_id in (select id from public.sample_requests where brand_id in (
    select id from public.brand_profiles where user_id = auth.uid()
  ))
);

-- Sample transactions: both parties can read
create policy "Retailer can read own transactions" on public.sample_transactions for select using (
  retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
);
create policy "Brand can read own transactions" on public.sample_transactions for select using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "System can insert transactions" on public.sample_transactions for insert with check (true);

-- Swap requests: retailer can create/read, brand can read/update
create policy "Retailer can manage own swap requests" on public.swap_requests for all using (
  retailer_id in (select id from public.retailer_profiles where user_id = auth.uid())
);
create policy "Brand can read incoming swap requests" on public.swap_requests for select using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);
create policy "Brand can update swap requests" on public.swap_requests for update using (
  brand_id in (select id from public.brand_profiles where user_id = auth.uid())
);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

create trigger set_updated_at before update on public.sample_requests for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.swap_requests for each row execute function public.handle_updated_at();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get total deposit capital held by a retailer
create or replace function public.get_retailer_deposit_total(p_retailer_id uuid)
returns integer as $$
  select coalesce(sum(
    case when deposit_status = 'held' then deposit_amount_dkk else 0 end
  ), 0)::integer
  from public.samples
  where retailer_id = p_retailer_id;
$$ language sql stable;

-- Get total deposits held by a brand (from all retailers)
create or replace function public.get_brand_deposits_held(p_brand_id uuid)
returns integer as $$
  select coalesce(sum(
    case when deposit_status = 'held' then deposit_amount_dkk else 0 end
  ), 0)::integer
  from public.samples
  where brand_id = p_brand_id;
$$ language sql stable;
