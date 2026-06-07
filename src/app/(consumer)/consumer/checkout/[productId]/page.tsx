'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, Minus, Plus, Package, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';

type Product = {
  id: string;
  name: string;
  price_dkk: number;
  images: string[];
  sizes: string[];
  colors: string[];
  brand_profiles: { id: string; name: string };
};

type OrderResult = {
  order_id: string;
  order_number: number;
  brand_name: string;
  product_name: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { productId } = useParams<{ productId: string }>();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [shippingName, setShippingName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('products')
      .select('id, name, price_dkk, images, sizes, colors, brand_profiles(id, name)')
      .eq('id', productId)
      .eq('is_active', true)
      .single()
      .then(({ data }: { data: Product | null }) => {
        if (!data) {
          router.push('/');
          return;
        }
        setProduct(data);
        if (data.sizes?.length === 1) setSelectedSize(data.sizes[0]);
        if (data.colors?.length === 1) setSelectedColor(data.colors[0]);
        setLoading(false);
      });

    supabase
      .rpc('get_points_balance', { p_user_id: user.id })
      .then(({ data }: { data: number | null }) => {
        setPointsBalance(data ?? 0);
      });
  }, [user, productId, router]);

  if (!user) {
    router.push(`/auth/signup?role=consumer&redirect=/consumer/checkout/${productId}`);
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;

    if (product.sizes?.length > 0 && !selectedSize) {
      setError('Vælg en størrelse');
      return;
    }
    if (product.colors?.length > 0 && !selectedColor) {
      setError('Vælg en farve');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          size: selectedSize || null,
          color: selectedColor || null,
          shipping_name: shippingName,
          shipping_address: shippingAddress,
          shipping_city: shippingCity,
          shipping_postal_code: shippingPostalCode,
          points_to_use: pointsToUse,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Noget gik galt');
        setSubmitting(false);
        return;
      }

      setOrderResult(data);
    } catch {
      setError('Netværksfejl — prøv igen');
      setSubmitting(false);
    }
  }

  const maxPointsUsable = product ? Math.floor(product.price_dkk / 100) : 0;
  const pointsCapped = Math.min(pointsBalance, maxPointsUsable);
  const discountOre = pointsToUse * 100;
  const totalOre = product ? Math.max(product.price_dkk - discountOre, 0) : 0;

  if (orderResult) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Ordre bekræftet!</h1>
        <p className="text-gray-600 mb-1">
          Din <span className="font-medium">{orderResult.product_name}</span> bliver pakket hos{' '}
          <span className="font-medium">{orderResult.brand_name}</span>&apos;s studie.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Forventet levering: 3-5 hverdage
        </p>
        <p className="text-xs text-gray-400 mb-8">Ordre #{orderResult.order_number}</p>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => router.push(`/consumer/orders/${orderResult.order_id}`)}
            className="flex-1 bg-cirkle-600 text-white font-medium py-3 rounded-xl hover:bg-cirkle-700 transition"
          >
            Se ordre
          </button>
          <button
            onClick={() => router.push('/consumer/home')}
            className="flex-1 border border-gray-200 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition"
          >
            Hjem
          </button>
        </div>
      </div>
    );
  }

  if (loading || !product) {
    return <div className="py-12 text-center text-gray-400 animate-pulse">Henter produkt...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-gray-600">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
      </div>

      {/* Product summary */}
      <div className="flex gap-4 p-4 bg-gray-50 rounded-xl">
        {product.images?.[0] ? (
          <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
            <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="80px" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{product.brand_profiles.name}</p>
          <p className="font-semibold text-gray-900 truncate">{product.name}</p>
          <p className="text-sm font-medium text-gray-700 mt-1">{formatDKK(product.price_dkk)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Size selector */}
        {product.sizes?.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Størrelse</label>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition ${
                    selectedSize === size
                      ? 'border-cirkle-500 bg-cirkle-50 text-cirkle-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color selector */}
        {product.colors?.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Farve</label>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition ${
                    selectedColor === color
                      ? 'border-cirkle-500 bg-cirkle-50 text-cirkle-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shipping */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Leveringsadresse</h2>
          <input
            type="text"
            required
            placeholder="Fulde navn"
            value={shippingName}
            onChange={(e) => setShippingName(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          />
          <input
            type="text"
            required
            placeholder="Adresse"
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          />
          <div className="flex gap-3">
            <input
              type="text"
              required
              placeholder="Postnummer"
              value={shippingPostalCode}
              onChange={(e) => setShippingPostalCode(e.target.value)}
              className="w-1/3 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
            />
            <input
              type="text"
              required
              placeholder="By"
              value={shippingCity}
              onChange={(e) => setShippingCity(e.target.value)}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Points redemption */}
        {pointsBalance > 0 && (
          <div className="p-4 bg-cirkle-50 rounded-xl border border-cirkle-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-cirkle-900">Brug Cirkle Points</h3>
              <span className="text-xs text-cirkle-600">{pointsBalance} point tilgængelige</span>
            </div>
            <p className="text-xs text-cirkle-700 mb-3">1 point = 1 kr rabat</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPointsToUse(Math.max(0, pointsToUse - 10))}
                disabled={pointsToUse <= 0}
                className="p-2 rounded-lg border border-cirkle-200 text-cirkle-600 hover:bg-cirkle-100 disabled:opacity-40 transition"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-2xl font-bold text-cirkle-900">{pointsToUse}</span>
                <span className="text-sm text-cirkle-600 ml-1">point</span>
              </div>
              <button
                type="button"
                onClick={() => setPointsToUse(Math.min(pointsCapped, pointsToUse + 10))}
                disabled={pointsToUse >= pointsCapped}
                className="p-2 rounded-lg border border-cirkle-200 text-cirkle-600 hover:bg-cirkle-100 disabled:opacity-40 transition"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {pointsToUse > 0 && (
              <p className="text-center text-sm text-cirkle-700 mt-2 font-medium">
                -{formatDKK(discountOre)} rabat
              </p>
            )}
          </div>
        )}

        {/* Order summary */}
        <div className="border-t border-gray-200 pt-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Produkt</span>
            <span>{formatDKK(product.price_dkk)}</span>
          </div>
          {pointsToUse > 0 && (
            <div className="flex justify-between text-sm text-cirkle-600">
              <span>Point rabat</span>
              <span>-{formatDKK(discountOre)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>Levering</span>
            <span className="text-green-600">Gratis</span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>{formatDKK(totalOre)}</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-cirkle-600 text-white font-semibold py-3.5 rounded-xl hover:bg-cirkle-700 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {submitting ? 'Behandler...' : `Bekræft ordre — ${formatDKK(totalOre)}`}
        </button>
      </form>
    </div>
  );
}
