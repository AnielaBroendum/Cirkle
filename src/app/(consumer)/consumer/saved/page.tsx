'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Heart, ShoppingBag, Eye, X, Package } from 'lucide-react';

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

  if (loading) {
    return <div className="py-12 text-center text-gray-400 animate-pulse">Henter gemte...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Gemte produkter</h1>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 text-gray-500">Ingen gemte produkter</p>
          <p className="text-sm text-gray-400 mt-1">Scan en QR-kode og tryk på hjertet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const product = item.products;
            const imageUrl = product?.images?.[0];
            const days = daysLeft(item.expires_at);
            const expired = days === 0;

            return (
              <Link
                key={item.id}
                href={`/d/${product.id}`}
                className={`relative bg-white rounded-xl border overflow-hidden block no-underline ${
                  expired ? 'opacity-50 border-gray-200' : 'border-gray-100 active:border-gray-300'
                }`}
              >
                {/* Remove button */}
                <button
                  onClick={(e) => handleRemove(e, item.product_id)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Image */}
                {imageUrl ? (
                  <div className="relative aspect-square">
                    <Image src={imageUrl} alt={product.name} fill className="object-cover" sizes="50vw" />
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    <Package className="h-8 w-8 text-gray-300" />
                  </div>
                )}

                {/* Info */}
                <div className="p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {product?.brand_profiles?.name}
                  </p>
                  <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{product?.name}</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{formatDKK(product?.price_dkk || 0)}</p>

                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[10px] font-medium ${expired ? 'text-red-500' : 'text-gray-400'}`}>
                      {expired ? 'Udløbet' : `${days} dage tilbage`}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-2">
                    {!expired && (
                      <a
                        href={`/consumer/checkout/${product.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-cirkle-600 text-white text-xs font-medium py-2 rounded-lg hover:bg-cirkle-700 active:bg-cirkle-800 transition no-underline"
                      >
                        <ShoppingBag className="h-3 w-3" />
                        Køb nu
                      </a>
                    )}
                    <span className="flex items-center justify-center gap-1 text-xs text-gray-400 py-2 px-2">
                      <Eye className="h-3 w-3" />
                      Se
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
