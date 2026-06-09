-- Cirkle MVP — Seed Data
-- Run this AFTER migrations. Uses the service_role or superuser context to bypass RLS.
-- All UUIDs are deterministic so the seed is idempotent (re-runnable).

-- =============================================================================
-- AUTH USERS (Supabase auth.users — triggers handle_new_user for profiles)
-- =============================================================================

-- Brand: STEM
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'hello@stem.dk',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"role":"brand","name":"STEM"}',
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Brand: A Kin
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES (
  'a1000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'hello@akin.dk',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"role":"brand","name":"A Kin"}',
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Retailer: Studio Nord
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'info@studionord.dk',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"role":"retailer","name":"Studio Nord"}',
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Retailer: Kaffebar Vesterbro
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES (
  'b1000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'hej@kaffebarvesterbro.dk',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"role":"retailer","name":"Kaffebar Vesterbro"}',
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Retailer: Bloom & Blad
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES (
  'b1000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'kontakt@bloomblad.dk',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"role":"retailer","name":"Bloom & Blad"}',
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Consumer: Anna Test
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'anna@test.dk',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"role":"consumer","name":"Anna Hansen"}',
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Consumer: Mikkel Test
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES (
  'c1000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'mikkel@test.dk',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"role":"consumer","name":"Mikkel Nielsen"}',
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Consumer: Sofie Test
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES (
  'c1000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'sofie@test.dk',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"role":"consumer","name":"Sofie Larsen"}',
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- BRAND PROFILES
-- =============================================================================

INSERT INTO public.brand_profiles (id, user_id, name, description, logo_url, website, onboarding_complete) VALUES
  ('bp100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'STEM', 'Scandinavian minimalist clothing. Sustainable basics made from organic materials.',
   'https://placehold.co/200x200/0c93e9/white?text=STEM', 'https://stem.dk', true),
  ('bp100000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   'A Kin', 'Modern Danish knitwear. Handcrafted from recycled wool and natural fibers.',
   'https://placehold.co/200x200/071a2e/white?text=A+Kin', 'https://akin.dk', true)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- RETAILER PROFILES
-- =============================================================================

INSERT INTO public.retailer_profiles (id, user_id, name, description, address, city, postal_code, store_type, onboarding_complete) VALUES
  ('rp100000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'Studio Nord', 'A curated concept store in Nordhavn featuring emerging Scandinavian designers.',
   'Nordre Toldbod 24', 'Copenhagen', '2100', 'boutique', true),
  ('rp100000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002',
   'Kaffebar Vesterbro', 'Specialty coffee and lifestyle. A warm space where locals discover new brands over a flat white.',
   'Istedgade 88', 'Copenhagen', '1650', 'cafe', true),
  ('rp100000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003',
   'Bloom & Blad', 'Florist and design shop in Frederiksberg. Flowers, ceramics, and thoughtfully chosen fashion.',
   'Gammel Kongevej 120', 'Frederiksberg', '1850', 'flower_shop', true)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- PRODUCTS — STEM (5 products)
-- =============================================================================

INSERT INTO public.products (id, brand_id, name, description, price_dkk, images, sizes, colors, materials, category, is_active) VALUES
  ('pr100000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000001',
   'The Essential Tee', 'Our signature organic cotton t-shirt. Relaxed fit, pre-washed for softness.',
   49900, ARRAY['https://placehold.co/800x1000/f5f5f0/333?text=Essential+Tee'],
   ARRAY['XS','S','M','L','XL'], ARRAY['White','Black','Sand'], '100% organic cotton, GOTS certified', 'Tops', true),

  ('pr100000-0000-0000-0000-000000000002', 'bp100000-0000-0000-0000-000000000001',
   'The Wide Trouser', 'High-waisted wide-leg trousers in a linen-cotton blend. Made in Portugal.',
   89900, ARRAY['https://placehold.co/800x1000/e8e4de/333?text=Wide+Trouser'],
   ARRAY['XS','S','M','L'], ARRAY['Ecru','Navy'], '55% linen, 45% organic cotton', 'Bottoms', true),

  ('pr100000-0000-0000-0000-000000000003', 'bp100000-0000-0000-0000-000000000001',
   'The Overshirt', 'Heavyweight brushed cotton overshirt. Layer it or wear it as a light jacket.',
   129900, ARRAY['https://placehold.co/800x1000/c7bfb2/333?text=Overshirt'],
   ARRAY['S','M','L','XL'], ARRAY['Olive','Charcoal'], 'Brushed organic cotton, 320gsm', 'Outerwear', true),

  ('pr100000-0000-0000-0000-000000000004', 'bp100000-0000-0000-0000-000000000001',
   'The Everyday Hoodie', 'Midweight loopback hoodie. Raglan sleeves, kangaroo pocket.',
   79900, ARRAY['https://placehold.co/800x1000/d9d4cc/333?text=Hoodie'],
   ARRAY['S','M','L','XL'], ARRAY['Grey Melange','Black'], '100% organic cotton loopback', 'Tops', true),

  ('pr100000-0000-0000-0000-000000000005', 'bp100000-0000-0000-0000-000000000001',
   'The Weekend Shorts', 'Relaxed drawstring shorts for warm days. Garment-dyed for a lived-in feel.',
   59900, ARRAY['https://placehold.co/800x1000/ddd8cf/333?text=Weekend+Shorts'],
   ARRAY['S','M','L','XL'], ARRAY['Faded Black','Washed Blue'], 'Organic cotton twill', 'Bottoms', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PRODUCTS — A Kin (5 products)
-- =============================================================================

INSERT INTO public.products (id, brand_id, name, description, price_dkk, images, sizes, colors, materials, category, is_active) VALUES
  ('pr200000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000002',
   'The Moss Sweater', 'Chunky-knit crew neck in recycled wool. Spun and knitted in Denmark.',
   159900, ARRAY['https://placehold.co/800x1000/8a9a7b/fff?text=Moss+Sweater'],
   ARRAY['XS','S','M','L'], ARRAY['Moss Green','Cream'], '70% recycled wool, 30% alpaca', 'Knitwear', true),

  ('pr200000-0000-0000-0000-000000000002', 'bp100000-0000-0000-0000-000000000002',
   'The Ribbed Beanie', 'Classic ribbed beanie in merino-cashmere blend. Made in Scotland.',
   39900, ARRAY['https://placehold.co/800x1000/4a3f35/fff?text=Ribbed+Beanie'],
   ARRAY['One Size'], ARRAY['Charcoal','Rust','Oatmeal'], '80% merino wool, 20% cashmere', 'Accessories', true),

  ('pr200000-0000-0000-0000-000000000003', 'bp100000-0000-0000-0000-000000000002',
   'The Cable Cardigan', 'Relaxed fit cable-knit cardigan with wooden buttons. Slow-made in small batches.',
   189900, ARRAY['https://placehold.co/800x1000/b8a99a/fff?text=Cable+Cardigan'],
   ARRAY['S','M','L'], ARRAY['Natural','Slate'], '100% undyed Shetland wool', 'Knitwear', true),

  ('pr200000-0000-0000-0000-000000000004', 'bp100000-0000-0000-0000-000000000002',
   'The Scarf Wrap', 'Oversized scarf that doubles as a wrap. Jacquard-woven with a graphic pattern.',
   69900, ARRAY['https://placehold.co/800x1000/c4b5a5/fff?text=Scarf+Wrap'],
   ARRAY['One Size'], ARRAY['Terracotta/Cream','Navy/Grey'], 'Brushed merino wool', 'Accessories', true),

  ('pr200000-0000-0000-0000-000000000005', 'bp100000-0000-0000-0000-000000000002',
   'The Fisherman Vest', 'Sleeveless knit vest inspired by Danish fishermen. Wear it layered year-round.',
   119900, ARRAY['https://placehold.co/800x1000/96897b/fff?text=Fisherman+Vest'],
   ARRAY['XS','S','M','L'], ARRAY['Storm Blue','Off White'], 'Recycled cotton-wool blend', 'Knitwear', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PRODUCT VARIANTS (selected combos with stock)
-- =============================================================================

INSERT INTO public.product_variants (id, product_id, size, color, sku, stock_count) VALUES
  -- STEM Essential Tee
  ('pv100001-0000-0000-0000-000000000001', 'pr100000-0000-0000-0000-000000000001', 'S', 'White', 'STEM-TEE-S-WHT', 25),
  ('pv100001-0000-0000-0000-000000000002', 'pr100000-0000-0000-0000-000000000001', 'M', 'White', 'STEM-TEE-M-WHT', 30),
  ('pv100001-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000001', 'L', 'Black', 'STEM-TEE-L-BLK', 20),
  ('pv100001-0000-0000-0000-000000000004', 'pr100000-0000-0000-0000-000000000001', 'M', 'Sand', 'STEM-TEE-M-SND', 15),
  -- STEM Wide Trouser
  ('pv100002-0000-0000-0000-000000000001', 'pr100000-0000-0000-0000-000000000002', 'S', 'Ecru', 'STEM-TRS-S-ECR', 12),
  ('pv100002-0000-0000-0000-000000000002', 'pr100000-0000-0000-0000-000000000002', 'M', 'Navy', 'STEM-TRS-M-NVY', 18),
  -- STEM Overshirt
  ('pv100003-0000-0000-0000-000000000001', 'pr100000-0000-0000-0000-000000000003', 'M', 'Olive', 'STEM-OVR-M-OLV', 10),
  ('pv100003-0000-0000-0000-000000000002', 'pr100000-0000-0000-0000-000000000003', 'L', 'Charcoal', 'STEM-OVR-L-CHR', 8),
  -- STEM Hoodie
  ('pv100004-0000-0000-0000-000000000001', 'pr100000-0000-0000-0000-000000000004', 'M', 'Grey Melange', 'STEM-HOD-M-GRY', 22),
  ('pv100004-0000-0000-0000-000000000002', 'pr100000-0000-0000-0000-000000000004', 'L', 'Black', 'STEM-HOD-L-BLK', 16),
  -- A Kin Moss Sweater
  ('pv200001-0000-0000-0000-000000000001', 'pr200000-0000-0000-0000-000000000001', 'S', 'Moss Green', 'AKIN-MSS-S-GRN', 8),
  ('pv200001-0000-0000-0000-000000000002', 'pr200000-0000-0000-0000-000000000001', 'M', 'Cream', 'AKIN-MSS-M-CRM', 12),
  -- A Kin Ribbed Beanie
  ('pv200002-0000-0000-0000-000000000001', 'pr200000-0000-0000-0000-000000000002', 'One Size', 'Charcoal', 'AKIN-BNI-OS-CHR', 40),
  ('pv200002-0000-0000-0000-000000000002', 'pr200000-0000-0000-0000-000000000002', 'One Size', 'Rust', 'AKIN-BNI-OS-RST', 35),
  -- A Kin Cable Cardigan
  ('pv200003-0000-0000-0000-000000000001', 'pr200000-0000-0000-0000-000000000003', 'M', 'Natural', 'AKIN-CRD-M-NAT', 6),
  ('pv200003-0000-0000-0000-000000000002', 'pr200000-0000-0000-0000-000000000003', 'L', 'Slate', 'AKIN-CRD-L-SLT', 5)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PARTNERSHIPS
-- =============================================================================

INSERT INTO public.brand_retailer_partnerships (id, brand_id, retailer_id, status, commission_direct, commission_deferred, commission_tier2, accepted_at) VALUES
  ('pa100000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000001', 'rp100000-0000-0000-0000-000000000001', 'active', 2500, 1500, 1000, now() - interval '30 days'),
  ('pa100000-0000-0000-0000-000000000002', 'bp100000-0000-0000-0000-000000000001', 'rp100000-0000-0000-0000-000000000002', 'active', 2500, 1500, 1000, now() - interval '20 days'),
  ('pa100000-0000-0000-0000-000000000003', 'bp100000-0000-0000-0000-000000000002', 'rp100000-0000-0000-0000-000000000001', 'active', 2500, 1500, 1000, now() - interval '25 days'),
  ('pa100000-0000-0000-0000-000000000004', 'bp100000-0000-0000-0000-000000000002', 'rp100000-0000-0000-0000-000000000003', 'active', 2000, 1200, 800, now() - interval '15 days'),
  ('pa100000-0000-0000-0000-000000000005', 'bp100000-0000-0000-0000-000000000001', 'rp100000-0000-0000-0000-000000000003', 'invited', 2500, 1500, 1000, null)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SAMPLES (10, distributed across retailers)
-- =============================================================================

INSERT INTO public.samples (id, product_id, retailer_id, brand_id, status, activated_at) VALUES
  -- STEM products at Studio Nord
  ('sa100000-0000-0000-0000-000000000001', 'pr100000-0000-0000-0000-000000000001', 'rp100000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000001', 'active', now() - interval '28 days'),
  ('sa100000-0000-0000-0000-000000000002', 'pr100000-0000-0000-0000-000000000003', 'rp100000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000001', 'active', now() - interval '28 days'),
  -- STEM products at Kaffebar Vesterbro
  ('sa100000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000001', 'rp100000-0000-0000-0000-000000000002', 'bp100000-0000-0000-0000-000000000001', 'active', now() - interval '18 days'),
  ('sa100000-0000-0000-0000-000000000004', 'pr100000-0000-0000-0000-000000000004', 'rp100000-0000-0000-0000-000000000002', 'bp100000-0000-0000-0000-000000000001', 'active', now() - interval '18 days'),
  -- A Kin products at Studio Nord
  ('sa100000-0000-0000-0000-000000000005', 'pr200000-0000-0000-0000-000000000001', 'rp100000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000002', 'active', now() - interval '23 days'),
  ('sa100000-0000-0000-0000-000000000006', 'pr200000-0000-0000-0000-000000000003', 'rp100000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000002', 'active', now() - interval '23 days'),
  -- A Kin products at Bloom & Blad
  ('sa100000-0000-0000-0000-000000000007', 'pr200000-0000-0000-0000-000000000002', 'rp100000-0000-0000-0000-000000000003', 'bp100000-0000-0000-0000-000000000002', 'active', now() - interval '14 days'),
  ('sa100000-0000-0000-0000-000000000008', 'pr200000-0000-0000-0000-000000000004', 'rp100000-0000-0000-0000-000000000003', 'bp100000-0000-0000-0000-000000000002', 'active', now() - interval '14 days'),
  -- Inactive sample
  ('sa100000-0000-0000-0000-000000000009', 'pr100000-0000-0000-0000-000000000002', 'rp100000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000001', 'returned', now() - interval '60 days'),
  -- Extra active
  ('sa100000-0000-0000-0000-000000000010', 'pr200000-0000-0000-0000-000000000005', 'rp100000-0000-0000-0000-000000000003', 'bp100000-0000-0000-0000-000000000002', 'active', now() - interval '10 days')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SCANS (20 — mixed retailer and peer)
-- =============================================================================

INSERT INTO public.scans (id, sample_id, product_id, scanner_user_id, source_type, source_retailer_id, source_user_id, scanned_at) VALUES
  -- Retailer scans by Anna (at Studio Nord)
  ('sc100000-0000-0000-0000-000000000001', 'sa100000-0000-0000-0000-000000000001', 'pr100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'retailer', 'rp100000-0000-0000-0000-000000000001', null, now() - interval '6 days'),
  ('sc100000-0000-0000-0000-000000000002', 'sa100000-0000-0000-0000-000000000002', 'pr100000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'retailer', 'rp100000-0000-0000-0000-000000000001', null, now() - interval '6 days'),
  ('sc100000-0000-0000-0000-000000000003', 'sa100000-0000-0000-0000-000000000005', 'pr200000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'retailer', 'rp100000-0000-0000-0000-000000000001', null, now() - interval '5 days'),
  -- Retailer scans by Mikkel (at Kaffebar Vesterbro)
  ('sc100000-0000-0000-0000-000000000004', 'sa100000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'retailer', 'rp100000-0000-0000-0000-000000000002', null, now() - interval '4 days'),
  ('sc100000-0000-0000-0000-000000000005', 'sa100000-0000-0000-0000-000000000004', 'pr100000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002', 'retailer', 'rp100000-0000-0000-0000-000000000002', null, now() - interval '4 days'),
  -- Retailer scans by Sofie (at Bloom & Blad)
  ('sc100000-0000-0000-0000-000000000006', 'sa100000-0000-0000-0000-000000000007', 'pr200000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000003', 'retailer', 'rp100000-0000-0000-0000-000000000003', null, now() - interval '3 days'),
  ('sc100000-0000-0000-0000-000000000007', 'sa100000-0000-0000-0000-000000000008', 'pr200000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003', 'retailer', 'rp100000-0000-0000-0000-000000000003', null, now() - interval '3 days'),
  ('sc100000-0000-0000-0000-000000000008', 'sa100000-0000-0000-0000-000000000010', 'pr200000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000003', 'retailer', 'rp100000-0000-0000-0000-000000000003', null, now() - interval '2 days'),
  -- Anonymous scans (no user)
  ('sc100000-0000-0000-0000-000000000009', 'sa100000-0000-0000-0000-000000000001', 'pr100000-0000-0000-0000-000000000001', null, 'retailer', 'rp100000-0000-0000-0000-000000000001', null, now() - interval '5 days'),
  ('sc100000-0000-0000-0000-000000000010', 'sa100000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000001', null, 'retailer', 'rp100000-0000-0000-0000-000000000002', null, now() - interval '3 days'),
  ('sc100000-0000-0000-0000-000000000011', 'sa100000-0000-0000-0000-000000000005', 'pr200000-0000-0000-0000-000000000001', null, 'retailer', 'rp100000-0000-0000-0000-000000000001', null, now() - interval '2 days'),
  ('sc100000-0000-0000-0000-000000000012', 'sa100000-0000-0000-0000-000000000007', 'pr200000-0000-0000-0000-000000000002', null, 'retailer', 'rp100000-0000-0000-0000-000000000003', null, now() - interval '1 day'),
  -- Peer scans (Anna shared with Mikkel)
  ('sc100000-0000-0000-0000-000000000013', null, 'pr100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'peer', null, 'c1000000-0000-0000-0000-000000000001', now() - interval '3 days'),
  -- Peer scans (Anna shared with Sofie)
  ('sc100000-0000-0000-0000-000000000014', null, 'pr100000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'peer', null, 'c1000000-0000-0000-0000-000000000001', now() - interval '2 days'),
  -- Peer scans (Sofie shared)
  ('sc100000-0000-0000-0000-000000000015', null, 'pr200000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'peer', null, 'c1000000-0000-0000-0000-000000000003', now() - interval '1 day'),
  -- More retailer scans for volume
  ('sc100000-0000-0000-0000-000000000016', 'sa100000-0000-0000-0000-000000000001', 'pr100000-0000-0000-0000-000000000001', null, 'retailer', 'rp100000-0000-0000-0000-000000000001', null, now() - interval '1 day'),
  ('sc100000-0000-0000-0000-000000000017', 'sa100000-0000-0000-0000-000000000005', 'pr200000-0000-0000-0000-000000000001', null, 'retailer', 'rp100000-0000-0000-0000-000000000001', null, now() - interval '12 hours'),
  ('sc100000-0000-0000-0000-000000000018', 'sa100000-0000-0000-0000-000000000004', 'pr100000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003', 'retailer', 'rp100000-0000-0000-0000-000000000002', null, now() - interval '8 hours'),
  ('sc100000-0000-0000-0000-000000000019', 'sa100000-0000-0000-0000-000000000008', 'pr200000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'retailer', 'rp100000-0000-0000-0000-000000000003', null, now() - interval '4 hours'),
  ('sc100000-0000-0000-0000-000000000020', 'sa100000-0000-0000-0000-000000000006', 'pr200000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', 'retailer', 'rp100000-0000-0000-0000-000000000001', null, now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ORDERS (5 in various statuses)
-- =============================================================================

-- Order 1: Anna buys Essential Tee from STEM (delivered)
INSERT INTO public.orders (id, consumer_user_id, brand_id, status, total_dkk, shipping_name, shipping_address, shipping_city, shipping_postal_code, tracking_number) VALUES
  ('or100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000001', 'delivered', 49900,
   'Anna Hansen', 'Vesterbrogade 42, 3.tv', 'Copenhagen', '1620', 'DK2024000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_variant_id, product_name, size, color, quantity, unit_price_dkk) VALUES
  ('oi100000-0000-0000-0000-000000000001', 'or100000-0000-0000-0000-000000000001', 'pr100000-0000-0000-0000-000000000001', 'pv100001-0000-0000-0000-000000000002', 'The Essential Tee', 'M', 'White', 1, 49900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_events (id, order_id, status, created_at) VALUES
  ('oe100001-0000-0000-0000-000000000001', 'or100000-0000-0000-0000-000000000001', 'pending', now() - interval '6 days'),
  ('oe100001-0000-0000-0000-000000000002', 'or100000-0000-0000-0000-000000000001', 'confirmed', now() - interval '5 days 20 hours'),
  ('oe100001-0000-0000-0000-000000000003', 'or100000-0000-0000-0000-000000000001', 'packed', now() - interval '5 days'),
  ('oe100001-0000-0000-0000-000000000004', 'or100000-0000-0000-0000-000000000001', 'shipped', now() - interval '4 days'),
  ('oe100001-0000-0000-0000-000000000005', 'or100000-0000-0000-0000-000000000001', 'delivered', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Order 2: Mikkel buys Essential Tee (shipped)
INSERT INTO public.orders (id, consumer_user_id, brand_id, status, total_dkk, shipping_name, shipping_address, shipping_city, shipping_postal_code, tracking_number) VALUES
  ('or100000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'bp100000-0000-0000-0000-000000000001', 'shipped', 49900,
   'Mikkel Nielsen', 'Norrebrograde 15, 2.th', 'Copenhagen', '2200', 'DK2024000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_variant_id, product_name, size, color, quantity, unit_price_dkk) VALUES
  ('oi100000-0000-0000-0000-000000000002', 'or100000-0000-0000-0000-000000000002', 'pr100000-0000-0000-0000-000000000001', 'pv100001-0000-0000-0000-000000000003', 'The Essential Tee', 'L', 'Black', 1, 49900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_events (id, order_id, status, created_at) VALUES
  ('oe100002-0000-0000-0000-000000000001', 'or100000-0000-0000-0000-000000000002', 'pending', now() - interval '4 days'),
  ('oe100002-0000-0000-0000-000000000002', 'or100000-0000-0000-0000-000000000002', 'confirmed', now() - interval '3 days 18 hours'),
  ('oe100002-0000-0000-0000-000000000003', 'or100000-0000-0000-0000-000000000002', 'packed', now() - interval '3 days'),
  ('oe100002-0000-0000-0000-000000000004', 'or100000-0000-0000-0000-000000000002', 'shipped', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Order 3: Sofie buys Ribbed Beanie from A Kin (confirmed)
INSERT INTO public.orders (id, consumer_user_id, brand_id, status, total_dkk, shipping_name, shipping_address, shipping_city, shipping_postal_code) VALUES
  ('or100000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'bp100000-0000-0000-0000-000000000002', 'confirmed', 39900,
   'Sofie Larsen', 'Frederiksberg Alle 78', 'Frederiksberg', '1820')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_variant_id, product_name, size, color, quantity, unit_price_dkk) VALUES
  ('oi100000-0000-0000-0000-000000000003', 'or100000-0000-0000-0000-000000000003', 'pr200000-0000-0000-0000-000000000002', 'pv200002-0000-0000-0000-000000000001', 'The Ribbed Beanie', 'One Size', 'Charcoal', 1, 39900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_events (id, order_id, status, created_at) VALUES
  ('oe100003-0000-0000-0000-000000000001', 'or100000-0000-0000-0000-000000000003', 'pending', now() - interval '3 days'),
  ('oe100003-0000-0000-0000-000000000002', 'or100000-0000-0000-0000-000000000003', 'confirmed', now() - interval '2 days 16 hours')
ON CONFLICT (id) DO NOTHING;

-- Order 4: Anna buys Moss Sweater from A Kin (pending)
INSERT INTO public.orders (id, consumer_user_id, brand_id, status, total_dkk, points_used, discount_dkk, shipping_name, shipping_address, shipping_city, shipping_postal_code) VALUES
  ('or100000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'bp100000-0000-0000-0000-000000000002', 'pending', 155900, 40, 4000,
   'Anna Hansen', 'Vesterbrogade 42, 3.tv', 'Copenhagen', '1620')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_variant_id, product_name, size, color, quantity, unit_price_dkk) VALUES
  ('oi100000-0000-0000-0000-000000000004', 'or100000-0000-0000-0000-000000000004', 'pr200000-0000-0000-0000-000000000001', 'pv200001-0000-0000-0000-000000000002', 'The Moss Sweater', 'M', 'Cream', 1, 159900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_events (id, order_id, status, created_at) VALUES
  ('oe100004-0000-0000-0000-000000000001', 'or100000-0000-0000-0000-000000000004', 'pending', now() - interval '8 hours')
ON CONFLICT (id) DO NOTHING;

-- Order 5: Mikkel buys Overshirt from STEM (cancelled)
INSERT INTO public.orders (id, consumer_user_id, brand_id, status, total_dkk, shipping_name, shipping_address, shipping_city, shipping_postal_code) VALUES
  ('or100000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000002', 'bp100000-0000-0000-0000-000000000001', 'cancelled', 129900,
   'Mikkel Nielsen', 'Norrebrograde 15, 2.th', 'Copenhagen', '2200')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_name, size, color, quantity, unit_price_dkk) VALUES
  ('oi100000-0000-0000-0000-000000000005', 'or100000-0000-0000-0000-000000000005', 'pr100000-0000-0000-0000-000000000003', 'The Overshirt', 'L', 'Charcoal', 1, 129900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_events (id, order_id, status, created_at) VALUES
  ('oe100005-0000-0000-0000-000000000001', 'or100000-0000-0000-0000-000000000005', 'pending', now() - interval '7 days'),
  ('oe100005-0000-0000-0000-000000000002', 'or100000-0000-0000-0000-000000000005', 'cancelled', now() - interval '6 days 18 hours')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ATTRIBUTIONS (link orders to scans, calculate commission)
-- =============================================================================

-- Order 1 (Anna, Essential Tee) — direct retailer attribution to Studio Nord
INSERT INTO public.attributions (id, order_id, scan_id, attribution_type, source_retailer_id, commission_rate, commission_amount_dkk, status) VALUES
  ('at100000-0000-0000-0000-000000000001', 'or100000-0000-0000-0000-000000000001', 'sc100000-0000-0000-0000-000000000001', 'direct', 'rp100000-0000-0000-0000-000000000001', 2500, 12475, 'confirmed')
ON CONFLICT (id) DO NOTHING;

-- Order 2 (Mikkel, Essential Tee) — deferred retailer attribution to Kaffebar Vesterbro
INSERT INTO public.attributions (id, order_id, scan_id, attribution_type, source_retailer_id, commission_rate, commission_amount_dkk, status) VALUES
  ('at100000-0000-0000-0000-000000000002', 'or100000-0000-0000-0000-000000000002', 'sc100000-0000-0000-0000-000000000004', 'deferred', 'rp100000-0000-0000-0000-000000000002', 1500, 7485, 'pending')
ON CONFLICT (id) DO NOTHING;

-- Order 3 (Sofie, Ribbed Beanie) — direct retailer attribution to Bloom & Blad
INSERT INTO public.attributions (id, order_id, scan_id, attribution_type, source_retailer_id, commission_rate, commission_amount_dkk, status) VALUES
  ('at100000-0000-0000-0000-000000000003', 'or100000-0000-0000-0000-000000000003', 'sc100000-0000-0000-0000-000000000006', 'direct', 'rp100000-0000-0000-0000-000000000003', 2000, 7980, 'pending')
ON CONFLICT (id) DO NOTHING;

-- Order 4 (Anna, Moss Sweater) — peer attribution from Sofie
INSERT INTO public.attributions (id, order_id, scan_id, attribution_type, source_user_id, points_amount, status) VALUES
  ('at100000-0000-0000-0000-000000000004', 'or100000-0000-0000-0000-000000000004', 'sc100000-0000-0000-0000-000000000015', 'peer', 'c1000000-0000-0000-0000-000000000003', 50, 'pending')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- POINTS LEDGER
-- =============================================================================

INSERT INTO public.points_ledger (id, user_id, amount, reason, order_id, created_at) VALUES
  -- Welcome bonuses
  ('pl100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 100, 'welcome_bonus', null, now() - interval '10 days'),
  ('pl100000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 100, 'welcome_bonus', null, now() - interval '8 days'),
  ('pl100000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 100, 'welcome_bonus', null, now() - interval '6 days'),
  -- Peer referral points (Anna gets 50 pts when Mikkel bought via peer link)
  ('pl100000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 50, 'peer_referral', 'or100000-0000-0000-0000-000000000002', now() - interval '4 days'),
  -- Anna redeemed 40 points on her Moss Sweater order
  ('pl100000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', -40, 'redeemed', 'or100000-0000-0000-0000-000000000004', now() - interval '8 hours'),
  -- Sofie gets 50 points when Anna bought via peer link
  ('pl100000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000003', 50, 'peer_referral', 'or100000-0000-0000-0000-000000000004', now() - interval '8 hours')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SAVED PRODUCTS
-- =============================================================================

INSERT INTO public.saved_products (id, user_id, product_id, saved_at, expires_at) VALUES
  ('sp100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'pr200000-0000-0000-0000-000000000003', now() - interval '5 days', now() + interval '85 days'),
  ('sp100000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'pr100000-0000-0000-0000-000000000004', now() - interval '3 days', now() + interval '87 days'),
  ('sp100000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'pr100000-0000-0000-0000-000000000001', now() - interval '2 days', now() + interval '88 days')
ON CONFLICT (id) DO NOTHING;
