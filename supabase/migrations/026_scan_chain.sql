-- =============================================================================
-- PASS-ON CHAIN, PART A: keep the store and the giver when a QR is passed on
--
-- New columns on scans (only for the chain; nothing else reads them yet):
--   origin_retailer_id  the store where the chain started (the first tag scan)
--   origin_sample_id    the tag that was scanned there
--   parent_scan_id      the giver's scan this peer scan came from
--   chain_id            shared by every scan in one chain
--
-- Filled by a BEFORE INSERT trigger, never by the client:
--   store scan  origin = the sample's store (source_retailer_id as fallback),
--               new chain. A source_retailer_id that doesn't match the sample's
--               store is replaced by the sample's store.
--   peer scan   parent = the giver's latest earlier scan of the same product
--               (store or peer); origin and chain copied from it. If the giver
--               has no earlier scan, a new chain with no store.
-- source_retailer_id on peer scans, and events.retailer_id, are not touched:
-- store stats (019–025) and commissions depend on them.
--
-- Also drops the "Anyone can insert scans" policy: the app writes scans with
-- the service role (/api/scans), and the open policy let any client with the
-- anon key write a scan crediting any store or giver.
-- =============================================================================

alter table public.scans
  add column origin_retailer_id uuid references public.retailer_profiles(id) on delete set null,
  add column origin_sample_id uuid references public.samples(id) on delete set null,
  add column parent_scan_id uuid references public.scans(id) on delete set null,
  add column chain_id uuid;

create index scans_chain on public.scans (chain_id) where chain_id is not null;
create index scans_parent on public.scans (parent_scan_id) where parent_scan_id is not null;
create index scans_origin_retailer on public.scans (origin_retailer_id) where origin_retailer_id is not null;

-- The giver's latest scan of a product before a given time (the parent).
create or replace function public.scan_chain_parent(p_giver uuid, p_product uuid, p_before timestamptz)
returns public.scans
language sql
stable
security definer
set search_path = public
as $$
  select s.* from scans s
  where s.scanner_user_id = p_giver
    and s.product_id = p_product
    and s.scanned_at < p_before
  order by s.scanned_at desc
  limit 1;
$$;
revoke all on function public.scan_chain_parent(uuid, uuid, timestamptz) from public, anon, authenticated;

create or replace function public.scans_fill_chain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sample_store uuid;
  v_parent scans%rowtype;
begin
  new.scanned_at := coalesce(new.scanned_at, now());
  new.parent_scan_id := null;
  new.origin_retailer_id := null;
  new.origin_sample_id := null;
  new.chain_id := null;

  if new.source_type = 'retailer' then
    if new.sample_id is not null then
      select retailer_id into v_sample_store from samples where id = new.sample_id;
    end if;
    if v_sample_store is not null then
      new.source_retailer_id := v_sample_store;
    end if;
    new.origin_retailer_id := new.source_retailer_id;
    new.origin_sample_id := new.sample_id;
    new.chain_id := gen_random_uuid();
  else
    if new.source_user_id is not null then
      v_parent := scan_chain_parent(new.source_user_id, new.product_id, new.scanned_at);
    end if;
    if v_parent.id is not null then
      new.parent_scan_id := v_parent.id;
      new.origin_retailer_id := v_parent.origin_retailer_id;
      new.origin_sample_id := v_parent.origin_sample_id;
      new.chain_id := coalesce(v_parent.chain_id, gen_random_uuid());
    else
      new.chain_id := gen_random_uuid();
    end if;
  end if;
  return new;
end;
$$;

create trigger scans_fill_chain
  before insert on public.scans
  for each row execute function public.scans_fill_chain();

drop policy if exists "Anyone can insert scans" on public.scans;

-- -----------------------------------------------------------------------------
-- Backfill. Existing source_* columns are left as they are.
-- -----------------------------------------------------------------------------

-- Store scans: from their sample (or the stored store).
update public.scans s
set origin_retailer_id = coalesce((select sm.retailer_id from public.samples sm where sm.id = s.sample_id), s.source_retailer_id),
    origin_sample_id = s.sample_id,
    chain_id = gen_random_uuid()
where s.source_type = 'retailer';

-- Peer scans with a giver, oldest first, so a two-step chain finds its parent's
-- chain already filled. Peer scans without a giver stay null (unknown).
do $$
declare
  r record;
  p public.scans%rowtype;
begin
  for r in
    select id, source_user_id, product_id, scanned_at from public.scans
    where source_type = 'peer' and source_user_id is not null
    order by scanned_at
  loop
    p := public.scan_chain_parent(r.source_user_id, r.product_id, r.scanned_at);
    if p.id is not null then
      update public.scans
      set parent_scan_id = p.id,
          origin_retailer_id = p.origin_retailer_id,
          origin_sample_id = p.origin_sample_id,
          chain_id = coalesce(p.chain_id, gen_random_uuid())
      where id = r.id;
    else
      update public.scans set chain_id = gen_random_uuid() where id = r.id;
    end if;
  end loop;
end;
$$;
