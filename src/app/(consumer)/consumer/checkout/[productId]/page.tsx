'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { cn } from '@/components/ds';
import {
  BottomAction,
  DarkCard,
  DeliverToCard,
  DeliveryCard,
  Eyebrow,
  FlaymsCard,
  OrderPlaced,
  PaymentPicker,
  ScreenHeader,
  SummaryCard,
  Thumb,
  type PaymentMethod,
} from '@/components/consumer/checkout-parts';

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
  // Mock payment picker (Figma 06): not sent to the API.
  const [payment, setPayment] = useState<PaymentMethod>('mobilepay');

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

  // ---- Order placed (Figma 14) ----
  if (orderResult) {
    return (
      <OrderPlaced
        items={[
          {
            name: orderResult.product_name,
            brand: orderResult.brand_name,
            size: selectedSize || null,
            priceOre: product?.price_dkk ?? 0,
            image: product?.images?.[0] ?? null,
          },
        ]}
        orderHref={`/consumer/orders/${orderResult.order_id}`}
        note={<p>Order #{orderResult.order_number} · Expected delivery: 3–5 business days</p>}
      />
    );
  }

  // ---- Loading ----
  if (loading || !product) {
    return (
      <div aria-busy>
        <ScreenHeader title="Checkout" />
        <div className="space-y-4 px-5 pt-5">
          <div className="h-[104px] animate-pulse bg-surface-dark" />
          <div className="h-[93px] animate-pulse bg-surface-dark" />
          <div className="h-14 animate-pulse bg-surface-dark" />
        </div>
      </div>
    );
  }

  const chip = (active: boolean) =>
    cn('h-10 min-w-12 px-3 text-body transition-colors', active ? 'bg-on-primary text-primary' : 'border border-muted text-on-primary hover:border-on-primary');

  return (
    <form onSubmit={handleSubmit} className="pb-40">
      <ScreenHeader title="Checkout" onBack={() => router.back()} />

      <div className="space-y-4 px-5 pt-5">
        {/* Item */}
        <DarkCard className="flex items-center gap-3.5">
          <Thumb src={product.images?.[0] ?? null} alt={product.name} className="h-[70px] w-14" />
          <div className="min-w-0 flex-1">
            <Eyebrow>{product.brand_profiles.name}</Eyebrow>
            <p className="mt-0.5 truncate text-body text-on-primary">{product.name}</p>
            <p className="truncate text-caption text-muted">
              {[selectedSize && `Size ${selectedSize}`, selectedColor].filter(Boolean).join(' · ') || 'Select options below'}
            </p>
          </div>
          <span className="text-body text-on-primary">{formatDKK(product.price_dkk)}</span>
        </DarkCard>

        {/* Size */}
        {product.sizes?.length > 0 && (
          <div>
            <Eyebrow>Size</Eyebrow>
            <div className="mt-2.5 flex flex-wrap gap-2">
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
            <Eyebrow>Colour</Eyebrow>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <button key={color} type="button" onClick={() => setSelectedColor(color)} className={chip(selectedColor === color)}>
                  {color}
                </button>
              ))}
            </div>
          </div>
        )}

        <DeliverToCard
          value={{ name: shippingName, address: shippingAddress, postalCode: shippingPostalCode, city: shippingCity }}
          onChange={(v) => {
            setShippingName(v.name);
            setShippingAddress(v.address);
            setShippingPostalCode(v.postalCode);
            setShippingCity(v.city);
          }}
        />
        <DeliveryCard brands={[{ name: product.brand_profiles.name, feeOre: shippingOre }]} />

        {/* Points */}
        {pointsBalance > 0 && <FlaymsCard balance={pointsBalance} value={pointsToUse} max={pointsCapped} onChange={setPointsToUse} />}

        <PaymentPicker value={payment} onChange={setPayment} />

        <SummaryCard
          rows={[
            { label: 'Subtotal', valueOre: product.price_dkk },
            { label: 'Delivery', valueOre: shippingOre },
            ...(pointsToUse > 0 ? [{ label: `Flayms (−${pointsToUse})`, valueOre: -discountOre, accent: true }] : []),
          ]}
          totalOre={totalOre}
        />

        {error && (
          <p role="alert" className="border border-accent/40 bg-surface-dark px-4 py-3 text-caption text-on-primary">
            {error}
          </p>
        )}
      </div>

      <BottomAction type="submit" loading={submitting} note="One payment to Flaym. The brand gets your order.">
        {submitting ? 'Processing…' : `Pay ${formatDKK(totalOre)}`}
      </BottomAction>
    </form>
  );
}
