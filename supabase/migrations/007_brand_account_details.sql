-- =============================================================================
-- BRAND ACCOUNT DETAILS (Figma "Brand Portal / 08 Account and payouts")
-- The return policy link is public (it can be shown next to the product).
-- Payout details are private: brand_profiles is publicly readable, so bank
-- details live in their own table that only the owning brand can see.
-- Mirrors 004 (retailer_payout_details).
-- =============================================================================

alter table public.brand_profiles add column return_policy_url text;

create table public.brand_payout_details (
  brand_id uuid primary key references public.brand_profiles(id) on delete cascade,
  reg_no text,
  account_no text,
  cvr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_payout_details enable row level security;

-- Owner only: the brand whose profile this is.
create policy "Brand can read own payout details" on public.brand_payout_details for select using (
  exists (select 1 from public.brand_profiles bp where bp.id = brand_id and bp.user_id = auth.uid())
);
create policy "Brand can insert own payout details" on public.brand_payout_details for insert with check (
  exists (select 1 from public.brand_profiles bp where bp.id = brand_id and bp.user_id = auth.uid())
);
create policy "Brand can update own payout details" on public.brand_payout_details for update using (
  exists (select 1 from public.brand_profiles bp where bp.id = brand_id and bp.user_id = auth.uid())
) with check (
  exists (select 1 from public.brand_profiles bp where bp.id = brand_id and bp.user_id = auth.uid())
);

create trigger set_updated_at before update on public.brand_payout_details
  for each row execute function public.handle_updated_at();
