-- =============================================================================
-- RETURNS (Figma "11 Request a return")
-- A consumer asks to return one item from a delivered order. The brand
-- reviews it. Refunds are handled outside the app for now (mock payments).
-- =============================================================================

create type return_status as enum ('requested', 'approved', 'rejected', 'received', 'refunded');
create type return_reason as enum ('too_big', 'too_small', 'not_as_expected', 'faulty');

create table public.returns (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason return_reason not null,
  comment text,
  status return_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One return request per order item.
  unique (order_item_id)
);

create index idx_returns_order on public.returns(order_id);
create index idx_returns_user on public.returns(user_id);

alter table public.returns enable row level security;

-- Consumer: read own returns, and create one for an item in their own delivered order.
create policy "Consumer can read own returns" on public.returns for select using (user_id = auth.uid());
create policy "Consumer can request returns on own delivered orders" on public.returns for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.id = order_id
      and oi.id = order_item_id
      and o.consumer_user_id = auth.uid()
      and o.status = 'delivered'
  )
);

-- Brand: read and update returns on orders placed with them.
create policy "Brand can read returns on own orders" on public.returns for select using (
  order_id in (
    select o.id from public.orders o
    join public.brand_profiles bp on o.brand_id = bp.id
    where bp.user_id = auth.uid()
  )
);
create policy "Brand can update returns on own orders" on public.returns for update using (
  order_id in (
    select o.id from public.orders o
    join public.brand_profiles bp on o.brand_id = bp.id
    where bp.user_id = auth.uid()
  )
);

create trigger set_updated_at before update on public.returns
  for each row execute function public.handle_updated_at();
