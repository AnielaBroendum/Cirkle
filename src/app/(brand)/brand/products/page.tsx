'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatPriceRange, priceRange, type VariantPrice } from '@/lib/pricing';
import type { Database } from '@/lib/database.types';
import {
  Chip,
  EmptyState,
  ListSkeleton,
  MetricTile,
  PageHeader,
  Panel,
  ScanBar,
  Segmented,
  Select,
  Skeleton,
  Thumb,
  buttonClasses,
  cn,
} from '@/components/ds';

/*
 * Product library, Portals v2 (Figma "Brand Portal v2 / 03 Product library", 364:238).
 * Numbers from get_brand_product_stats (018). Row click opens Edit product, where the
 * Active switch and Delete now live. Left out (no data): webshop import line and re-run,
 * SKU, the Edited tab and the Source column.
 */

type Product = Database['public']['Tables']['products']['Row'] & { product_variants?: VariantPrice[] };
type Stats = NonNullable<Database['public']['Functions']['get_brand_product_stats']['Returns']>;
type ProductStats = Stats['products'][number];

type Tab = 'all' | 'in_stores';
type Sort = 'scans' | 'name' | 'price' | 'newest';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'scans', label: 'Most scanned' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'price', label: 'Price' },
];

// "XS–XL" like Figma; one size stays as is.
function sizeRange(sizes: string[] | null) {
  if (!sizes?.length) return '–';
  if (sizes.length === 1) return sizes[0];
  return `${sizes[0]}–${sizes[sizes.length - 1]}`;
}

const count = (n: number) => n.toLocaleString('en-GB');
const EMPTY: ProductStats = { id: '', scans_month: 0, scans_total: 0, sold_month: 0, stores: 0 };

