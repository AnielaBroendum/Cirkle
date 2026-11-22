-- 032: Delete account (Apple App Store rule 5.1.1(v)).
--
-- A shopper can delete their account in the app (POST /api/account/delete).
-- Deleting the auth user cascades to public.profiles. Until now orders and
-- returns cascaded with it, which would remove the sale from brand and store
-- numbers (order items, attributions/commissions, purchase events, returns).
-- From here those rows stay, anonymised: the user column becomes NULL.
--
-- What happens to a deleted shopper's rows:
--   kept, user set to NULL: orders.consumer_user_id, returns.user_id (this file),
--     events.user_id / giver_user_id, scans.scanner_user_id / source_user_id,
--     attributions.source_user_id (already ON DELETE SET NULL)
--   deleted with the profile: points_ledger, saved_products, consumer_consents,
--     push_subscriptions (already ON DELETE CASCADE)
-- The API route blanks the name and address on the orders, and return comments,
-- before deleting the user.
--
-- No columns or tables are dropped or renamed and no data is deleted. RLS is
-- unchanged: shoppers read orders where consumer_user_id = auth.uid() (a NULL
-- row matches nobody), brands read by brand_id.

alter table public.orders alter column consumer_user_id drop not null;
alter table public.orders drop constraint orders_consumer_user_id_fkey;
alter table public.orders
  add constraint orders_consumer_user_id_fkey
  foreign key (consumer_user_id) references public.profiles(id) on delete set null;

alter table public.returns alter column user_id drop not null;
alter table public.returns drop constraint returns_user_id_fkey;
alter table public.returns
  add constraint returns_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;
