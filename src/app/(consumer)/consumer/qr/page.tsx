'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { QrCode, Lock, Check, Share2, Sparkles } from 'lucide-react';

type OrderRow = {
  id: string;
  status: string;
  order_items: {
    product_id: string;
    product_name: string;
    products: { images: string[] | null } | null;
  }[];
};

type WalletCard = {
  key: string;
  productName: string;
  image?: string;
  status: string;
  qrDataUrl?: string;
  url?: string;
};

export default function ConsumerQRWalletPage() {
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
          order_items ( product_id, product_name, products ( images ) )
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
        await navigator.share({ title: `${card.productName} — Cirkle`, url: card.url });
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-[28px] italic leading-tight text-espresso-cream">
          My QR codes
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-espresso-muted">
          Share what you own. When a friend scans your code and buys, you earn{' '}
          <span className="text-terracotta">50 Cirkle Points</span>.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-espresso-surface" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="py-16 text-center">
          <QrCode className="mx-auto h-12 w-12 text-espresso-muted-2" />
          <p className="mt-3 font-medium text-espresso-cream">No QR codes yet</p>
          <p className="mt-1 text-sm text-espresso-muted">
            Buy something — your shareable code appears once it&apos;s delivered.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <div
              key={card.key}
              className="overflow-hidden rounded-2xl border border-espresso-line bg-espresso-surface"
            >
              {/* Product header */}
              <div className="flex items-center gap-3 p-4">
                {card.image ? (
                  <div className="relative h-12 w-12 flex-none overflow-hidden rounded-xl">
                    <Image src={card.image} alt={card.productName} fill className="object-cover" sizes="48px" />
                  </div>
                ) : (
                  <div className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-espresso-surface-2">
                    <QrCode className="h-5 w-5 text-espresso-muted-2" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[15px] text-espresso-cream">{card.productName}</p>
                  <p className="text-[11.5px] text-espresso-muted">
                    {card.status === 'delivered' ? 'Live · ready to share' : 'Unlocks when delivered'}
                  </p>
                </div>
              </div>

              {/* QR or locked state */}
              {card.status === 'delivered' && card.qrDataUrl ? (
                <div className="flex flex-col items-center gap-4 border-t border-espresso-line p-5">
                  <div className="rounded-2xl bg-espresso-cream p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.qrDataUrl} alt="QR code" className="h-44 w-44" />
                  </div>
                  <p className="flex items-center gap-1.5 text-[12px] text-espresso-muted">
                    <Sparkles className="h-3.5 w-3.5 text-gold" />
                    Friends scan this to buy — you earn 50 points
                  </p>
                  <button
                    onClick={() => handleShare(card)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta py-3 font-bold text-espresso-bg transition active:scale-[0.98]"
                  >
                    {copied === card.key ? (
                      <>
                        <Check className="h-4 w-4" /> Link copied
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4" /> Share code
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 border-t border-espresso-line p-6 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-espresso-surface-2">
                    <Lock className="h-5 w-5 text-espresso-muted-2" />
                  </div>
                  <p className="text-[12.5px] text-espresso-muted">
                    Your shareable QR appears here once this order is delivered.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
