'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { Lock, Check, Share2 } from 'lucide-react';
import { ScreenHeader, Thumb } from '@/components/consumer/checkout-parts';

type OrderRow = {
  id: string;
  status: string;
  order_items: {
    product_id: string;
    product_name: string;
    products: { images: string[] | null; brand_profiles: { name: string } | null } | null;
  }[];
};

type WalletCard = {
  key: string;
  productName: string;
  image?: string;
  brandName?: string;
  status: string;
  qrDataUrl?: string;
  url?: string;
};

function ConsumerQRWalletPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusOrder = searchParams.get('order');
  const focusProduct = searchParams.get('product');
  const { user } = useAuth();
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    (async () => {
      const { data } = await supabase
        .from('orders')
        .select(`
          id, status,
          order_items ( product_id, product_name, products ( images, brand_profiles ( name ) ) )
        `)
        .eq('consumer_user_id', user.id)
        .order('created_at', { ascending: false });

      const orders = (data as OrderRow[] | null) ?? [];
      const result: WalletCard[] = [];

      for (const order of orders) {
        const items = order.order_items ?? [];

        if (order.status === 'delivered') {
          // Fetch the live, scannable QR codes for this delivered order.
          let qrCodes: { product_id: string; url: string; qr_data_url: string }[] = [];
          try {
            const res = await fetch(`/api/orders/${order.id}/qr`);
            if (res.ok) qrCodes = (await res.json()).qr_codes ?? [];
          } catch {
            /* leave empty — card will show without the image */
          }

          for (const item of items) {
            const qr = qrCodes.find((q) => q.product_id === item.product_id);
            result.push({
              key: `${order.id}-${item.product_id}`,
              productName: item.product_name,
              image: item.products?.images?.[0],
              brandName: item.products?.brand_profiles?.name,
              status: 'delivered',
              qrDataUrl: qr?.qr_data_url,
              url: qr?.url,
            });
          }
        } else {
          for (const item of items) {
            result.push({
              key: `${order.id}-${item.product_id}`,
              productName: item.product_name,
              image: item.products?.images?.[0],
              brandName: item.products?.brand_profiles?.name,
              status: order.status,
            });
          }
        }
      }

      setCards(result);
      setLoading(false);
    })();
  }, [user]);

  async function handleShare(card: WalletCard) {
    if (!card.url) return;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${card.productName} — Flaym`, url: card.url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(card.url);
      setCopied(card.key);
      setTimeout(() => setCopied((c) => (c === card.key ? null : c)), 2000);
    } catch {
      /* ignore */
    }
  }

  const focusKey = focusOrder && focusProduct ? `${focusOrder}-${focusProduct}` : null;
  const focused = focusKey ? cards.find((c) => c.key === focusKey) : null;

  // ---- Single item: Figma 10b "Pass it on (from Owned)" ----
  if (focusKey) {
    return (
      <div className="pb-40">
        <ScreenHeader title="Pass it on" onBack={() => router.back()} />
        {loading ? (
          <div className="px-5 pt-5" aria-busy>
            <div className="h-[70px] animate-pulse bg-surface-dark" />
            <div className="mx-auto mt-5 h-[270px] w-[270px] animate-pulse bg-surface-dark" />
          </div>
        ) : !focused ? (
          <div className="px-5 pt-16 text-center">
            <p className="text-body text-on-primary">This item isn&rsquo;t in your Owned list.</p>
            <Link href="/consumer/qr" className="mt-3 inline-block text-caption text-accent">
              See all your QR codes
            </Link>
          </div>
        ) : (
          <div className="px-5 pt-3">
            <div className="flex items-center gap-3.5">
              <Thumb src={focused.image ?? null} alt={focused.productName} className="h-[70px] w-14" />
              <div className="min-w-0">
                <p className="truncate text-body text-on-primary">{focused.productName}</p>
                <p className="truncate text-caption text-smoke">
                  {[focused.brandName, focused.status === 'delivered' ? 'Owned' : 'On its way'].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {focused.qrDataUrl ? (
              <>
                <div className="mx-auto mt-5 w-[270px] bg-on-primary p-[18px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={focused.qrDataUrl} alt="QR code to pass it on" className="h-[234px] w-[234px]" />
                </div>
                <p className="mt-5 text-center text-body text-on-primary">Let your friend scan this code.</p>
                <p className="mt-1 text-center text-body text-ash">If they buy, your flame is lit.</p>
              </>
            ) : (
              <p className="mt-10 text-center text-body text-ash">
                {focused.status === 'delivered'
                  ? 'We couldn’t load the code. Try again in a moment.'
                  : 'Your code appears once this order is delivered.'}
              </p>
            )}
          </div>
        )}
        {focused?.url && (
          <div className="fixed inset-x-0 bottom-16 z-30 bg-canvas-dark">
            <div className="mx-auto max-w-lg px-5 py-3">
              <button
                type="button"
                onClick={() => handleShare(focused)}
                className="flex h-[52px] w-full items-center justify-center gap-2 bg-on-primary text-body-lg font-medium text-primary hover:bg-on-primary/90"
              >
                {copied === focused.key ? (
                  <>
                    <Check className="h-4 w-4" /> Link copied
                  </>
                ) : (
                  'Share link'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- All codes ----
  return (
    <div className="pb-8">
      <ScreenHeader title="Your QR codes" onBack={() => router.back()} />
      <p className="px-5 pt-3 text-caption text-ash">
        Share what you own. When a friend scans your code and buys, your flame is lit and you get <span className="text-accent">50 Flayms</span>.
      </p>

      <div className="px-5 pt-5">
        {loading ? (
          <div className="space-y-4" aria-busy>
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse bg-surface-dark" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="bg-surface-dark p-4">
            <p className="text-body text-on-primary">No QR codes yet</p>
            <p className="mt-1 text-caption text-smoke">Buy something. Your shareable code appears once it&rsquo;s delivered.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {cards.map((card) => (
              <li key={card.key} className="bg-surface-dark">
                <div className="flex items-center gap-3.5 p-4">
                  <Thumb src={card.image ?? null} alt={card.productName} className="h-[60px] w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-on-primary">{card.productName}</p>
                    <p className="text-caption text-smoke">{card.status === 'delivered' ? 'Owned · ready to pass on' : 'Unlocks when delivered'}</p>
                  </div>
                  {card.status !== 'delivered' && <Lock className="h-4 w-4 text-smoke" aria-hidden />}
                </div>
                {card.status === 'delivered' && card.qrDataUrl && (
                  <div className="flex flex-col items-center gap-4 border-t border-line-dark p-5">
                    <div className="bg-on-primary p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={card.qrDataUrl} alt="QR code" className="h-44 w-44" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleShare(card)}
                      className="flex h-11 w-full items-center justify-center gap-2 bg-on-primary text-body font-medium text-primary hover:bg-on-primary/90"
                    >
                      {copied === card.key ? (
                        <>
                          <Check className="h-4 w-4" /> Link copied
                        </>
                      ) : (
                        <>
                          <Share2 className="h-4 w-4" /> Share link
                        </>
                      )}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary on statically rendered routes.
export default function ConsumerQRPage() {
  return (
    <Suspense fallback={null}>
      <ConsumerQRWalletPage />
    </Suspense>
  );
}
