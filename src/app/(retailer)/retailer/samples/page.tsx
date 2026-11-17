'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { formatPriceRange } from '@/lib/pricing';
import { QrCode, Plus, ArrowLeftRight, Truck, Package, Printer } from 'lucide-react';
import {
  Button,
  buttonClasses,
  Card,
  CardSkeleton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
  cn,
  portalPanel,
} from '@/components/ds';
import type { Database } from '@/lib/database.types';

/*
 * Products in the store, Portals v2 (Figma "Retail Portal v2 / 03 Products in the store", 368:558).
 * One card per product with an active sample here; scans and buys in this store, all time, from
 * get_retailer_product_stats (024). Print tag re-prints the product's existing codes (/print/tags →
 * /api/tag-prints), never a new one. Kept outside Figma: the Sample requests and Swap requests
 * tabs ("Confirm received" and return tracking live there) and Swap on the card.
 */

type Product = Database['public']['Tables']['products']['Row'];
type ProductStat = Database['public']['Functions']['get_retailer_product_stats']['Returns'][number];

type Sort = 'scans' | 'buys' | 'name' | 'newest';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'scans', label: 'Most scanned' },
  { value: 'buys', label: 'Most bought' },
  { value: 'name', label: 'Name' },
  { value: 'newest', label: 'Newest' },
];

const count = (n: number) => n.toLocaleString('en-GB');

type SwapTarget = { id: string; brand_id: string; product_name: string };

type SwapRequestRow = {
  id: string;
  return_sample_id: string;
  return_product_name: string;
  new_product_name: string;
  new_size: string;
  new_color: string;
  status: string;
  reason: string | null;
  return_tracking_number: string | null;
  created_at: string;
};

type SampleRequestRow = {
  id: string;
  brand_name: string;
  status: string;
  note: string | null;
  review_note: string | null;
  created_at: string;
  items: { id: string; product_name: string; size: string; color: string; deposit_amount_dkk: number }[];
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting for brand',
  approved: 'Approved',
  shipped: 'On its way',
  received: 'Received',
  rejected: 'Declined',
};

