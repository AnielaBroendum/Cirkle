-- =============================================================================
-- BRAND STORIES AND PRODUCT IMAGES (Figma update, Part E)
-- Figma "Brand Portal / 08 Account" (Brand stories), "04 Edit product"
-- (Images) and "App / 13 Brand stories".
--
-- Stories: up to 10 per brand in a fixed order, shown on all the brand's
-- products. Video MP4/MOV (H.264) up to 20 s and 50 MB, or image JPG/PNG up
-- to 10 MB (shown 6 s); 1080 × 1920, portrait 9:16.
-- Product images: JPG/PNG/WebP, at least 1200 × 1600 (3:4), up to 10 MB, 8 max.
--
-- The buckets enforce size and file type. Duration, codec and pixel size
-- can't be checked by a storage policy, so /api/brand-stories and
-- /api/product-images/verify read the uploaded file and delete it if it fails.
-- =============================================================================

create table public.brand_stories (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  position smallint not null check (position between 1 and 10),
  kind text not null check (kind in ('video', 'image')),
  path text not null unique, -- in the brand-stories bucket
  url text not null,
  duration_seconds numeric(5, 2), -- video only
  width int not null,
  height int not null,
  bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint brand_stories_position_unique unique (brand_id, position) deferrable initially deferred
);

alter table public.brand_stories enable row level security;

-- Stories are public: they show on every product page, signed in or not.
create policy "Anyone can read brand stories" on public.brand_stories for select using (true);
-- Writes go through /api/brand-stories (service role) after the file is checked.

-- At most 10 per brand.
create or replace function public.enforce_brand_story_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.brand_stories where brand_id = new.brand_id) >= 10 then
    raise exception 'A brand can have up to 10 stories';
  end if;
  return new;
end;
$$;

create trigger brand_story_limit before insert on public.brand_stories
  for each row execute function public.enforce_brand_story_limit();

-- -----------------------------------------------------------------------------
-- Storage
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('brand-stories', 'brand-stories', true, 52428800, array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png']),
  ('product-images', 'product-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live under {brand_id}/…; a brand can only add or remove its own.
create policy "Brand can upload own stories and product images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('brand-stories', 'product-images')
    and (storage.foldername(name))[1] in (select id::text from public.brand_profiles where user_id = auth.uid())
  );

create policy "Brand can delete own stories and product images" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('brand-stories', 'product-images')
    and (storage.foldername(name))[1] in (select id::text from public.brand_profiles where user_id = auth.uid())
  );

create policy "Public can read stories and product images" on storage.objects
  for select
  using (bucket_id in ('brand-stories', 'product-images'));

-- Reorder in one transaction (positions are unique per brand, checked at commit).
create or replace function public.reorder_brand_stories(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand uuid;
begin
  select id into v_brand from brand_profiles where user_id = auth.uid();
  if v_brand is null then
    raise exception 'Not a brand';
  end if;
  if (select count(*) from brand_stories where brand_id = v_brand) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) i where i not in (select id from brand_stories where brand_id = v_brand)) then
    raise exception 'The list must contain every story of the brand exactly once';
  end if;
  update brand_stories s set position = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where s.id = o.id and s.brand_id = v_brand;
end;
$$;

revoke all on function public.reorder_brand_stories(uuid[]) from public;
grant execute on function public.reorder_brand_stories(uuid[]) to authenticated;