export default function BrandProductsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<Sort>('scans');

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const { data: bp } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single();
      if (!bp) return setLoading(false);
      const [productsRes, statsRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, product_variants(size, color, price_dkk)')
          .eq('brand_id', bp.id)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_brand_product_stats', { p_tz: 'Europe/Copenhagen' }),
      ]);
      setProducts((productsRes.data ?? []) as Product[]);
      setStats((statsRes.data as Stats | null) ?? null);
      setLoading(false);
    })();
  }, [user]);

  const byId = useMemo(() => new Map((stats?.products ?? []).map((s) => [s.id, s])), [stats]);
  const statOf = (p: Product) => byId.get(p.id) ?? EMPTY;

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category?.trim()).filter((c): c is string => !!c))).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const inStoresCount = products.filter((p) => statOf(p).stores > 0).length;
  const maxScans = Math.max(1, ...products.map((p) => statOf(p).scans_total));

  const visible = useMemo(() => {
    const rows = products.filter((p) => (tab === 'all' || (byId.get(p.id)?.stores ?? 0) > 0) && (!category || p.category?.trim() === category));
    const scans = (p: Product) => byId.get(p.id)?.scans_total ?? 0;
    return [...rows].sort((a, b) => {
      if (sort === 'scans') return scans(b) - scans(a) || a.name.localeCompare(b.name);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'price') return b.price_dkk - a.price_dkk;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [products, byId, tab, category, sort]);

  // Most scanned this month (ties: most sold).
  const top = useMemo(() => {
    const ranked = (stats?.products ?? []).filter((s) => s.scans_month > 0).sort((a, b) => b.scans_month - a.scans_month || b.sold_month - a.sold_month);
    if (!ranked.length) return null;
    const product = products.find((p) => p.id === ranked[0].id);
    return product ? { product, stat: ranked[0] } : null;
  }, [stats, products]);

  const scansDelta = (() => {
    if (!stats || stats.scans_prev_month === 0) return stats ? `${count(stats.scans_prev_month)} last month` : '';
    const pct = Math.round(((stats.scans_month - stats.scans_prev_month) / stats.scans_prev_month) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}% vs. last month`;
  })();

  const header = (
    <PageHeader
      title="Product library"
      subtitle="Shown on the product page when a tag is scanned."
      actions={
        <Link href="/brand/products/new" className={buttonClasses({ variant: 'flame', className: 'h-[43px]' })}>
          + Add product
        </Link>
      }
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-[115px]" />
          <Skeleton className="h-[115px]" />
          <Skeleton className="h-[115px]" />
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Products" value={count(products.length)} hint={`${count(inStoresCount)} placed in stores`} />
        <MetricTile label="Scans this month" value={count(stats?.scans_month ?? 0)} hint={scansDelta} />
        <MetricTile
          label="Most scanned"
          value={top ? top.product.name : '–'}
          hint={top ? `${count(top.stat.scans_month)} scans · ${count(top.stat.sold_month)} sold this month` : 'No scans yet this month'}
        />
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="No products yet"
          description="Add your first product to start placing it in stores."
          action={
            <Link href="/brand/products/new" className={buttonClasses({ variant: 'flame' })}>
              + Add first product
            </Link>
          }
        />
      ) : (
        <Panel className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <Segmented
              label="Products shown"
              items={[
                { value: 'all', label: `All ${count(products.length)}` },
                { value: 'in_stores', label: `In stores ${count(inStoresCount)}` },
              ]}
              value={tab}
              onValueChange={(v) => setTab(v as Tab)}
              className="self-start border border-line-dark-subtle bg-obsidian"
            />
            <span className="hidden flex-1 md:block" />
            <div className="flex gap-2.5">
              <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-[38px] min-w-0 flex-1 md:w-44 md:flex-none">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-[38px] min-w-0 flex-1 md:w-52 md:flex-none">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    Sort: {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="py-10 text-center text-caption text-smoke">No products match.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse font-brand text-body-sm">
                <thead>
                  <tr className="border-b border-line-dark-subtle text-left text-label uppercase text-smoke">
                    <th className="px-1 pb-2.5 font-medium">Product</th>
                    <th className="hidden px-2 pb-2.5 font-medium lg:table-cell">Category</th>
                    <th className="px-2 pb-2.5 font-medium">Sizes</th>
                    <th className="px-2 pb-2.5 font-medium">Price</th>
                    <th className="px-2 pb-2.5 font-medium">In stores</th>
                    <th className="px-2 pb-2.5 font-medium" title="All time">
                      Scans
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const s = statOf(p);
                    const href = `/brand/products/${p.id}/edit`;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => router.push(href)}
                        className="cursor-pointer border-b border-line-dark-subtle transition-colors last:border-b-0 hover:bg-surface-dark/50"
                      >
                        <td className="px-1 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb src={p.images?.[0]} size={36} />
                            <div className="min-w-0">
                              <Link href={href} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-flare hover:underline">
                                {p.name}
                              </Link>
                              <p className="mt-0.5 flex items-center gap-2 truncate text-caption text-smoke">
                                {p.colors?.length ? p.colors.join(' · ') : null}
                                {!p.is_active && <Chip className="px-1.5 py-0">Inactive</Chip>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-2 text-ash lg:table-cell">{p.category || <span className="text-smoke">–</span>}</td>
                        <td className="whitespace-nowrap px-2 text-ash">{sizeRange(p.sizes)}</td>
                        <td className="whitespace-nowrap px-2 tabular-nums text-ash">
                          {formatPriceRange(priceRange(p.price_dkk, p.product_variants ?? []))}
                        </td>
                        <td className="px-2">
                          <StoreDots n={s.stores} />
                        </td>
                        <td className="px-2">
                          <ScanBar value={s.scans_total} max={maxScans} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-caption text-smoke">Scans are all time. Click a product to edit it, place it in stores, switch it off or delete it.</p>
        </Panel>
      )}
    </div>
  );
}

/** Up to three dots filled for the stores holding the product, then the count. */
function StoreDots({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`In ${n} store${n === 1 ? '' : 's'}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn('h-2.5 w-2.5 rounded-pill', i < n ? 'bg-accent' : 'bg-surface-dark')} aria-hidden />
      ))}
      <span className="ml-0.5 text-caption tabular-nums text-ash">{n}</span>
    </span>
  );
}
