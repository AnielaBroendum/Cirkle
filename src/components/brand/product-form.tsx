'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ProductImagesUpload } from '@/components/brand/product-images-upload';
import { parseDKKtoOre, formatDKK } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Minus, X } from 'lucide-react';
import { Button, Field, Input, Modal, PageHeader, Panel, PanelHeader, Textarea, Thumb, Toggle, cn } from '@/components/ds';
import { PRODUCT_IMAGE_RULES } from '@/lib/media-rules';
import type { Database } from '@/lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductVariant = Database['public']['Tables']['product_variants']['Row'];

type ProductFormProps = {
  brandProfileId: string;
  product?: Product | null;
  existingVariants?: ProductVariant[];
  /** Page title, e.g. "Add product" / "Edit product" (Figma 04 header). */
  title: string;
};

type StoreRow = { retailer_id: string; name: string; placed: boolean; scans: number };

/*
 * Add / Edit product, Portals v2 (Figma "Brand Portal v2 / 04 Edit product", 364:587).
 * Save logic, variant stock/prices and image checks are unchanged. New in v2:
 * - In stores (get_product_store_scans, 019): switching a store on places the product there on
 *   save, through the existing POST /api/samples (a new active sample and QR tag). A store that
 *   already has it stays on; removing a sample is done on Stores & tags, never here.
 * - Active switch and Delete (moved from the product library).
 */
