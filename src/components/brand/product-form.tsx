'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { parseDKKtoOre, formatDKK } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Minus, X } from 'lucide-react';
import { Button, Card, Field, Input, Textarea, cn } from '@/components/ds';
import type { Database } from '@/lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductVariant = Database['public']['Tables']['product_variants']['Row'];

type ProductFormProps = {
  brandProfileId: string;
  product?: Product | null;
  existingVariants?: ProductVariant[];
  /** Page title, e.g. "Add product" / "Edit product" (Figma 04 header). */
  title: string;
  /** Names of stores holding a sample of this product; omit to hide the "In stores" card. */
  stores?: string[];
};

export function ProductForm({ brandProfileId, product, existingVariants = [], title, stores }: ProductFormProps) {
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
  const [newSize, setNewSize] = useState('');

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

  // Size chips edit the same comma-separated sizes text as before.
  function addSize() {
    const size = newSize.trim();
    if (!size) return;
    setSizesText([...sizes, size].join(', '));
    setNewSize('');
  }

  function removeSize(size: string) {
    setSizesText(sizes.filter((s) => s !== size).join(', '));
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

  const canSave = !loading && !!name.trim() && !!priceKr;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-body text-slate">
            <Link href="/brand/products" className="hover:text-primary">
              Product library
            </Link>
            {product && <> / {product.name}</>}
          </p>
          <h1 className="mt-1 font-brand text-heading-xl uppercase text-primary">{title}</h1>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave} loading={loading}>
            {loading ? 'Saving…' : isEditing ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,617fr)_minmax(0,455fr)] lg:gap-5">
        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Name *" htmlFor="pf-name" className="sm:col-span-6">
              <Input
                id="pf-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Classic T-Shirt"
              />
            </Field>

            <Field label="Category" htmlFor="pf-category" className="sm:col-span-2">
              <Input
                id="pf-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="T-shirts, Dresses, etc."
              />
            </Field>
            <Field label="Colours" htmlFor="pf-colors" hint="Separate with commas" className="sm:col-span-2">
              <Input
                id="pf-colors"
                type="text"
                value={colorsText}
                onChange={(e) => setColorsText(e.target.value)}
                placeholder="Black, White, Navy"
              />
            </Field>
            <Field label="Price (kr) *" htmlFor="pf-price" className="sm:col-span-2">
              <Input
                id="pf-price"
                type="number"
                required
                min="1"
                step="0.01"
                value={priceKr}
                onChange={(e) => setPriceKr(e.target.value)}
                placeholder="299"
              />
            </Field>

            <div className="flex flex-col gap-1.5 sm:col-span-6">
              <span className="text-label uppercase text-slate">Sizes</span>
              <div className="flex flex-wrap items-center gap-2">
                {sizes.map((size) => (
                  <span key={size} className="inline-flex h-7 items-center gap-1 rounded-pill bg-surface-muted pl-3 pr-1.5 text-caption font-medium text-primary">
                    {size}
                    <button
                      type="button"
                      onClick={() => removeSize(size)}
                      aria-label={`Remove size ${size}`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-pill text-slate hover:text-primary"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <span className="inline-flex h-7 items-center rounded-pill border border-dashed border-line pl-3 pr-1">
                  <input
                    type="text"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addSize();
                      }
                    }}
                    onBlur={addSize}
                    placeholder="Add size"
                    aria-label="Add size"
                    className="w-20 bg-transparent font-brand text-caption text-primary outline-none placeholder:text-slate"
                  />
                  <button
                    type="button"
                    onClick={addSize}
                    aria-label="Add size"
                    className="inline-flex h-5 w-5 items-center justify-center text-slate hover:text-primary"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </span>
              </div>
            </div>

            <Field label="About (shown on the product page)" htmlFor="pf-description" className="sm:col-span-6">
              <Textarea
                id="pf-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the product"
              />
            </Field>

            <Field label="Materials and care" htmlFor="pf-materials" className="sm:col-span-6">
              <Input
                id="pf-materials"
                type="text"
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
                placeholder="100% organic cotton"
              />
            </Field>

            <Field
              label="Sample deposit (kr)"
              htmlFor="pf-deposit"
              hint="What stores pay per sample of this product. Leave empty for no deposit."
              className="sm:col-span-3"
            >
              <Input
                id="pf-deposit"
                type="number"
                min="0"
                step="0.01"
                value={depositKr}
                onChange={(e) => setDepositKr(e.target.value)}
                placeholder="150"
              />
            </Field>
          </div>

          {/* Variant stock management */}
          {variants.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <h2 className="mb-3 font-brand text-body uppercase tracking-[0.3px] text-primary">Stock per variant</h2>
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full border-collapse font-brand text-body-sm text-primary">
                  <thead>
                    <tr>
                      <th className="border-b border-line px-3 py-2 text-left text-label font-medium uppercase text-slate">Size</th>
                      <th className="border-b border-line px-3 py-2 text-left text-label font-medium uppercase text-slate">Colour</th>
                      <th className="border-b border-line px-3 py-2 text-right text-label font-medium uppercase text-slate">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {variants.map((v, i) => (
                      <tr key={`${v.size}-${v.color}`}>
                        <td className="px-3 py-2">{v.size}</td>
                        <td className="px-3 py-2">{v.color}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <StockButton label={`Decrease ${v.size} ${v.color}`} onClick={() => updateVariantStock(i, -1)}>
                              <Minus className="h-3 w-3" />
                            </StockButton>
                            <input
                              type="number"
                              min="0"
                              value={v.stock_count}
                              onChange={(e) => setVariantStock(i, parseInt(e.target.value) || 0)}
                              aria-label={`Stock ${v.size} ${v.color}`}
                              className="h-8 w-16 rounded-control border border-line bg-surface text-center font-brand text-body-sm text-primary outline-none focus:border-primary"
                            />
                            <StockButton label={`Increase ${v.size} ${v.color}`} onClick={() => updateVariantStock(i, 1)}>
                              <Plus className="h-3 w-3" />
                            </StockButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {variants.length === 0 && (
            <p className="mt-5 text-caption text-slate">Add sizes and colours to set stock per variant.</p>
          )}
        </Card>

        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <h2 className="mb-4 font-brand text-body uppercase tracking-[0.3px] text-primary">Images</h2>
          <ImageUpload
            bucket="brand-assets"
            folder="products"
            value={images}
            onChange={setImages}
            max={5}
            label="Add"
            appearance="flaym"
          />
          <p className="mt-3 text-caption text-slate">The first image is the main image. Up to 5.</p>

          {stores && (
            <div className="mt-6 border-t border-line pt-5">
              <h2 className="mb-3 font-brand text-body uppercase tracking-[0.3px] text-primary">In stores</h2>
              {stores.length === 0 ? (
                <p className="text-caption text-slate">Not in any store yet. Add a sample under Stores &amp; QR tags.</p>
              ) : (
                <ul className="space-y-2.5">
                  {stores.map((store) => (
                    <li key={store} className="flex items-center gap-3 text-body-sm text-primary">
                      <span className="h-3.5 w-3.5 shrink-0 bg-accent" aria-hidden />
                      {store}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
    </form>
  );
}

function StockButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-control border border-line text-slate transition-colors hover:border-primary hover:text-primary')}
    >
      {children}
    </button>
  );
}
