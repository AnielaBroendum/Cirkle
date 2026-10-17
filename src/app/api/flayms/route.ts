import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

// Read-only stats for the Flayms tab (Figma 08), Profile ("6 lit") and the
// owned-item screen (Figma 18). RLS doesn't let a consumer read other people's
// scans or orders, so after checking the user this reads with the admin client
// and returns only aggregates plus first names.
//
//   passed on = peer scans of your QR codes by someone else
//   lit       = orders attributed to you as the peer (each earned you 50 points)

type Latest = {
  type: 'lit' | 'passed';
  productId: string;
  productName: string;
  image: string | null;
  friend: string | null;
  at: string;
};

const firstName = (name?: string | null) => (name ? name.trim().split(/\s+/)[0] : null);

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const [scansRes, litRes, balanceRes] = await Promise.all([
    admin
      .from('scans')
      .select('id, product_id, scanned_at, scanner_user_id, profiles:scanner_user_id ( name ), products ( name, images )')
      .eq('source_type', 'peer')
      .eq('source_user_id', user.id)
      .order('scanned_at', { ascending: false })
      .limit(500),
    admin
      .from('attributions')
      .select(`
        id, created_at,
        orders ( consumer_user_id, profiles:consumer_user_id ( name ), order_items ( product_id, product_name, products ( images ) ) )
      `)
      .eq('attribution_type', 'peer')
      .eq('source_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500),
    admin.rpc('get_points_balance', { p_user_id: user.id }),
  ]);

  if (scansRes.error || litRes.error) {
    console.error('[api/flayms]', scansRes.error?.message ?? litRes.error?.message);
    return NextResponse.json({ error: 'Could not load Flayms' }, { status: 500 });
  }

  // Your own scans of your own QR don't count as passing it on.
  const scans = (scansRes.data as any[]).filter((s) => s.scanner_user_id !== user.id);
  const lit = litRes.data as any[];

  const byProduct: Record<string, { passedOn: number; lit: number }> = {};
  const bump = (id: string, key: 'passedOn' | 'lit') => {
    byProduct[id] ??= { passedOn: 0, lit: 0 };
    byProduct[id][key]++;
  };

  const latest: Latest[] = [];

  for (const s of scans) {
    bump(s.product_id, 'passedOn');
    latest.push({
      type: 'passed',
      productId: s.product_id,
      productName: s.products?.name ?? 'Product',
      image: s.products?.images?.[0] ?? null,
      friend: firstName(s.profiles?.name),
      at: s.scanned_at,
    });
  }

  for (const a of lit) {
    const item = a.orders?.order_items?.[0];
    if (!item) continue;
    bump(item.product_id, 'lit');
    latest.push({
      type: 'lit',
      productId: item.product_id,
      productName: item.product_name,
      image: item.products?.images?.[0] ?? null,
      friend: firstName(a.orders?.profiles?.name),
      at: a.created_at,
    });
  }

  latest.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

  return NextResponse.json({
    passedOn: scans.length,
    lit: lit.length,
    balance: balanceRes.data ?? 0,
    byProduct,
    latest: latest.slice(0, 30),
  });
}
