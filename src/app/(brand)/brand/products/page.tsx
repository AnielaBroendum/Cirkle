'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { formatPriceRange, priceRange, type VariantPrice } from '@/lib/pricing';
import { Plus, Package, Pencil, Trash2, Search } from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  ListSkeleton,
  Modal,
  Skeleton,
  Table,
  Tabs,
  Toggle,
  THead,
  TBody,
  TR,
  TH,
  TD,
  buttonClasses,
} from '@/components/ds';
import type { Database } from '@/lib/database.types';

type Product = Database['public']['Tables']['products']['Row'] & { product_variants?: VariantPrice[] };

type Filter = 'all' | 'in_stores' | 'inactive';

// "XS–XL" like Figma; one size stays as is.
function sizeRange(sizes: string[] | null) {
  if (!sizes?.length) return '—';
  if (sizes.length === 1) return sizes[0];
  return `${sizes[0]}–${sizes[sizes.length - 1]}`;
}

export default function BrandProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Number of stores holding an active sample of each product
  const [storeCounts, setStoreCounts] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }: { data: { id: string } | null }) => {
        if (!data) return;
        setBrandProfileId(data.id);
        return supabase
          .from('products')
          .select('*, product_variants(size, color, price_dkk)')
          .eq('brand_id', data.id)
          .order('created_at', { ascending: false });
      })
      .then((res: { data: Product[] | null } | undefined) => {
        if (res?.data) setProducts(res.data);
        setLoading(false);
      });
  }, [user]);

  // "In stores" column: active samples per product, counted by store
  useEffect(() => {
    if (!brandProfileId) return;
    const supabase = createClient();
    supabase
      .from('samples')
      .select('product_id, retailer_id')
      .eq('brand_id', brandProfileId)
      .eq('status', 'active')
      .then(({ data }: { data: { product_id: string; retailer_id: string }[] | null }) => {
        const stores = new Map<string, Set<string>>();
        for (const s of data ?? []) {
          if (!stores.has(s.product_id)) stores.set(s.product_id, new Set());
          stores.get(s.product_id)!.add(s.retailer_id);
        }
        setStoreCounts(new Map(Array.from(stores.entries()).map(([id, set]) => [id, set.size])));
      });
  }, [brandProfileId]);

  async function toggleActive(product: Product) {
    const supabase = createClient();
    const newActive = !product.is_active;
    await supabase.from('products').update({ is_active: newActive }).eq('id', product.id);
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_active: newActive } : p))
    );
  }

  async function deleteProduct(id: string) {
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  const inStores = (p: Product) => storeCounts.get(p.id) ?? 0;

  const counts = {
    all: products.length,
    in_stores: products.filter((p) => inStores(p) > 0).length,
    inactive: products.filter((p) => !p.is_active).length,
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === 'in_stores' && !(storeCounts.get(p.id) ?? 0)) return false;
      if (filter === 'inactive' && p.is_active) return false;
      if (!q) return true;
      return [p.name, p.category, ...(p.colors ?? [])].some((v) => v?.toLowerCase().includes(q));
    });
  }, [products, storeCounts, query, filter]);

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-brand text-heading-xl uppercase text-primary">Product library</h1>
        <p className="mt-1 text-body text-slate">
          {loading ? 'Loading products…' : `${products.length} product${products.length !== 1 ? 's' : ''} · shown on the product page when a tag is scanned`}
        </p>
      </div>
      <Link href="/brand/products/new" className={buttonClasses({ className: 'self-start sm:self-auto' })}>
        <Plus className="h-4 w-4" /> Add product
      </Link>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-11 w-full sm:w-[360px]" />
          <Skeleton className="h-[33px] w-64" />
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {products.length === 0 ? (
        <EmptyState
          className="bg-surface"
          icon={<Package className="h-5 w-5" />}
          title="No products yet"
          description="Add your first product to start creating samples and QR codes"
          action={
            <Link href="/brand/products/new" className={buttonClasses()}>
              <Plus className="h-4 w-4" /> Add first product
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[360px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products"
                aria-label="Search products"
                className="pl-10"
              />
            </div>
            <Tabs
              items={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'in_stores', label: 'In stores', count: counts.in_stores },
                { value: 'inactive', label: 'Inactive', count: counts.inactive },
              ]}
              value={filter}
              onValueChange={(v) => setFilter(v as Filter)}
              className="self-start"
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              className="bg-surface"
              icon={<Search className="h-5 w-5" />}
              title="No matching products"
              description="Try another search or filter."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile: cards */}
              <ul className="divide-y divide-line border border-line bg-surface md:hidden">
                {visible.map((product) => (
                  <li key={product.id} className="flex gap-3 p-4">
                    <Thumb product={product} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/brand/products/${product.id}/edit`} className="block truncate text-body text-primary">
                        {product.name}
                      </Link>
                      <p className="mt-0.5 truncate text-caption text-slate">
                        {[product.category, sizeRange(product.sizes), formatPriceRange(priceRange(product.price_dkk, product.product_variants ?? []))].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-0.5 text-caption text-slate">In {inStores(product)} store{inStores(product) !== 1 ? 's' : ''}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Toggle
                          checked={product.is_active}
                          onCheckedChange={() => toggleActive(product)}
                          label={<span className="text-caption text-slate">{product.is_active ? 'Active' : 'Inactive'}</span>}
                          aria-label={`${product.name} active`}
                        />
                        <RowActions product={product} onDelete={() => setConfirmDelete(product)} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table className="text-body-sm">
                  <THead>
                    <tr>
                      <TH className="px-5">Product</TH>
                      <TH>Category</TH>
                      <TH>Sizes</TH>
                      <TH className="text-right">Price</TH>
                      <TH className="text-right">Deposit</TH>
                      <TH className="text-right">In stores</TH>
                      <TH>Active</TH>
                      <TH className="px-5 text-right">
                        <span className="sr-only">Actions</span>
                      </TH>
                    </tr>
                  </THead>
                  <TBody>
                    {visible.map((product) => (
                      <TR key={product.id}>
                        <TD className="px-5">
                          <div className="flex items-center gap-3">
                            <Thumb product={product} />
                            <div className="min-w-0">
                              <Link href={`/brand/products/${product.id}/edit`} className="block truncate hover:underline">
                                {product.name}
                              </Link>
                              {product.colors?.length ? (
                                <p className="mt-0.5 truncate text-caption text-slate">{product.colors.join(' · ')}</p>
                              ) : null}
                            </div>
                          </div>
                        </TD>
                        <TD>{product.category || <span className="text-slate">—</span>}</TD>
                        <TD className="whitespace-nowrap">{sizeRange(product.sizes)}</TD>
                        <TD className="whitespace-nowrap text-right tabular-nums">{formatPriceRange(priceRange(product.price_dkk, product.product_variants ?? []))}</TD>
                        <TD className="whitespace-nowrap text-right tabular-nums text-slate">
                          {product.deposit_amount_dkk ? formatDKK(product.deposit_amount_dkk) : '—'}
                        </TD>
                        <TD className="text-right tabular-nums">{inStores(product)}</TD>
                        <TD>
                          <Toggle
                            checked={product.is_active}
                            onCheckedChange={() => toggleActive(product)}
                            aria-label={`${product.name} active`}
                          />
                        </TD>
                        <TD className="px-5">
                          <RowActions product={product} onDelete={() => setConfirmDelete(product)} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </>
          )}
        </>
      )}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete product"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              fullWidth
              onClick={() => {
                if (confirmDelete) deleteProduct(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-slate">
          Are you sure you want to delete <span className="text-primary">{confirmDelete?.name}</span>? This can&apos;t be undone.
        </p>
      </Modal>
    </div>
  );
}

function Thumb({ product }: { product: Product }) {
  return product.images?.[0] ? (
    <div className="relative h-10 w-[34px] shrink-0 overflow-hidden bg-surface-muted">
      <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="34px" />
    </div>
  ) : (
    <div className="flex h-10 w-[34px] shrink-0 items-center justify-center bg-surface-muted">
      <Package className="h-4 w-4 text-slate" />
    </div>
  );
}

function RowActions({ product, onDelete }: { product: Product; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/brand/products/${product.id}/edit`}
        aria-label={`Edit ${product.name}`}
        className="inline-flex h-9 w-9 items-center justify-center text-slate transition-colors hover:bg-surface-muted hover:text-primary"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${product.name}`}
        className="inline-flex h-9 w-9 items-center justify-center text-slate transition-colors hover:bg-surface-muted hover:text-primary"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
