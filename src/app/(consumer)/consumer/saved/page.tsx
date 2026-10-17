'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { X } from 'lucide-react';
import { cn } from '@/components/ds';
import ProfileHeader from '@/components/consumer/profile-header';
import { Thumb } from '@/components/consumer/checkout-parts';

type SavedProduct = {
  id: string;
  product_id: string;
  saved_at: string;
  expires_at: string;
  products: {
    id: string;
    name: string;
    price_dkk: number;
    images: string[];
    brand_profiles: { name: string };
  };
};

export default function ConsumerSavedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('saved_products')
      .select(`
        id, product_id, saved_at, expires_at,
        products (
          id, name, price_dkk, images,
          brand_profiles (name)
        )
      `)
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .then(({ data }: { data: SavedProduct[] | null }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, [user]);

  async function handleRemove(e: React.MouseEvent, productId: string) {
    e.preventDefault();
    e.stopPropagation();
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
    await fetch('/api/saved-products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    });
  }

  function daysLeft(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="pb-8">
      <ProfileHeader savedCount={loading ? undefined : items.length} />

      <div className="px-5 pt-1.5">
        {loading ? (
          <div className="divide-y divide-line-dark" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3.5 py-3.5">
                <div className="ml-1.5 h-20 w-16 animate-pulse bg-surface-dark" />
                <div className="h-4 w-40 animate-pulse bg-surface-dark" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-2 bg-surface-dark p-4">
            <p className="text-body text-on-primary">Nothing saved yet</p>
            <p className="mt-1 text-caption text-muted">Scan a Flaym tag and tap Save. The store still gets its cut if you buy within 90 days.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line-dark">
            {items.map((item) => {
              const product = item.products;
              const days = daysLeft(item.expires_at);
              const expired = days === 0;

              return (
                <li key={item.id} className={cn('flex items-center gap-3.5 py-3.5', expired && 'opacity-50')}>
                  <Link href={`/d/${product.id}`} className="flex min-w-0 flex-1 items-center gap-3.5 pl-1.5">
                    <Thumb src={product?.images?.[0] ?? null} alt={product.name} className="h-20 w-16" />
                    <div className="min-w-0">
                      <p className="truncate text-body text-on-primary">{product?.name}</p>
                      <p className="truncate text-caption text-muted">
                        {product?.brand_profiles?.name} · {formatDKK(product?.price_dkk || 0)}
                      </p>
                      <p className={cn('mt-1 text-label tracking-normal', expired ? 'text-accent' : 'text-muted')}>
                        {expired ? 'Expired' : `${days} days left`}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {!expired && (
                      <a
                        href={`/consumer/checkout/${product.id}`}
                        className="rounded-pill bg-accent px-2.5 py-0.5 text-caption font-medium text-on-primary hover:bg-accent/90"
                      >
                        Buy
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, item.product_id)}
                      aria-label={`Remove ${product?.name}`}
                      className="grid h-6 w-6 place-items-center text-muted hover:text-on-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
