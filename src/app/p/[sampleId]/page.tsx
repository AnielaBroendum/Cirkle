import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase-admin';
import ProductPageClient from '@/components/consumer/product-page-client';

export const dynamic = 'force-dynamic';

export default async function ScanPage({ params }: { params: { sampleId: string } }) {
  const { sampleId } = params;
  const supabase = createAdminClient();

  const { data: sample, error } = await supabase
    .from('samples')
    .select(`
      id,
      product_id,
      retailer_id,
      brand_id,
      status,
      products (
        id, name, description, price_dkk, images, sizes, colors, materials, category
      ),
      brand_profiles (
        id, name, description, logo_url
      ),
      retailer_profiles (
        id, name
      )
    `)
    .eq('id', sampleId)
    .eq('status', 'active')
    .single();

  if (error) {
    console.error('[/p] Supabase query error:', error.message, error.code, error.details);
  }

  if (!sample || !sample.products || !sample.brand_profiles || !sample.retailer_profiles) {
    console.error('[/p] Missing data — sample:', !!sample, 'products:', !!sample?.products, 'brand:', !!sample?.brand_profiles, 'retailer:', !!sample?.retailer_profiles);
    notFound();
  }

  const product = sample.products as any;
  const brand = sample.brand_profiles as any;
  const retailer = sample.retailer_profiles as any;

  return (
    <ProductPageClient
      product={product}
      brand={brand}
      attribution={{
        type: 'retailer',
        name: retailer.name,
      }}
      scanData={{
        sample_id: sample.id,
        product_id: product.id,
        source_type: 'retailer',
        source_retailer_id: retailer.id,
      }}
    />
  );
}
