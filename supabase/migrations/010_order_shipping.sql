-- =============================================================================
-- ORDERS: CARRIER, SHIP/DELIVERY TIMES, PUSH, MENU COUNTS (Figma update, Part C)
-- Figma "Brand Portal / 06 Orders", "App / 15 Tracking", "App / 16 Notifications".
-- =============================================================================

alter table public.orders
  add column carrier text check (carrier in ('PostNord', 'GLS', 'DAO', 'Bring', 'Other')),
  add column shipped_at timestamptz,
  add column delivered_at timestamptz;

-- Backfill from the status timeline (each status change wrote an order_event).
update public.orders o set shipped_at = e.at
from (select order_id, min(created_at) at from public.order_events where status = 'shipped' group by order_id) e
where e.order_id = o.id and o.shipped_at is null;

update public.orders o set delivered_at = e.at
from (select order_id, min(created_at) at from public.order_events where status = 'delivered' group by order_id) e
where e.order_id = o.id and o.delivered_at is null;

-- -----------------------------------------------------------------------------
-- Web push subscriptions (one per browser/device). Owner only.
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "User can read own push subscriptions" on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy "User can add own push subscriptions" on public.push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "User can remove own push subscriptions" on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Sidebar counts for the brand portal.
-- Orders: not shipped yet (New, confirmed, packed). Returns: waiting for the
-- brand to act (requested → approve/decline, approved → mark received,
-- received → mark refunded).
-- -----------------------------------------------------------------------------
create or replace function public.get_brand_nav_counts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'orders', (
      select count(*) from orders o
      where o.brand_id = bp.id and o.status in ('pending', 'confirmed', 'packed')
    ),
    'returns', (
      select count(*) from returns r join orders o on o.id = r.order_id
      where o.brand_id = bp.id and r.status in ('requested', 'approved', 'received')
    )
  )
  from brand_profiles bp
  where bp.user_id = auth.uid();
$$;

revoke all on function public.get_brand_nav_counts() from public;
grant execute on function public.get_brand_nav_counts() to authenticated;

-- Live updates for the sidebar counts (RLS still decides who gets which rows).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
      alter publication supabase_realtime add table public.orders;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'returns') then
      alter publication supabase_realtime add table public.returns;
    end if;
  end if;
end $$;
