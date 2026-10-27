-- =============================================================================
-- CONSUMER CONSENTS (Figma update run 2, Part B; Figma "App / 02 Consent")
--
-- An append-only log of what each shopper agreed to and when. The current
-- choice is the newest row per consent; with no row the consent is off, so
-- existing users are never switched on by this migration (GDPR: optional
-- consents start off).
--   chain              "Data for the chain": required to use Flaym, always on.
--                      Logged once as an acknowledgement with its time.
--   share_with_brands  "Share my data with brands", optional
--   news_from_brands   "News from brands", optional (max one email a week)
-- Rows are never updated or deleted: a change is a new row.
-- =============================================================================

create table public.consumer_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent text not null check (consent in ('chain', 'share_with_brands', 'news_from_brands')),
  granted boolean not null,
  source text not null check (source in ('consent_screen', 'profile')),
  created_at timestamptz not null default now(),
  constraint consumer_consents_chain_always_on check (consent <> 'chain' or granted)
);

create index consumer_consents_user_latest on public.consumer_consents (user_id, consent, created_at desc);

alter table public.consumer_consents enable row level security;

create policy "User can read own consents" on public.consumer_consents
  for select using (user_id = auth.uid());
create policy "User can add own consents" on public.consumer_consents
  for insert with check (user_id = auth.uid());
