import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase-admin';
import ProductPageClient from '@/components/consumer/product-page-client';

export default async function PeerDiscoveryPage({
  params,
  searchParams,
}: {
  params: { productId: string };
  searchParams: { ref?: string };
}) {
  const { productId } = params;
  const refUserId = searchParams.ref;
  const supabase = createAdminClient();

  const { data: product } = await supabase
    .from('products')
    .select(`
      id, name, description, price_dkk, images, sizes, colors, materials, category,
      brand_profiles (
        id, name, description, logo_url
      )
    `)
    .eq('id', productId)
    .eq('is_active', true)
    .single();

  if (!product || !product.brand_profiles) {
    notFound();
  }

  const brand = product.brand_profiles as any;

  let peerName = 'a friend';
  if (refUserId) {
    const { data: peer } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', refUserId)
      .single();
    if (peer) peerName = peer.name;
  }

  return (
    <ProductPageClient
      product={product}
      brand={brand}
      attribution={{
        type: 'peer',
        name: peerName,
        peerPointsMessage: `${peerName} gets 50 points if you buy`,
      }}
      scanData={{
        product_id: product.id,
        source_type: 'peer',
        source_user_id: refUserId || undefined,
      }}
    />
  );
}
