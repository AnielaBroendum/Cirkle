-- =============================================================================
-- BRAND: SAVE COUNTS FOR THE DASHBOARD
-- The brand dashboard (Figma "Brand Portal / 02") shows how often the brand's
-- products were saved. saved_products is readable only by the consumer who
-- saved, so this function returns daily counts for the calling brand's own
-- products and nothing else (no user ids, no individual saves).
-- =============================================================================

create or replace function public.get_brand_save_counts(p_since timestamptz)
returns table (day date, saves bigint)
language sql
stable
security definer
set search_path = public
as $$
  select sp.saved_at::date as day, count(*) as saves
  from public.saved_products sp
  join public.products p on p.id = sp.product_id
  join public.brand_profiles bp on bp.id = p.brand_id
  where bp.user_id = auth.uid()
    and sp.saved_at >= p_since
  group by sp.saved_at::date
  order by day;
$$;

revoke all on function public.get_brand_save_counts(timestamptz) from public;
grant execute on function public.get_brand_save_counts(timestamptz) to authenticated;
