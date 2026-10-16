'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ArrowLeft, Plus, Trash2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, EmptyState, Field, Select, Skeleton, Textarea, buttonClasses } from '@/components/ds';

type BrandGroup = {
  brand_id: string;
  brand_name: string;
  partnership_id: string;
  products: {
    id: string;
    name: string;
    images: string[];
    sizes: string[];
    colors: string[];
    deposit_amount_dkk: number | null;
    price_dkk: number;
  }[];
};

type CartItem = {
  product_id: string;
  product_name: string;
  size: string;
  color: string;
  deposit_amount_dkk: number;
  brand_id: string;
  partnership_id: string;
};

export default function RequestSamplesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [brands, setBrands] = useState<BrandGroup[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('retailer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: rp }: { data: { id: string } | null }) => {
        if (!rp) { setLoading(false); return; }

        const { data: partnerships } = await supabase
          .from('brand_retailer_partnerships')
          .select('id, brand_id, status')
          .eq('retailer_id', rp.id)
          .eq('status', 'active');

        if (!partnerships?.length) { setLoading(false); return; }

        const brandIds = partnerships.map((p: { brand_id: string }) => p.brand_id);
        const [brandsRes, productsRes] = await Promise.all([
          supabase.from('brand_profiles').select('id, name').in('id', brandIds),
          supabase.from('products').select('id, brand_id, name, images, sizes, colors, deposit_amount_dkk, price_dkk').in('brand_id', brandIds).eq('is_active', true).order('name'),
        ]);

        const brandMap = new Map<string, string>((brandsRes.data ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));
        const groups: BrandGroup[] = [];

        for (const p of partnerships as { id: string; brand_id: string }[]) {
          const prods = (productsRes.data ?? []).filter((prod: { brand_id: string }) => prod.brand_id === p.brand_id);
          if (prods.length > 0) {
            groups.push({
              brand_id: p.brand_id,
              brand_name: brandMap.get(p.brand_id) ?? 'Unknown',
              partnership_id: p.id,
              products: prods as BrandGroup['products'],
            });
          }
        }

        setBrands(groups);
        if (groups.length > 0) setSelectedBrand(groups[0].brand_id);
        setLoading(false);
      });
  }, [user]);

  const currentBrand = brands.find((b) => b.brand_id === selectedBrand);
  const currentProduct = currentBrand?.products.find((p) => p.id === selectedProduct);

  function addToCart() {
    if (!currentProduct || !selectedSize || !selectedColor || !currentBrand) return;
    const exists = cart.some(
      (i) => i.product_id === currentProduct.id && i.size === selectedSize && i.color === selectedColor
    );
    if (exists) return;

    setCart([...cart, {
      product_id: currentProduct.id,
      product_name: currentProduct.name,
      size: selectedSize,
      color: selectedColor,
      deposit_amount_dkk: currentProduct.deposit_amount_dkk ?? 0,
      brand_id: currentBrand.brand_id,
      partnership_id: currentBrand.partnership_id,
    }]);
    setSelectedProduct('');
    setSelectedSize('');
    setSelectedColor('');
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  const totalDeposit = cart.reduce((sum, i) => sum + i.deposit_amount_dkk, 0);

  const brandGroupsInCart = Array.from(new Set(cart.map((i) => i.brand_id)));

  async function handleSubmit() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError('');

    for (const brandId of brandGroupsInCart) {
      const brandItems = cart.filter((i) => i.brand_id === brandId);
      const partnership_id = brandItems[0].partnership_id;

      const res = await fetch('/api/sample-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          partnership_id,
          note: note || null,
          items: brandItems.map((i) => ({
            product_id: i.product_id,
            size: i.size,
            color: i.color,
            deposit_amount_dkk: i.deposit_amount_dkk,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong');
        setSubmitting(false);
        return;
      }
    }

    router.push('/retailer/samples');
  }

  if (loading) {
    return (
      <div className="space-y-7">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <Link href="/retailer/samples" className="-ml-1 inline-flex items-center gap-1.5 text-caption text-muted hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Products in the store
        </Link>
        <h1 className="mt-2 font-brand text-heading-xl uppercase text-primary">Request samples</h1>
        <p className="mt-1 text-body text-muted">Pick products from your partner brands. Each sample has a deposit.</p>
      </div>

      {brands.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="No active brand partnerships"
          description="You need an active partnership to request samples."
          action={
            <Link href="/retailer/brands" className={buttonClasses({ variant: 'secondary' })}>
              Find brands
            </Link>
          }
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {/* Product picker */}
          <Card padding="none" className="space-y-4 p-5 lg:p-6">
            <SectionTitle>Add products</SectionTitle>

            <Field label="Brand" htmlFor="brand">
              <Select
                id="brand"
                value={selectedBrand}
                onChange={(e) => { setSelectedBrand(e.target.value); setSelectedProduct(''); }}
              >
                {brands.map((b) => (
                  <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>
                ))}
              </Select>
            </Field>

            {currentBrand && (
              <Field label="Product" htmlFor="product">
                <Select
                  id="product"
                  value={selectedProduct}
                  onChange={(e) => { setSelectedProduct(e.target.value); setSelectedSize(''); setSelectedColor(''); }}
                >
                  <option value="">Select product</option>
                  {currentBrand.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatDKK(p.price_dkk)}
                      {p.deposit_amount_dkk ? ` (deposit: ${formatDKK(p.deposit_amount_dkk)})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {currentProduct && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Size" htmlFor="size">
                    <Select id="size" value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)}>
                      <option value="">Select size</option>
                      {currentProduct.sizes.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Colour" htmlFor="color">
                    <Select id="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)}>
                      <option value="">Select colour</option>
                      {currentProduct.colors.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {currentProduct.deposit_amount_dkk && (
                  <p className="text-body text-muted">
                    Deposit: <span className="text-primary">{formatDKK(currentProduct.deposit_amount_dkk)}</span>
                  </p>
                )}

                <Button
                  variant="secondary"
                  onClick={addToCart}
                  disabled={!selectedSize || !selectedColor}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Add to request
                </Button>
              </>
            )}
          </Card>

          {/* Cart / summary */}
          <Card padding="none" className="space-y-4 p-5 lg:p-6">
            <SectionTitle>
              Your request <span className="ml-1 text-muted">{cart.length}</span>
            </SectionTitle>

            {cart.length === 0 ? (
              <p className="border border-dashed border-line py-8 text-center text-caption text-muted">
                Add products to build your request
              </p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {cart.map((item, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-body text-primary">{item.product_name}</p>
                      <p className="mt-0.5 text-caption text-muted">{item.size} / {item.color}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-body text-primary">{formatDKK(item.deposit_amount_dkk)}</span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(i)}
                        aria-label={`Remove ${item.product_name}`}
                        className="inline-flex h-8 w-8 items-center justify-center text-muted hover:text-primary"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {cart.length > 0 && (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-label uppercase text-muted">Total deposit</span>
                  <span className="text-heading-lg text-primary">{formatDKK(totalDeposit)}</span>
                </div>

                <Field label="Note (optional)" htmlFor="note">
                  <Textarea
                    id="note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-[72px] resize-none"
                    placeholder="Any notes for the brand…"
                  />
                </Field>

                {error && <p className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">{error}</p>}

                <Button variant="accent" size="lg" fullWidth onClick={handleSubmit} loading={submitting} disabled={submitting}>
                  {submitting ? 'Submitting…' : `Submit request (${formatDKK(totalDeposit)} deposit)`}
                </Button>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// Figma card title: 14px uppercase.
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">{children}</h2>;
}
