'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { QrCode, Plus, ArrowLeftRight, Truck, Package } from 'lucide-react';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  CardSkeleton,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
} from '@/components/ds';
import type { Database } from '@/lib/database.types';

type Sample = Database['public']['Tables']['samples']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];

type SampleWithDetails = Sample & {
  product_name: string;
  product_image: string | null;
  product_sizes: string[];
  product_colors: string[];
  brand_name: string;
  scan_count: number;
  last_scanned: string | null;
};

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
  const [samples, setSamples] = useState<SampleWithDetails[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'samples' | 'swaps' | 'requests'>('samples');
  const [sampleRequests, setSampleRequests] = useState<SampleRequestRow[]>([]);
  const [brandFilter, setBrandFilter] = useState('all');
  const [retailerId, setRetailerId] = useState<string | null>(null);

  // Swap modal state
  const [swapSample, setSwapSample] = useState<SampleWithDetails | null>(null);
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

        const [samplesData, swapsData] = await Promise.all([
          supabase.from('samples').select('*').eq('retailer_id', rp.id).order('created_at', { ascending: false }),
          supabase.from('swap_requests').select('*').eq('retailer_id', rp.id).order('created_at', { ascending: false }),
        ]);

        // Enrich samples
        const typed = (samplesData.data ?? []) as Sample[];
        if (typed.length > 0) {
          const productIds = Array.from(new Set(typed.map((s) => s.product_id)));
          const brandIds = Array.from(new Set(typed.map((s) => s.brand_id)));
          const sampleIds = typed.map((s) => s.id);

          const [productsRes, brandsRes, scansRes] = await Promise.all([
            supabase.from('products').select('id, name, images, sizes, colors, deposit_amount_dkk').in('id', productIds),
            supabase.from('brand_profiles').select('id, name').in('id', brandIds),
            supabase.from('scans').select('sample_id, scanned_at').in('sample_id', sampleIds).order('scanned_at', { ascending: false }),
          ]);

          const productMap = new Map((productsRes.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]));
          const brandMap = new Map<string, string>((brandsRes.data ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));

          const scanCounts = new Map<string, number>();
          const lastScanned = new Map<string, string>();
          for (const scan of (scansRes.data ?? []) as { sample_id: string | null; scanned_at: string }[]) {
            if (scan.sample_id) {
              scanCounts.set(scan.sample_id, (scanCounts.get(scan.sample_id) ?? 0) + 1);
              if (!lastScanned.has(scan.sample_id)) lastScanned.set(scan.sample_id, scan.scanned_at);
            }
          }

          setSamples(typed.map((s) => {
            const product = productMap.get(s.product_id) as Record<string, unknown> | undefined;
            return {
              ...s,
              product_name: (product?.name as string) ?? 'Unknown product',
              product_image: (product?.images as string[])?.[0] ?? null,
              product_sizes: (product?.sizes as string[]) ?? [],
              product_colors: (product?.colors as string[]) ?? [],
              brand_name: brandMap.get(s.brand_id) ?? 'Unknown brand',
              scan_count: scanCounts.get(s.id) ?? 0,
              last_scanned: lastScanned.get(s.id) ?? null,
            };
          }));
        }

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

  async function openSwapModal(sample: SampleWithDetails) {
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

  // Brand filter (Figma 03 segmented control) — client-side only.
  const brandCounts = samples.reduce<Map<string, number>>((m, s) => m.set(s.brand_name, (m.get(s.brand_name) ?? 0) + 1), new Map());
  const visibleSamples = brandFilter === 'all' ? samples : samples.filter((s) => s.brand_name === brandFilter);
  const printableSamples = samples.filter((s) => s.qr_code_url);

  // "Print all QR tags": opens the existing QR images in a print-ready window. No new data.
  function printQrTags() {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    const tags = printableSamples
      .map(
        (s) => `<figure><img src="${esc(s.qr_code_url as string)}" alt="" /><figcaption><b>${esc(s.product_name)}</b><br/>${esc(
          s.brand_name
        )}${s.size || s.color ? ' · ' + esc([s.size, s.color].filter(Boolean).join(' / ')) : ''}</figcaption></figure>`
      )
      .join('');
    win.document.write(
      `<!doctype html><title>QR tags</title><style>body{font-family:'IBM Plex Mono',monospace;margin:24px;color:#2C2324}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0;border:1px solid #D5D1C8;padding:16px;text-align:center;break-inside:avoid}img{width:140px;height:140px}figcaption{font-size:12px;margin-top:8px;line-height:1.4}</style><main>${tags}</main><script>window.onload=()=>window.print()</script>`
    );
    win.document.close();
  }

  if (loading) {
    return (
      <div className="space-y-7">
        <div className="space-y-2">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-80 max-w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header (Figma 03) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-brand text-heading-xl uppercase text-primary">Products in the store</h1>
          <p className="mt-1 text-body text-slate">Placed here by the brands. Print a tag if one is missing or worn.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/retailer/samples/request" className={buttonClasses({ variant: 'secondary' })}>
            <Plus className="h-4 w-4" /> Request samples
          </Link>
          <Button variant="accent" onClick={printQrTags} disabled={printableSamples.length === 0}>
            Print all QR tags
          </Button>
        </div>
      </div>

      <Tabs
        variant="underline"
        value={tab}
        onValueChange={(v) => setTab(v as 'samples' | 'swaps' | 'requests')}
        items={[
          { value: 'samples', label: 'In the store', count: samples.filter((s) => s.status === 'active').length },
          { value: 'requests', label: 'Sample requests', count: openRequests > 0 ? openRequests : undefined },
          { value: 'swaps', label: 'Swap requests', count: pendingSwaps.length > 0 ? pendingSwaps.length : undefined },
        ]}
      />

      {tab === 'samples' && (
        <>
          {samples.length === 0 ? (
            <EmptyState
              icon={<QrCode className="h-5 w-5" />}
              title="No products yet"
              description="Request samples from your brand partners. They arrive with a QR tag for your store."
              action={
                <Link href="/retailer/samples/request" className={buttonClasses({ variant: 'accent' })}>
                  <Plus className="h-4 w-4" /> Request samples
                </Link>
              }
            />
          ) : (
            <>
              {brandCounts.size > 1 && (
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <Tabs
                    className="whitespace-nowrap"
                    value={brandFilter}
                    onValueChange={setBrandFilter}
                    items={[
                      { value: 'all', label: 'All brands', count: samples.length },
                      ...Array.from(brandCounts, ([name, count]) => ({ value: name, label: name, count })),
                    ]}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {visibleSamples.map((sample) => (
                  <Card key={sample.id} padding="none" className="flex flex-col p-4">
                    <div className="relative aspect-[228/180] w-full overflow-hidden bg-flaym-gradient">
                      {sample.product_image && (
                        <Image src={sample.product_image} alt="" fill className="object-cover" sizes="(min-width: 1280px) 228px, (min-width: 640px) 50vw, 100vw" />
                      )}
                    </div>

                    <div className="mt-3.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-body text-primary">{sample.product_name}</p>
                        <p className="mt-1 truncate text-caption text-slate">
                          {[sample.brand_name, [sample.size, sample.color].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {sample.qr_code_url ? (
                        <a href={sample.qr_code_url} target="_blank" rel="noreferrer" aria-label="Open QR tag" className="shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={sample.qr_code_url} alt="" width={44} height={44} className="h-11 w-11" />
                        </a>
                      ) : (
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-line text-slate">
                          <QrCode className="h-5 w-5" />
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <StatusPill status={sample.status} />
                      {sample.deposit_status === 'held' && sample.deposit_amount_dkk && (
                        <Badge tone="warning">{formatDKK(sample.deposit_amount_dkk)} held</Badge>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                      <p className="whitespace-nowrap text-caption text-primary">
                        {sample.scan_count} scans
                        {sample.last_scanned && <span className="text-slate"> · {formatDate(sample.last_scanned)}</span>}
                      </p>
                      {sample.status === 'active' && (
                        <Button size="sm" variant="ghost" onClick={() => openSwapModal(sample)} leftIcon={<ArrowLeftRight className="h-3.5 w-3.5" />}>
                          Swap
                        </Button>
                      )}
                    </div>
                  </Card>
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
              {swapSample.size && ` (${swapSample.size})`}
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
