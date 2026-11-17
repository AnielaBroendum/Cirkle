-- =============================================================================
-- STORE PROFILE NUMBERS (Portals v2; Figma "Retail Portal v2 / 04 Store profile" 368:822)
--
-- Read-only. Security definer, scoped to the caller's own store like 013.
-- Months are calendar months in p_tz (Europe/Copenhagen by default).
--   earned_total   store cut on every credited purchase, all statuses (the rows
--                  get_retailer_payouts returns: cancelled and returned left out)
--   brand_count    brands with an active partnership
--   since          when the first of those partnerships was accepted (created
--                  when there is no accepted_at)
--   scans_month    scans in the store this month (events, 008)
--   preview_sample an active sample in the store (oldest), for "Preview in app"
--   brands[]       per active partner: products (distinct products with an
--                  active sample), since, scans this month in the store and its
--                  share of scans_month in percent (null when there were none)
-- =============================================================================

create or replace function public.get_retailer_profile_stats(p_tz text default 'Europe/Copenhagen')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_month timestamptz;
  v_scans bigint;
begin
  select id into v_store from retailer_profiles where user_id = auth.uid();
  if v_store is null then
    return null;
  end if;
  v_month := date_trunc('month', now() at time zone p_tz) at time zone p_tz;
  select count(*) into v_scans from events e
  where e.retailer_id = v_store and e.type = 'scan' and e.occurred_at >= v_month;

  return (
    with partners as (
      select x.brand_id, coalesce(x.accepted_at, x.created_at) as since
      from brand_retailer_partnerships x
      where x.retailer_id = v_store and x.status = 'active'
    )
    select jsonb_build_object(
      'earned_total', (select coalesce(sum(amount_dkk), 0) from get_retailer_payouts()),
      'brand_count', (select count(*) from partners),
      'since', (select min(since) from partners),
      'scans_month', v_scans,
      'preview_sample', (
        select s.id from samples s
        where s.retailer_id = v_store and s.status = 'active'
        order by s.created_at limit 1
      ),
      'brands', coalesce((
        select jsonb_agg(b order by b.scans desc, b.name)
        from (
          select bp.id, bp.name, bp.logo_url, pa.since,
                 (select count(distinct s.product_id) from samples s
                  where s.retailer_id = v_store and s.brand_id = bp.id and s.status = 'active') as products,
                 (select count(*) from events e
                  where e.retailer_id = v_store and e.brand_id = bp.id and e.type = 'scan'
                    and e.occurred_at >= v_month) as scans,
                 case when v_scans = 0 then null else round(
                   (select count(*) from events e
                    where e.retailer_id = v_store and e.brand_id = bp.id and e.type = 'scan'
                      and e.occurred_at >= v_month) * 100.0 / v_scans
                 )::int end as share
          from partners pa
          join brand_profiles bp on bp.id = pa.brand_id
        ) b
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_retailer_profile_stats(text) from public;
grant execute on function public.get_retailer_profile_stats(text) to authenticated;