export function ProductForm({ brandProfileId, product, existingVariants = [], title }: ProductFormProps) {
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
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [storeRows, setStoreRows] = useState<StoreRow[] | null>(null);
  const [placeIn, setPlaceIn] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Stores with an active partnership, and whether this product is placed there.
  useEffect(() => {
    createClient()
      .rpc('get_product_store_scans', { p_product: product?.id ?? null })
      .then(({ data }: { data: StoreRow[] | null }) => setStoreRows(data ?? []));
  }, [product?.id]);

  function togglePlace(retailerId: string, on: boolean) {
    setPlaceIn((prev) => {
      const next = new Set(prev);
      if (on) next.add(retailerId);
      else next.delete(retailerId);
      return next;
    });
  }

  async function deleteProduct() {
    if (!product) return;
    setDeleting(true);
    const { error: deleteErr } = await createClient().from('products').delete().eq('id', product.id);
    setDeleting(false);
    if (deleteErr) {
      setConfirmDelete(false);
      setError(deleteErr.message);
      return;
    }
    router.push('/brand/products');
    router.refresh();
  }

  const [variants, setVariants] = useState<
    // priceKr: '' means the base price is used.
    { size: string; color: string; stock_count: number; priceKr: string; id?: string }[]
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
          priceKr: current?.priceKr ?? (existing?.price_dkk != null ? String(existing.price_dkk / 100) : ''),
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

    if (variants.some((v) => v.priceKr.trim() && !(parseFloat(v.priceKr) > 0))) {
      setError('Variant prices must be more than 0 kr, or empty to use the base price.');
      setLoading(false);
      return;
    }

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
        .update({ ...productData, is_active: isActive })
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
          price_dkk: v.priceKr.trim() ? parseDKKtoOre(parseFloat(v.priceKr)) : null,
        }))
      );
      if (variantErr) {
        setError(variantErr.message);
        setLoading(false);
        return;
      }
    }

    // Place the product in the stores switched on: one new sample (and QR tag) per store.
    const failed: string[] = [];
    for (const retailerId of Array.from(placeIn)) {
      const res = await fetch('/api/samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, retailer_id: retailerId, brand_id: brandProfileId }),
      });
      if (!res.ok) failed.push(storeRows?.find((r) => r.retailer_id === retailerId)?.name ?? 'a store');
    }
    if (failed.length) {
      setError(`Saved, but could not place it in ${failed.join(', ')}. Try again on Stores & tags.`);
      setLoading(false);
      return;
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

  function setVariantPrice(index: number, value: string) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, priceKr: value } : v)));
  }

  // A colour's price fills every size of that colour; sizes can still differ below.
  function setColorPrice(color: string, value: string) {
    setVariants((prev) => prev.map((v) => (v.color === color ? { ...v, priceKr: value } : v)));
  }

  function colorPrice(color: string): string {
    const prices = new Set(variants.filter((v) => v.color === color).map((v) => v.priceKr.trim()));
    return prices.size === 1 ? Array.from(prices)[0] : '';
  }

  const canSave = !loading && !!name.trim() && !!priceKr;
  const label = 'text-label uppercase text-smoke';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="block truncate">
            <Link href="/brand/products" className="hover:text-flare">
              Product library
            </Link>
            {product && <> / {product.name}</>}
          </span>
        }
        title={title}
        subtitle="Shown on the product page when a tag is scanned."
        actions={
          <>
            <Button variant="secondary" onClick={() => router.back()} className="h-[43px]">
              Cancel
            </Button>
            <Button type="submit" variant="flame" disabled={!canSave} loading={loading} className="h-[43px]">
              {loading ? 'Saving…' : isEditing ? 'Save changes' : 'Create product'}
            </Button>
          </>
        }
      />

      {error && (
        <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,606fr)_minmax(0,334fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <PanelHeader title="Details" subtitle="Shown on the product page in the app" />
            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              <Field label="Name *" htmlFor="pf-name" className="sm:col-span-6">
                <Input id="pf-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Classic T-Shirt" />
              </Field>

              <Field label="Category" htmlFor="pf-category" className="sm:col-span-2">
                <Input id="pf-category" type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Shirts, Dresses…" />
              </Field>
              <Field label="Colours" htmlFor="pf-colors" hint="Separate with commas" className="sm:col-span-2">
                <Input id="pf-colors" type="text" value={colorsText} onChange={(e) => setColorsText(e.target.value)} placeholder="Black, White, Navy" />
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
                <span className={label}>Sizes</span>
                <div className="flex flex-wrap items-center gap-2">
                  {sizes.map((size) => (
                    <span key={size} className="inline-flex h-[30px] items-center gap-1 bg-primary pl-3 pr-1.5 text-caption font-medium text-on-primary">
                      {size}
                      <button
                        type="button"
                        onClick={() => removeSize(size)}
                        aria-label={`Remove size ${size}`}
                        className="inline-flex h-5 w-5 items-center justify-center opacity-60 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <span className="inline-flex h-[30px] items-center border border-line-dark-subtle bg-canvas-dark pl-3 pr-1">
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
                      placeholder="+ Add"
                      aria-label="Add size"
                      className="w-16 bg-transparent font-brand text-caption text-flare outline-none placeholder:text-ash"
                    />
                    <button type="button" onClick={addSize} aria-label="Add size" className="inline-flex h-5 w-5 items-center justify-center text-ash hover:text-flare">
                      <Plus className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              </div>

              <Field label="About" htmlFor="pf-description" className="sm:col-span-6">
                <Textarea id="pf-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the product" />
              </Field>

              <Field label="Materials and care" htmlFor="pf-materials" className="sm:col-span-6">
                <Textarea id="pf-materials" rows={3} value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="100% organic cotton" />
              </Field>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Stock and prices" subtitle="Sizes that are out of stock show as sold out in the app" />
            {variants.length === 0 ? (
              <p className="mt-4 text-caption text-smoke">Add sizes and colours to set stock and price per variant.</p>
            ) : (
              <>
                <p className="mt-5 text-label uppercase text-smoke">Price per colour</p>
                <p className="mb-3 mt-1 text-caption text-smoke">
                  Optional. Leave empty to use the base price{priceKr ? ` (${formatDKK(parseDKKtoOre(parseFloat(priceKr) || 0))})` : ''}.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {colors.map((color) => {
                    const mixed = colorPrice(color) === '' && variants.some((v) => v.color === color && v.priceKr.trim());
                    return (
                      <Field key={color} label={color} htmlFor={`pf-color-price-${color}`}>
                        <Input
                          id={`pf-color-price-${color}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={colorPrice(color)}
                          onChange={(e) => setColorPrice(color, e.target.value)}
                          placeholder={mixed ? 'Varies by size' : priceKr || 'Base price'}
                        />
                      </Field>
                    );
                  })}
                </div>

                <div className="-mx-1 mt-6 overflow-x-auto">
                  <table className="w-full border-collapse font-brand text-body-sm text-flare">
                    <thead>
                      <tr className="border-b border-line-dark-subtle text-label uppercase text-smoke">
                        <th className="px-3 py-2 text-left font-medium">Size</th>
                        <th className="px-3 py-2 text-left font-medium">Colour</th>
                        <th className="px-3 py-2 text-right font-medium">Price (kr)</th>
                        <th className="px-3 py-2 text-right font-medium">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-dark-subtle">
                      {variants.map((v, i) => (
                        <tr key={`${v.size}-${v.color}`}>
                          <td className="px-3 py-2">{v.size}</td>
                          <td className="px-3 py-2 text-ash">{v.color}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={v.priceKr}
                              onChange={(e) => setVariantPrice(i, e.target.value)}
                              placeholder={priceKr || 'Base'}
                              aria-label={`Price ${v.size} ${v.color}, empty for base price`}
                              className="h-8 w-24 rounded-control border border-line-dark-subtle bg-canvas-dark px-2 text-right font-brand text-body-sm text-flare outline-none placeholder:text-smoke focus:border-ash"
                            />
                          </td>
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
                                className="h-8 w-16 rounded-control border border-line-dark-subtle bg-canvas-dark text-center font-brand text-body-sm text-flare outline-none focus:border-ash"
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
              </>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <PanelHeader
              title="Images"
              subtitle="3:4 portrait · first image is the main image"
              action={
                <span className="text-caption tabular-nums text-smoke">
                  {images.length} / {PRODUCT_IMAGE_RULES.max}
                </span>
              }
            />
            <div className="mt-4">
              <ProductImagesUpload brandId={brandProfileId} value={images} onChange={setImages} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="In stores" subtitle="Choose which stores show this piece" />
            {storeRows === null ? (
              <p className="mt-4 text-caption text-smoke">Loading stores…</p>
            ) : storeRows.length === 0 ? (
              <p className="mt-4 text-caption text-smoke">
                No partner stores yet. Invite one on <Link href="/brand/samples" className="text-ash underline hover:text-flare">Stores &amp; tags</Link>.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {storeRows.map((s) => {
                  const queued = placeIn.has(s.retailer_id);
                  return (
                    <li key={s.retailer_id} className="flex items-center gap-2.5">
                      <Thumb size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-flare">{s.name}</p>
                        <p className="text-caption text-smoke">
                          {s.placed
                            ? `${s.scans.toLocaleString('en-GB')} scan${s.scans === 1 ? '' : 's'}`
                            : queued
                              ? 'Placed when you save · new QR tag'
                              : 'Not placed'}
                        </p>
                      </div>
                      <Toggle
                        tone="portal"
                        checked={s.placed || queued}
                        onCheckedChange={(on) => !s.placed && togglePlace(s.retailer_id, on)}
                        aria-label={s.placed ? `In ${s.name}. Remove it on Stores & tags` : `Show in ${s.name}`}
                        aria-disabled={s.placed || undefined}
                        title={s.placed ? 'Remove it on Stores & tags' : undefined}
                        className={s.placed ? 'cursor-default' : undefined}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 text-caption text-smoke">
              Switching a store on adds a sample with its own QR tag when you save. To take a piece out of a store, use Stores &amp; tags.
            </p>
          </Panel>

          <Panel>
            <PanelHeader title="Samples" subtitle="What stores pay per sample of this product" />
            <Field label="Sample deposit (kr)" htmlFor="pf-deposit" hint="Leave empty for no deposit." className="mt-4">
              <Input id="pf-deposit" type="number" min="0" step="0.01" value={depositKr} onChange={(e) => setDepositKr(e.target.value)} placeholder="150" />
            </Field>
          </Panel>

          {isEditing && (
            <Panel>
              <PanelHeader title="Visibility" />
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-body-sm font-medium text-flare">{isActive ? 'Active' : 'Inactive'}</p>
                  <p className="text-caption text-smoke">Inactive products can&apos;t be bought. Saved with the other changes.</p>
                </div>
                <Toggle tone="portal" checked={isActive} onCheckedChange={setIsActive} aria-label="Product active" />
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="mt-5 text-caption text-accent-strong underline-offset-2 hover:underline"
              >
                Delete product
              </button>
            </Panel>
          )}
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete product"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button fullWidth loading={deleting} onClick={deleteProduct}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-smoke">
          Are you sure you want to delete <span className="text-flare">{product?.name}</span>? This can&apos;t be undone.
        </p>
      </Modal>
    </form>
  );
}

function StockButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-control border border-line-dark-subtle text-ash transition-colors hover:border-ash hover:text-flare')}
    >
      {children}
    </button>
  );
}
