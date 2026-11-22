-- =============================================================================
-- PASS-ON CHAIN, PART B: save the chain on the purchase
--
-- attributions.origin_retailer_id  the store where the chain started
-- attributions.chain_id            the chain the attributing scan belongs to
-- Written by /api/checkout from the attributing scan (scans.origin_retailer_id,
-- scans.chain_id, migration 026). source_retailer_id keeps its meaning: the
-- store credited with commission (store sales only).
--
-- Backfill: from the attribution's scan. Store attributions with no scan
-- (seed/backfill rows) take origin from source_retailer_id, no chain.
-- Unknown rows stay null.
-- =============================================================================

alter table public.attributions
  add column origin_retailer_id uuid references public.retailer_profiles(id) on delete set null,
  add column chain_id uuid;

create index attributions_origin_retailer on public.attributions (origin_retailer_id) where origin_retailer_id is not null;
create index attributions_chain on public.attributions (chain_id) where chain_id is not null;

update public.attributions a
set origin_retailer_id = s.origin_retailer_id,
    chain_id = s.chain_id
from public.scans s
where s.id = a.scan_id;

update public.attributions
set origin_retailer_id = source_retailer_id
where scan_id is null
  and attribution_type <> 'peer'
  and source_retailer_id is not null
  and origin_retailer_id is null;
