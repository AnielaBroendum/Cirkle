import { notFound, redirect } from 'next/navigation';
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

  // No ref → opening a product you already discovered (e.g. from your Home or
  // Saved). Surface where/when YOU scanned it; never invent attribution. If you
  // never scanned this product, there's nothing to discover — go home.
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirect=/d/${product.id}`);
  }

  // First scan wins: show where the user FIRST discovered this product, even if
  // it's displayed at several retailers and scanned more than once.
  const { data: firstScan } = await supabase
    .from('scans')
    .select(
      'source_type, scanned_at, retailer_profiles:source_retailer_id ( name ), profiles:source_user_id ( name )'
    )
    .eq('product_id', product.id)
    .eq('scanner_user_id', user!.id)
    .order('scanned_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstScan) {
    redirect('/consumer/home');
  }

  const scan = firstScan as any;
  const retailerName = scan.retailer_profiles?.name as string | undefined;
  const peerName = scan.profiles?.name as string | undefined;

  const attribution =
    scan.source_type === 'retailer' && retailerName
      ? { type: 'retailer' as const, name: retailerName, scannedAt: scan.scanned_at }
      : { type: 'peer' as const, name: peerName ?? 'a friend', scannedAt: scan.scanned_at };

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
