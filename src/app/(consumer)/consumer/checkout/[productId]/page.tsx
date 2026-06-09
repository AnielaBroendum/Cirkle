'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, Minus, Plus, Package, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
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
  const { user, loading: authLoading } = useAuth();

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

  // Only redirect to signup once auth has actually resolved — otherwise we'd
  // bounce logged-in users straight past checkout on the first render.
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth/signup?role=consumer&redirect=/consumer/checkout/${productId}`);
    }
  }, [authLoading, user, productId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;

    if (product.sizes?.length > 0 && !selectedSize) {
      setError('Please select a size');
      return;
    }
    if (product.colors?.length > 0 && !selectedColor) {
      setError('Please select a colour');
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
        setError(data.error || 'Something went wrong');
        setSubmitting(false);
        return;
      }

      setOrderResult(data);
    } catch {
      setError('Network error — please try again');
      setSubmitting(false);
    }
  }

  const maxPointsUsable = product ? Math.floor(product.price_dkk / 100) : 0;
  const pointsCapped = Math.min(pointsBalance, maxPointsUsable);
  const discountOre = pointsToUse * 100;
  const shippingOre = 4900;
  const totalOre = product ? Math.max(product.price_dkk + shippingOre - discountOre, 0) : 0;

  // ---- Success ----
  if (orderResult) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-sage/20">
          <CheckCircle2 className="h-8 w-8 text-sage" />
        </div>
        <h1 className="mb-2 font-display text-[26px] italic text-espresso-cream">Order confirmed</h1>
        <p className="mb-1 text-espresso-muted">
          Your <span className="text-espresso-cream">{orderResult.product_name}</span> is being packed at{' '}
          <span className="text-espresso-cream">{orderResult.brand_name}</span>&apos;s studio.
        </p>
        <p className="mb-6 text-sm text-espresso-muted-2">Expected delivery: 3–5 business days</p>
        <p className="mb-8 text-xs text-espresso-muted-2">Order #{orderResult.order_number}</p>
        <div className="flex w-full max-w-xs gap-3">
          <button
            onClick={() => router.push(`/consumer/orders/${orderResult.order_id}`)}
            className="flex-1 rounded-2xl bg-terracotta py-3 font-bold text-espresso-bg transition active:scale-[0.98]"
          >
            View order
          </button>
          <button
            onClick={() => router.push('/consumer/home')}
            className="flex-1 rounded-2xl border border-espresso-line py-3 font-semibold text-espresso-cream transition hover:bg-espresso-surface"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (loading || !product) {
    return (
      <div className="space-y-5">
        <div className="h-6 w-28 animate-pulse rounded bg-espresso-surface" />
        <div className="h-24 animate-pulse rounded-2xl bg-espresso-surface" />
        <div className="h-40 animate-pulse rounded-2xl bg-espresso-surface" />
      </div>
    );
  }

  const chip = (active: boolean) =>
    `min-w-[46px] rounded-[13px] border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
      active
        ? 'border-espresso-cream bg-espresso-cream text-espresso-bg'
        : 'border-espresso-line bg-espresso-surface text-espresso-cream'
    }`;

  const input =
    'w-full rounded-xl border border-espresso-line bg-espresso-surface px-4 py-3 text-sm text-espresso-cream placeholder:text-espresso-muted-2 focus:border-terracotta focus:outline-none';

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="-ml-1 p-1 text-espresso-cream">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-[24px] italic text-espresso-cream">My bag</h1>
      </div>

      {/* Bag item */}
      <div className="flex gap-3.5 rounded-2xl border border-espresso-line bg-espresso-surface p-3.5">
        {product.images?.[0] ? (
          <div className="relative h-[88px] w-[70px] flex-shrink-0 overflow-hidden rounded-xl">
            <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="70px" />
          </div>
        ) : (
          <div className="grid h-[88px] w-[70px] flex-shrink-0 place-items-center rounded-xl bg-espresso-surface-2">
            <Package className="h-7 w-7 text-espresso-muted-2" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[1.3px] text-terracotta">
            {product.brand_profiles.name}
          </p>
          <p className="mt-0.5 truncate font-display text-[15px] text-espresso-cream">{product.name}</p>
          <p className="mt-0.5 text-[11.5px] text-espresso-muted">
            {[selectedSize && `Size ${selectedSize}`, selectedColor].filter(Boolean).join(' · ') || 'Select options below'}
          </p>
          <p className="mt-1.5 text-sm font-bold text-espresso-cream">{formatDKK(product.price_dkk)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Size */}
        {product.sizes?.length > 0 && (
          <div>
            <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[1.8px] text-espresso-muted-2">Size</h3>
            <div className="flex flex-wrap gap-2.5">
              {product.sizes.map((size) => (
                <button key={size} type="button" onClick={() => setSelectedSize(size)} className={chip(selectedSize === size)}>
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Colour */}
        {product.colors?.length > 0 && (
          <div>
            <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[1.8px] text-espresso-muted-2">Colour</h3>
            <div className="flex flex-wrap gap-2.5">
              {product.colors.map((color) => (
                <button key={color} type="button" onClick={() => setSelectedColor(color)} className={chip(selectedColor === color)}>
                  {color}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shipping */}
        <div className="space-y-3">
          <h3 className="text-[10.5px] font-bold uppercase tracking-[1.8px] text-espresso-muted-2">Shipping address</h3>
          <input type="text" required placeholder="Full name" value={shippingName} onChange={(e) => setShippingName(e.target.value)} className={input} />
          <input type="text" required placeholder="Address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} className={input} />
          <div className="flex gap-3">
            <input type="text" required placeholder="Postal code" value={shippingPostalCode} onChange={(e) => setShippingPostalCode(e.target.value)} className={`${input} w-1/3`} />
            <input type="text" required placeholder="City" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} className={`${input} flex-1`} />
          </div>
        </div>

        {/* Points */}
        {pointsBalance > 0 && (
          <div className="rounded-2xl border border-espresso-line bg-espresso-surface p-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-espresso-cream">Use Cirkle Points</h3>
              <span className="text-xs text-terracotta">{pointsBalance} available</span>
            </div>
            <p className="mb-3 text-xs text-espresso-muted">1 point = 1 kr discount</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPointsToUse(Math.max(0, pointsToUse - 10))}
                disabled={pointsToUse <= 0}
                className="grid h-9 w-9 place-items-center rounded-lg border border-espresso-line text-espresso-cream transition disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 text-center">
                <span className="font-display text-2xl italic text-espresso-cream">{pointsToUse}</span>
                <span className="ml-1 text-sm text-espresso-muted">points</span>
              </div>
              <button
                type="button"
                onClick={() => setPointsToUse(Math.min(pointsCapped, pointsToUse + 10))}
                disabled={pointsToUse >= pointsCapped}
                className="grid h-9 w-9 place-items-center rounded-lg border border-espresso-line text-espresso-cream transition disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {pointsToUse > 0 && (
              <p className="mt-2 text-center text-sm font-medium text-gold">−{formatDKK(discountOre)} discount</p>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="rounded-2xl border border-espresso-line bg-espresso-surface p-4">
          <div className="mb-2.5 flex justify-between text-[13px] text-espresso-muted">
            <span>Subtotal</span>
            <span className="font-semibold text-espresso-cream">{formatDKK(product.price_dkk)}</span>
          </div>
          <div className="mb-2.5 flex justify-between text-[13px] text-espresso-muted">
            <span>Shipping</span>
            <span className="font-semibold text-espresso-cream">{formatDKK(shippingOre)}</span>
          </div>
          {pointsToUse > 0 && (
            <div className="mb-2.5 flex justify-between text-[13px] text-gold">
              <span>Cirkle Points (−{pointsToUse})</span>
              <span>−{formatDKK(discountOre)}</span>
            </div>
          )}
          <div className="my-3 h-px bg-espresso-line" />
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-espresso-muted">Total</span>
            <span className="font-display text-[25px] italic text-terracotta">{formatDKK(totalOre)}</span>
          </div>
        </div>

        {error && <p className="rounded-xl bg-terracotta/15 px-4 py-3 text-sm text-terracotta">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta py-4 font-bold text-espresso-bg transition active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </>
          ) : (
            <>
              Proceed to checkout · {formatDKK(totalOre)}
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