const SWAP_STATUS_LABELS: Record<string, string> = {
  requested: 'Pending',
  approved: 'Approved',
  return_shipped: 'Return shipped',
  return_received: 'Return received',
  inspected_ok: 'Inspected OK',
  inspected_damaged: 'Damaged',
  new_shipped: 'New shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function RetailerSamplesPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductStat[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'samples' | 'swaps' | 'requests'>('samples');
  const [sampleRequests, setSampleRequests] = useState<SampleRequestRow[]>([]);
  const [brandFilter, setBrandFilter] = useState('all');
  const [sort, setSort] = useState<Sort>('scans');
  const [retailerId, setRetailerId] = useState<string | null>(null);

  // Swap modal state
  const [swapSample, setSwapSample] = useState<SwapTarget | null>(null);
  const [swapProductId, setSwapProductId] = useState('');
  const [swapSize, setSwapSize] = useState('');
  const [swapColor, setSwapColor] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [brandProducts, setBrandProducts] = useState<Pick<Product, 'id' | 'name' | 'sizes' | 'colors' | 'deposit_amount_dkk'>[]>([]);

  // Return tracking state
  const [trackingSwapId, setTrackingSwapId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

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
        setRetailerId(rp.id);

        const [statsRes, swapsData] = await Promise.all([
          supabase.rpc('get_retailer_product_stats'),
          supabase.from('swap_requests').select('*').eq('retailer_id', rp.id).order('created_at', { ascending: false }),
        ]);

        setProducts((statsRes.data ?? []) as ProductStat[]);

        // Enrich swap requests
        const swaps = (swapsData.data ?? []) as Record<string, unknown>[];
        if (swaps.length > 0) {
          const returnSampleIds = swaps.map((s) => s.return_sample_id as string);
          const newProductIds = swaps.map((s) => s.new_product_id as string);

          const [returnSamplesRes, newProductsRes] = await Promise.all([
            supabase.from('samples').select('id, product_id').in('id', returnSampleIds),
            supabase.from('products').select('id, name').in('id', newProductIds),
          ]);

          const returnSampleProductIds = (returnSamplesRes.data ?? []).map((s: { product_id: string }) => s.product_id);
          const { data: returnProducts } = await supabase.from('products').select('id, name').in('id', returnSampleProductIds);

          const returnSampleMap = new Map<string, string>((returnSamplesRes.data ?? []).map((s: { id: string; product_id: string }) => [s.id, s.product_id]));
          const returnProductMap = new Map<string, string>((returnProducts ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
          const newProductMap = new Map<string, string>((newProductsRes.data ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

          setSwapRequests(swaps.map((sw) => ({
            id: sw.id as string,
            return_sample_id: sw.return_sample_id as string,
            return_product_name: returnProductMap.get(returnSampleMap.get(sw.return_sample_id as string) ?? '') ?? 'Unknown',
            new_product_name: newProductMap.get(sw.new_product_id as string) ?? 'Unknown',
            new_size: sw.new_size as string,
            new_color: sw.new_color as string,
            status: sw.status as string,
            reason: sw.reason as string | null,
            return_tracking_number: sw.return_tracking_number as string | null,
            created_at: sw.created_at as string,
          })));
        }

        setLoading(false);
      });
  }, [user]);

  // Sample requests the retailer has sent (status, items, deposits). Read-only.
  useEffect(() => {
    if (!retailerId) return;
    const supabase = createClient();

    (async () => {
      const { data: reqs } = await supabase
        .from('sample_requests')
        .select('id, brand_id, status, note, review_note, created_at')
        .eq('retailer_id', retailerId)
        .order('created_at', { ascending: false });

      const rows = (reqs ?? []) as { id: string; brand_id: string; status: string; note: string | null; review_note: string | null; created_at: string }[];
      if (rows.length === 0) {
        setSampleRequests([]);
        return;
      }

      const { data: itemsData } = await supabase
        .from('sample_request_items')
        .select('id, request_id, product_id, size, color, deposit_amount_dkk')
        .in('request_id', rows.map((r) => r.id));
      const items = (itemsData ?? []) as { id: string; request_id: string; product_id: string; size: string; color: string; deposit_amount_dkk: number }[];

      const [brandsRes, productsRes] = await Promise.all([
        supabase.from('brand_profiles').select('id, name').in('id', Array.from(new Set(rows.map((r) => r.brand_id)))),
        supabase.from('products').select('id, name').in('id', Array.from(new Set(items.map((i) => i.product_id)))),
      ]);
      const brandNames = new Map(((brandsRes.data ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]));
      const productNames = new Map(((productsRes.data ?? []) as { id: string; name: string }[]).map((pr) => [pr.id, pr.name]));

      setSampleRequests(
        rows.map((r) => ({
          id: r.id,
          brand_name: brandNames.get(r.brand_id) ?? 'Unknown brand',
          status: r.status,
          note: r.note,
          review_note: r.review_note,
          created_at: r.created_at,
          items: items
            .filter((i) => i.request_id === r.id)
            .map((i) => ({
              id: i.id,
              product_name: productNames.get(i.product_id) ?? 'Unknown product',
              size: i.size,
              color: i.color,
              deposit_amount_dkk: i.deposit_amount_dkk,
            })),
        }))
      );
    })();
  }, [retailerId]);

  async function openSwapModal(sample: SwapTarget) {
    setSwapSample(sample);
    setSwapProductId('');
    setSwapSize('');
    setSwapColor('');
    setSwapReason('');

    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, sizes, colors, deposit_amount_dkk')
      .eq('brand_id', sample.brand_id)
      .eq('is_active', true)
      .order('name');
    setBrandProducts((data ?? []) as typeof brandProducts);
  }

  async function submitSwap() {
    if (!swapSample || !swapProductId || !swapSize || !swapColor) return;
    setSwapSubmitting(true);

    const res = await fetch('/api/swap-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        return_sample_id: swapSample.id,
        new_product_id: swapProductId,
        new_size: swapSize,
        new_color: swapColor,
        reason: swapReason || null,
      }),
    });

    setSwapSubmitting(false);
    if (res.ok) {
      setSwapSample(null);
      window.location.reload();
    }
  }

  async function submitReturnTracking(swapId: string) {
    if (!trackingNumber) return;
    await fetch(`/api/swap-requests/${swapId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'return_shipped', tracking_number: trackingNumber }),
    });
    setTrackingSwapId(null);
    setTrackingNumber('');
    window.location.reload();
  }

  async function confirmReceived(requestId: string) {
    await fetch(`/api/sample-requests/${requestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'received' }),
    });
    window.location.reload();
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  const selectedSwapProduct = brandProducts.find((p) => p.id === swapProductId);
  const pendingSwaps = swapRequests.filter((s) => !['completed', 'cancelled'].includes(s.status));
  const openRequests = sampleRequests.filter((r) => !['received', 'rejected'].includes(r.status)).length;

  const brands = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.brand_name, (m.get(p.brand_name) ?? 0) + 1);
    return Array.from(m, ([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [products]);

  const visible = useMemo(() => {
    const rows = brandFilter === 'all' ? products : products.filter((p) => p.brand_name === brandFilter);
    return [...rows].sort((a, b) => {
      if (sort === 'buys') return b.buys - a.buys || b.scans - a.scans;
      if (sort === 'name') return a.product_name.localeCompare(b.product_name);
      if (sort === 'newest') return b.placed_at.localeCompare(a.placed_at);
      return b.scans - a.scans || b.buys - a.buys;
    });
  }, [products, brandFilter, sort]);

  const maxScans = Math.max(...products.map((p) => p.scans), 1);
  const printableIds = products.flatMap((p) => p.sample_ids);

  // Reprints the existing codes on 50 × 70 mm tags (/print/tags logs each one;
  // the server only allows this store's own samples).
  function printQrTags(ids: string[]) {
    if (!ids.length) return;
    window.open(`/print/tags?portal=retail&ids=${ids.join(',')}`, '_blank');
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-96 max-w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products in the store"
        subtitle="Placed here by the brands. Print a tag yourself if one is missing or worn: it keeps the same code."
        actions={
          <Button variant="flame" className="h-[43px]" onClick={() => printQrTags(printableIds)} disabled={printableIds.length === 0}>
            <Printer className="h-4 w-4" /> Print all QR tags (PDF)
          </Button>
        }
      />

      <Tabs
        variant="underline"
        value={tab}
        onValueChange={(v) => setTab(v as 'samples' | 'swaps' | 'requests')}
        items={[
          { value: 'samples', label: 'In the store', count: products.length },
          { value: 'requests', label: 'Sample requests', count: openRequests > 0 ? openRequests : undefined },
          { value: 'swaps', label: 'Swap requests', count: pendingSwaps.length > 0 ? pendingSwaps.length : undefined },
        ]}
      />

      {tab === 'samples' && (
        <>
          {products.length === 0 ? (
            <EmptyState
              icon={<QrCode className="h-5 w-5" />}
              title="No products yet"
              description="Request samples from your brand partners. They arrive with a QR tag for your store."
              action={
                <Link href="/retailer/samples/request" className={buttonClasses({ variant: 'flame' })}>
                  <Plus className="h-4 w-4" /> Request samples
                </Link>
              }
            />
          ) : (
            <>
              <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
                <Segmented
                  label="Brand"
                  value={brandFilter}
                  onValueChange={setBrandFilter}
                  items={[
                    { value: 'all', label: `All brands ${count(products.length)}` },
                    ...brands.map((b) => ({ value: b.name, label: `${b.name} ${count(b.n)}` })),
                  ]}
                  className="self-start border border-line-dark-subtle bg-obsidian"
                />
                <span className="hidden flex-1 md:block" />
                <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-[38px] md:w-52">
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      Sort: {s.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {visible.map((p) => (
                  <article key={p.product_id} className={cn(portalPanel, 'flex flex-col p-3')}>
                    <div className="relative aspect-[240/165] w-full overflow-hidden bg-flaym-gradient">
                      {p.image && (
                        <Image src={p.image} alt="" fill className="object-cover" sizes="(min-width: 1280px) 240px, (min-width: 640px) 50vw, 100vw" />
                      )}
                      <span
                        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center bg-obsidian/80 text-flare"
                        title={p.sample_ids.length === 1 ? '1 QR tag' : `${p.sample_ids.length} QR tags`}
                      >
                        <QrCode className="h-4 w-4" />
                      </span>
                    </div>

                    <div className="px-1 pt-3.5">
                      <p className="truncate text-body font-semibold text-flare">{p.product_name}</p>
                      <p className="mt-0.5 truncate text-caption text-smoke">
                        {p.brand_name} · {formatPriceRange({ min: p.price_min, max: p.price_max })}
                      </p>
                      <div className="mt-3 flex items-baseline justify-between gap-2 text-caption">
                        <span className="font-medium tabular-nums text-flare">
                          {count(p.scans)} {p.scans === 1 ? 'scan' : 'scans'}
                        </span>
                        <span className="tabular-nums text-ash">
                          {count(p.buys)} {p.buys === 1 ? 'buy' : 'buys'}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 bg-surface-dark">
                        <div
                          className="h-1 bg-flaym-progress"
                          style={{ width: `${p.scans > 0 ? Math.max(3, (p.scans / maxScans) * 100) : 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => printQrTags(p.sample_ids)}
                        disabled={p.sample_ids.length === 0}
                        className="h-9 flex-1 border border-line-dark-subtle text-caption font-medium text-flare transition-colors hover:border-flare/30 disabled:cursor-not-allowed disabled:text-smoke"
                      >
                        Print tag
                      </button>
                      {p.sample_ids[0] && (
                        <button
                          type="button"
                          onClick={() => openSwapModal({ id: p.sample_ids[0], brand_id: p.brand_id, product_name: p.product_name })}
                          aria-label={`Swap ${p.product_name}`}
                          title="Swap for another product from the same brand"
                          className="flex h-9 w-9 items-center justify-center border border-line-dark-subtle text-ash transition-colors hover:border-flare/30 hover:text-flare"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'requests' && (
        <>
          {sampleRequests.length === 0 ? (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="No sample requests"
              description="Requests you send to brands show up here until the samples arrive."
              action={
                <Link href="/retailer/samples/request" className={buttonClasses({ variant: 'accent' })}>
                  <Plus className="h-4 w-4" /> Request samples
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {sampleRequests.map((r) => {
                const deposit = r.items.reduce((sum, i) => sum + i.deposit_amount_dkk, 0);
                return (
                  <Card key={r.id} className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body text-primary">{r.brand_name}</p>
                        <p className="mt-1 text-caption text-slate">
                          Sent {formatDate(r.created_at)} · {r.items.length} {r.items.length === 1 ? 'item' : 'items'} · {formatDKK(deposit)} deposit
                        </p>
                      </div>
                      <StatusPill status={r.status} label={REQUEST_STATUS_LABELS[r.status] ?? r.status} />
                    </div>

                    <ul className="divide-y divide-line border-y border-line">
                      {r.items.map((i) => (
                        <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                          <p className="min-w-0 truncate text-body text-primary">
                            {i.product_name} <span className="text-caption text-slate">· {i.size} / {i.color}</span>
                          </p>
                          <span className="shrink-0 text-caption text-slate">{formatDKK(i.deposit_amount_dkk)}</span>
                        </li>
                      ))}
                    </ul>

                    {(r.note || r.review_note) && (
                      <div className="space-y-1 text-caption text-slate">
                        {r.note && <p>Your note: {r.note}</p>}
                        {r.review_note && <p>From {r.brand_name}: {r.review_note}</p>}
                      </div>
                    )}

                    {r.status === 'shipped' && (
                      <Button size="sm" onClick={() => confirmReceived(r.id)} leftIcon={<Package className="h-4 w-4" />}>
                        Confirm received
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'swaps' && (
        <>
          {swapRequests.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="h-5 w-5" />}
              title="No swap requests"
              description="Swap a product that isn't moving for something new from the same brand. Use Swap on any product card."
            />
          ) : (
            <div className="space-y-3">
              {swapRequests.map((sw) => (
                <Card key={sw.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body text-primary">
                        {sw.return_product_name} <span className="text-slate">→</span> {sw.new_product_name}
                      </p>
                      <p className="mt-1 text-caption text-slate">
                        {sw.new_size} / {sw.new_color}
                        {sw.reason && ` · ${sw.reason}`}
                      </p>
                    </div>
                    <StatusPill status={sw.status} label={SWAP_STATUS_LABELS[sw.status] ?? sw.status} />
                  </div>

                  {sw.status === 'approved' && (
                    <div>
                      {trackingSwapId === sw.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="Return tracking number"
                            className="flex-1"
                          />
                          <Button onClick={() => submitReturnTracking(sw.id)}>Submit</Button>
                        </div>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => setTrackingSwapId(sw.id)} leftIcon={<Truck className="h-4 w-4" />}>
                          Enter return tracking
                        </Button>
                      )}
                    </div>
                  )}

                  {sw.return_tracking_number && (
                    <p className="text-caption text-slate">Return tracking: {sw.return_tracking_number}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Swap modal */}
      <Modal
        open={!!swapSample}
        onClose={() => setSwapSample(null)}
        title="Swap product"
        footer={
          <>
            <Button
              className="flex-1"
              onClick={submitSwap}
              loading={swapSubmitting}
              disabled={swapSubmitting || !swapProductId || !swapSize || !swapColor}
            >
              {swapSubmitting ? 'Submitting…' : 'Submit swap request'}
            </Button>
            <Button variant="secondary" onClick={() => setSwapSample(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {swapSample && (
          <div className="space-y-4">
            <p className="text-body text-slate">
              Returning: <span className="text-primary">{swapSample.product_name}</span>
            </p>

            <Field label="Replacement product">
              <Select
                value={swapProductId}
                onChange={(e) => { setSwapProductId(e.target.value); setSwapSize(''); setSwapColor(''); }}
              >
                <option value="">Select product</option>
                {brandProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.deposit_amount_dkk ? ` (deposit: ${formatDKK(p.deposit_amount_dkk)})` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedSwapProduct && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Size">
                  <Select value={swapSize} onChange={(e) => setSwapSize(e.target.value)}>
                    <option value="">Select</option>
                    {selectedSwapProduct.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="Colour">
                  <Select value={swapColor} onChange={(e) => setSwapColor(e.target.value)}>
                    <option value="">Select</option>
                    {selectedSwapProduct.colors.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
              </div>
            )}

            <Field label="Reason">
              <Select value={swapReason} onChange={(e) => setSwapReason(e.target.value)}>
                <option value="">Select reason</option>
                <option value="Not performing">Not performing</option>
                <option value="Wrong size">Wrong size</option>
                <option value="Seasonal change">Seasonal change</option>
                <option value="Other">Other</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
