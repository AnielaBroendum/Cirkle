-- Make retailer_id nullable for the invitation flow
-- (retailer doesn't exist yet when brand sends the invite)
ALTER TABLE public.brand_retailer_partnerships ALTER COLUMN retailer_id DROP NOT NULL;

-- Replace unique constraint — only enforce when retailer_id is set
ALTER TABLE public.brand_retailer_partnerships
  DROP CONSTRAINT IF EXISTS brand_retailer_partnerships_brand_id_retailer_id_key;
CREATE UNIQUE INDEX partnerships_brand_retailer_unique
  ON public.brand_retailer_partnerships(brand_id, retailer_id)
  WHERE retailer_id IS NOT NULL;

-- Allow retailers to insert partnership requests
CREATE POLICY "Retailer can insert partnership request"
  ON public.brand_retailer_partnerships
  FOR INSERT WITH CHECK (
    retailer_id IN (SELECT id FROM public.retailer_profiles WHERE user_id = auth.uid())
  );

-- Allow users to accept invitations by token
CREATE POLICY "Users can accept invitation by token"
  ON public.brand_retailer_partnerships
  FOR UPDATE
  USING (invitation_token IS NOT NULL AND status = 'invited')
  WITH CHECK (
    retailer_id IN (SELECT id FROM public.retailer_profiles WHERE user_id = auth.uid())
  );
