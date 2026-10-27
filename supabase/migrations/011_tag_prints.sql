-- =============================================================================
-- QR TAG PRINTS (Figma update, Part D; Figma "Brand Portal / 05", "Retail Portal / 03")
-- Printing a tag reuses the sample's existing QR code. Each printed tag is
-- logged here. Written by /api/tag-prints with the service role only; no UI.
-- =============================================================================

create table public.tag_prints (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade, -- the printed code
  user_id uuid not null references public.profiles(id) on delete cascade,
  portal text not null check (portal in ('brand', 'retail')),
  printed_at timestamptz not null default now()
);

create index tag_prints_sample on public.tag_prints (sample_id, printed_at);

-- No policies: only the service role reads or writes.
alter table public.tag_prints enable row level security;

-- -----------------------------------------------------------------------------
-- Samples: stores only see their own store's samples.
-- "Public can read active samples" (001) let anyone, signed in or not, read
-- every store's active samples, deposits included. Nothing relies on it: the
-- scan page and the APIs read samples with the service role, and the portals
-- read through the brand and retailer policies, which stay.
-- -----------------------------------------------------------------------------
drop policy if exists "Public can read active samples" on public.samples;
