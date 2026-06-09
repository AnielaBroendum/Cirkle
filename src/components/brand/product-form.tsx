'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { parseDKKtoOre, formatDKK } from '@/lib/utils';
import { Trash2, Plus, Minus } from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductVariant = Database['public']['Tables']['product_variants']['Row'];

type ProductFormProps = {
  brandProfileId: string;
  product?: Product | null;
  existingVariants?: ProductVariant[];
};

export function ProductForm({ brandProfileId, product, existingVariants = [] }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!product;

  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [priceKr, setPriceKr] = useState(product ? String(product.price_dkk / 100) : '');
  const [depositKr, setDepositKr] = useState(
    product?.deposit_amount_dkk ? String(product.deposit_amount_dkk / 100) : ''
  );
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [sizesText, setSizesText] = useState(product?.sizes?.join(', ') ?? '');
  const [colorsText, setColorsText] = useState(product?.colors?.join(', ') ?? '');
  const [materials, setMaterials] = useState(product?.materials ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [variants, setVariants] = useState<
    { size: string; color: string; stock_count: number; id?: string }[]
  >([]);

  const sizes = Array.from(new Set(sizesText.split(',').map((s) => s.trim()).filter(Boolean)));
  const colors = Array.from(new Set(colorsText.split(',').map((c) => c.trim()).filter(Boolean)));

  useEffect(() => {
    if (sizes.length === 0 || colors.length === 0) {
      setVariants([]);
      return;
    }
    const newVariants: typeof variants = [];
    for (const size of sizes) {
      for (const color of colors) {
        const existing = existingVariants.find((v) => v.size === size && v.color === color);
        const current = variants.find((v) => v.size === size && v.color === color);
        newVariants.push({
          size,
          color,
          stock_count: current?.stock_count ?? existing?.stock_count ?? 0,
          id: existing?.id,
        });
      }
    }
    setVariants(newVariants);
    // Only regenerate when size/color text changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizesText, colorsText]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !priceKr) return;
    setError('');
    setLoading(true);

    const supabase = createClient();
    const priceOre = parseDKKtoOre(parseFloat(priceKr));

    const depositOre = depositKr ? parseDKKtoOre(parseFloat(depositKr)) : null;

    const productData = {
      brand_id: brandProfileId,
      name: name.trim(),
      description: description.trim() || null,
      price_dkk: priceOre,
      deposit_amount_dkk: depositOre,
      images,
      sizes,
      colors,
      materials: materials.trim() || null,
      category: category.trim() || null,
    };

    let productId = product?.id;

    if (isEditing && productId) {
      const { error: updateErr } = await supabase
        .from('products')
        .update(productData)
        .eq('id', productId);
      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }
    } else {
      const { data, error: insertErr } = await supabase
        .from('products')
        .insert(productData)
        .select('id')
        .single();
      if (insertErr || !data) {
        setError(insertErr?.message ?? 'Failed to create product');
        setLoading(false);
        return;
      }
      productId = (data as { id: string }).id;
    }

    if (variants.length > 0 && productId) {
      await supabase.from('product_variants').delete().eq('product_id', productId);

      const seen = new Set<string>();
      const uniqueVariants = variants.filter((v) => {
        const key = `${v.size}|${v.color}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const { error: variantErr } = await supabase.from('product_variants').insert(
        uniqueVariants.map((v) => ({
          product_id: productId!,
          size: v.size,
          color: v.color,
          stock_count: v.stock_count,
        }))
      );
      if (variantErr) {
        setError(variantErr.message);
        setLoading(false);
        return;
      }
    }

    router.push('/brand/products');
    router.refresh();
  }

  function updateVariantStock(index: number, delta: number) {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === index ? { ...v, stock_count: Math.max(0, v.stock_count + delta) } : v
      )
    );
  }

  function setVariantStock(index: number, value: number) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, stock_count: Math.max(0, value) } : v))
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product name *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          placeholder="e.g. Classic T-Shirt"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none resize-none"
          placeholder="Describe the product"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (kr) *</label>
          <input
            type="number"
            required
            min="1"
            step="0.01"
            value={priceKr}
            onChange={(e) => setPriceKr(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
            placeholder="299"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
            placeholder="T-shirts, Dresses, etc."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Deposit amount (kr)</label>
        <p className="text-xs text-gray-400 mb-2">
          What retailers pay per sample of this product. Leave empty for no deposit.
        </p>
        <input
          type="number"
          min="0"
          step="0.01"
          value={depositKr}
          onChange={(e) => setDepositKr(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          placeholder="150"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product images</label>
        <ImageUpload
          bucket="brand-assets"
          folder="products"
          value={images}
          onChange={setImages}
          max={5}
          label="Upload images"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sizes</label>
          <input
            type="text"
            value={sizesText}
            onChange={(e) => setSizesText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
            placeholder="S, M, L, XL"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Colors</label>
          <input
            type="text"
            value={colorsText}
            onChange={(e) => setColorsText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
            placeholder="Black, White, Navy"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Materials</label>
        <input
          type="text"
          value={materials}
          onChange={(e) => setMaterials(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          placeholder="100% organic cotton"
        />
      </div>

      {/* Variant stock management */}
      {variants.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Stock per variant
          </label>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Size</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Color</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variants.map((v, i) => (
                  <tr key={`${v.size}-${v.color}`}>
                    <td className="px-4 py-2 text-gray-900">{v.size}</td>
                    <td className="px-4 py-2 text-gray-900">{v.color}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateVariantStock(i, -1)}
                          className="p-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={v.stock_count}
                          onChange={(e) => setVariantStock(i, parseInt(e.target.value) || 0)}
                          className="w-16 text-center rounded border border-gray-300 px-2 py-1 text-gray-900 focus:border-cirkle-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateVariantStock(i, 1)}
                          className="p-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-100"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !name.trim() || !priceKr}
          className="rounded-lg bg-cirkle-600 px-6 py-3 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
        >
          {loading ? 'Saving...' : isEditing ? 'Save changes' : 'Create product'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
