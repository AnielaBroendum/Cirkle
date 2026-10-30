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
        id, name, description, logo_url,
        brand_stories ( id, kind, url, duration_seconds, position )
      )
    `)
    .eq('id', productId)
    .eq('is_active', true)
    .single();

  if (!product || !product.brand_profiles) {
    notFound();
  }

  const brand = product.brand_profiles as any;
  const { data: variantRows } = await supabase
    .from('product_variants')
    .select('size, color, stock_count, price_dkk')
    .eq('product_id', product.id);
  const variants = variantRows ?? [];

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
        variants={variants}
        attribution={{
          type: 'peer',
          name: peerName,
          peerPointsMessage: `${peerName} gets 50 Flayms if you buy`,
        }}
        scanData={{
          product_id: product.id,
          source_type: 'peer',
          source_user_id: refUserId,
        }}
      />
    );
  }

  // No ref → in-app browsing (Saved, History, Home). Same 04b layout as a scan.
  // A save shows the store it credits ("Saved at …", Figma 04c); otherwise the
  // first scan shows where you found it. Never invent attribution: with
  // neither, the page just has no "Found at" line.
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirect=/d/${product.id}`);
  }

  const scanSource = 'source_type, scanned_at, retailer_profiles:source_retailer_id ( name ), profiles:source_user_id ( name )';
  const [{ data: save }, { data: firstScan }] = await Promise.all([
    supabase
      .from('saved_products')
      .select(`size, saved_at, scans:scan_id ( ${scanSource} )`)
      .eq('product_id', product.id)
      .eq('user_id', user!.id)
      .maybeSingle(),
    supabase
      .from('scans')
      .select(scanSource)
      .eq('product_id', product.id)
      .eq('scanner_user_id', user!.id)
      .order('scanned_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const scan = ((save as any)?.scans ?? firstScan) as any;
  const retailerName = scan?.retailer_profiles?.name as string | undefined;
  const peerName = scan?.profiles?.name as string | undefined;

  const attribution = !scan
    ? null
    : scan.source_type === 'retailer' && retailerName
      ? { type: 'retailer' as const, name: retailerName, scannedAt: scan.scanned_at }
      : { type: 'peer' as const, name: peerName ?? 'a friend', scannedAt: scan.scanned_at };

  return (
    <ProductPageClient
      product={product}
      brand={brand}
      variants={variants}
      attribution={attribution}
      saved={save ? { size: (save as any).size ?? null } : undefined}
      recordScan={false}
      scanData={{ product_id: product.id, source_type: 'peer' }}
    />
  );
}
