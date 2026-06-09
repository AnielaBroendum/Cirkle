'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ArrowLeft, Plus, Trash2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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
    return <div className="animate-pulse text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/retailer/samples" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Request samples</h1>
      </div>

      {brands.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 text-gray-500">No active brand partnerships</p>
          <p className="mt-1 text-sm text-gray-400">You need an active partnership to request samples</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Product picker */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Add products</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => { setSelectedBrand(e.target.value); setSelectedProduct(''); }}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:outline-none bg-white"
              >
                {brands.map((b) => (
                  <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>
                ))}
              </select>
            </div>

            {currentBrand && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => { setSelectedProduct(e.target.value); setSelectedSize(''); setSelectedColor(''); }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:outline-none bg-white"
                >
                  <option value="">Select product</option>
                  {currentBrand.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatDKK(p.price_dkk)}
                      {p.deposit_amount_dkk ? ` (deposit: ${formatDKK(p.deposit_amount_dkk)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentProduct && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <select
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-cirkle-500 focus:outline-none bg-white"
                    >
                      <option value="">Select size</option>
                      {currentProduct.sizes.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-cirkle-500 focus:outline-none bg-white"
                    >
                      <option value="">Select color</option>
                      {currentProduct.colors.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {currentProduct.deposit_amount_dkk && (
                  <p className="text-sm text-gray-500">
                    Deposit: <span className="font-medium text-gray-900">{formatDKK(currentProduct.deposit_amount_dkk)}</span>
                  </p>
                )}

                <button
                  onClick={addToCart}
                  disabled={!selectedSize || !selectedColor}
                  className="flex items-center gap-2 rounded-lg bg-cirkle-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Add to request
                </button>
              </>
            )}
          </div>

          {/* Cart / summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Your request ({cart.length} items)</h2>

              {cart.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Add products from the left panel</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {cart.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                        <p className="text-xs text-gray-500">{item.size} / {item.color}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">{formatDKK(item.deposit_amount_dkk)}</span>
                        <button onClick={() => removeFromCart(i)} className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Total deposit</span>
                  <span className="text-lg font-bold text-gray-900">{formatDKK(totalDeposit)}</span>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:outline-none resize-none"
                    placeholder="Any notes for the brand..."
                  />
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full rounded-lg bg-cirkle-600 px-4 py-3 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : `Submit request (${formatDKK(totalDeposit)} deposit)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
