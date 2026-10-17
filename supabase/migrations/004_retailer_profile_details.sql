-- =============================================================================
-- RETAILER PROFILE DETAILS (Figma "Retail Portal / 04 Store profile and payouts")
-- Opening hours are public (shown to people who scan in the store).
-- Payout details are private: retailer_profiles is publicly readable, so bank
-- details live in their own table that only the owning retailer can see.
-- =============================================================================

alter table public.retailer_profiles add column opening_hours text;

create table public.retailer_payout_details (
  retailer_id uuid primary key references public.retailer_profiles(id) on delete cascade,
  reg_no text,
  account_no text,
  cvr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.retailer_payout_details enable row level security;

-- Owner only: the retailer whose profile this is.
create policy "Retailer can read own payout details" on public.retailer_payout_details for select using (
  exists (select 1 from public.retailer_profiles rp where rp.id = retailer_id and rp.user_id = auth.uid())
);
create policy "Retailer can insert own payout details" on public.retailer_payout_details for insert with check (
  exists (select 1 from public.retailer_profiles rp where rp.id = retailer_id and rp.user_id = auth.uid())
);
create policy "Retailer can update own payout details" on public.retailer_payout_details for update using (
  exists (select 1 from public.retailer_profiles rp where rp.id = retailer_id and rp.user_id = auth.uid())
) with check (
  exists (select 1 from public.retailer_profiles rp where rp.id = retailer_id and rp.user_id = auth.uid())
);

create trigger set_updated_at before update on public.retailer_payout_details
  for each row execute function public.handle_updated_at();
