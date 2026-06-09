import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase-admin';
import { createServerSupabaseClient } from '@/lib/supabase-server';
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

  // Genuine peer discovery: a friend shared their product QR (?ref=userId).
  if (refUserId) {
    let peerName = 'a friend';
    const { data: peer } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', refUserId)
      .single();
    if (peer) peerName = peer.name;

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
          source_user_id: refUserId,
        }}
      />
    );
  }

  // No ref → in-app browsing. Don't record a scan; instead surface the user's
  // existing attribution (the retailer where they first scanned, if any).
  let attribution: { type: 'retailer' | 'peer' | 'app'; name: string } = {
    type: 'app',
    name: 'Cirkle',
  };

  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (user) {
    const { data: lastRetailerScan } = await supabase
      .from('scans')
      .select('source_retailer_id, retailer_profiles:source_retailer_id ( name )')
      .eq('product_id', product.id)
      .eq('scanner_user_id', user.id)
      .eq('source_type', 'retailer')
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const retailerName = (lastRetailerScan as any)?.retailer_profiles?.name;
    if (retailerName) {
      attribution = { type: 'retailer', name: retailerName };
    }
  }

  return (
    <ProductPageClient
      product={product}
      brand={brand}
      attribution={attribution}
      recordScan={false}
      scanData={{ product_id: product.id, source_type: 'peer' }}
    />
  );
}
