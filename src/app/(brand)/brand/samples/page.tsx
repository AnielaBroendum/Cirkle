'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK, formatCommission } from '@/lib/utils';
import { Plus, QrCode, Download, ExternalLink, Trash2, Loader2, Store, Printer, Handshake, Copy, Check } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  ListSkeleton,
  Modal,
  Skeleton,
  StatusPill,
  buttonClasses,
  cn,
} from '@/components/ds';
import { StoresTabs } from '@/components/brand/stores-tabs';
import { InviteStoreModal } from '@/components/brand/invite-store-modal';
import type { Database } from '@/lib/database.types';

type Sample = Database['public']['Tables']['samples']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type RetailerProfile = Database['public']['Tables']['retailer_profiles']['Row'];
type Partnership = Database['public']['Tables']['brand_retailer_partnerships']['Row'];

type SampleWithDetails = Sample & {
  product: Pick<Product, 'name' | 'images'> | null;
  retailer: Pick<RetailerProfile, 'name'> | null;
  scan_count: number;
};

type StoreMeta = Pick<RetailerProfile, 'id' | 'name' | 'city' | 'store_type' | 'description' | 'logo_url'>;

// Left column entries: partner stores, invitations / requests, stores to partner with.
type Selection =
  | { kind: 'store'; id: string }
  | { kind: 'pending'; id: string }
  | { kind: 'available'; id: string };

const OPEN_SWAP_STATUSES = ['requested', 'approved', 'return_shipped', 'return_received', 'inspected_ok', 'inspected_damaged', 'new_shipped'];

export default function BrandSamplesPage() {
  const { user } = useAuth();
  const [samples, setSamples] = useState<SampleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandId, setBrandId] = useState<string | null>(null);

  // Stores: partnerships, store details, stores not yet partnered
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [storeMeta, setStoreMeta] = useState<Map<string, StoreMeta>>(new Map());
  const [availableStores, setAvailableStores] = useState<StoreMeta[]>([]);
  const [products, setProducts] = useState<Pick<Product, 'id' | 'name' | 'images' | 'sizes'>[]>([]);
  // Open swap request per returned sample
  const [openSwaps, setOpenSwaps] = useState<Map<string, string>>(new Map());
  const [storesLoading, setStoresLoading] = useState(true);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SampleWithDetails | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Request partnership (same call and default commission as the partnerships page)
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [commDirect, setCommDirect] = useState(25);
  const [commDeferred, setCommDeferred] = useState(15);
  const [commTier2, setCommTier2] = useState(10);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: bp }: { data: { id: string } | null }) => {
        if (!bp) return;
        const brandId = (bp as { id: string }).id;
        setBrandId(brandId);

        const { data: samplesData } = await supabase
          .from('samples')
          .select('*')
          .eq('brand_id', brandId)
          .order('created_at', { ascending: false });

        if (!samplesData || samplesData.length === 0) {
          setLoading(false);
          return;
        }

        const typedSamples = samplesData as Sample[];
        const productIds = Array.from(new Set(typedSamples.map((s) => s.product_id)));
        const retailerIds = Array.from(new Set(typedSamples.map((s) => s.retailer_id)));
        const sampleIds = typedSamples.map((s) => s.id);

        const [productsRes, retailersRes, scansRes] = await Promise.all([
          supabase.from('products').select('id, name, images').in('id', productIds),
          supabase.from('retailer_profiles').select('id, name').in('id', retailerIds),
          supabase.from('scans').select('sample_id').in('sample_id', sampleIds),
        ]);

        const productsMap = new Map(
          ((productsRes.data ?? []) as Pick<Product, 'id' | 'name' | 'images'>[]).map((p) => [p.id, p])
        );
        const retailersMap = new Map(
          ((retailersRes.data ?? []) as (Pick<RetailerProfile, 'id' | 'name'>)[]).map((r) => [r.id, r])
        );

        const scanCounts = new Map<string, number>();
        for (const scan of (scansRes.data ?? []) as { sample_id: string | null }[]) {
          if (scan.sample_id) {
            scanCounts.set(scan.sample_id, (scanCounts.get(scan.sample_id) ?? 0) + 1);
          }
        }

        const enriched: SampleWithDetails[] = typedSamples.map((s) => ({
          ...s,
          product: productsMap.get(s.product_id) ?? null,
          retailer: retailersMap.get(s.retailer_id) ?? null,
          scan_count: scanCounts.get(s.id) ?? 0,
        }));

        setSamples(enriched);
        setLoading(false);
      });
  }, [user]);

  // Stores list: partnerships, store details, available stores, products, open swaps
  async function loadStores(brandId: string) {
    const supabase = createClient();
    const [partnershipsRes, retailersRes, productsRes, swapsRes] = await Promise.all([
      supabase.from('brand_retailer_partnerships').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
      supabase
        .from('retailer_profiles')
        .select('id, name, city, store_type, description, logo_url')
        .eq('onboarding_complete', true)
        .order('name'),
      supabase.from('products').select('id, name, images, sizes').eq('brand_id', brandId).eq('is_active', true).order('name'),
      supabase.from('swap_requests').select('return_sample_id, status').eq('brand_id', brandId).in('status', OPEN_SWAP_STATUSES),
    ]);

    const typed = (partnershipsRes.data ?? []) as Partnership[];
    const retailers = (retailersRes.data ?? []) as StoreMeta[];
    const partneredIds = new Set(typed.map((p) => p.retailer_id).filter((id): id is string => id !== null));

    setPartnerships(typed);
    setStoreMeta(new Map(retailers.map((r) => [r.id, r])));
    setAvailableStores(retailers.filter((r) => !partneredIds.has(r.id)));
    setProducts((productsRes.data ?? []) as Pick<Product, 'id' | 'name' | 'images' | 'sizes'>[]);
    setOpenSwaps(
      new Map(((swapsRes.data ?? []) as { return_sample_id: string; status: string }[]).map((s) => [s.return_sample_id, s.status]))
    );
    setStoresLoading(false);
  }

  useEffect(() => {
    if (brandId) loadStores(brandId);
  }, [brandId]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // The QR lives on Supabase Storage (another origin), where browsers ignore
  // the download attribute and just open the image. Fetch it and download a
  // same-origin blob instead; fall back to opening it in a new tab.
  async function downloadQr(url: string, productName: string) {
    const filename = `qr-${productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`QR fetch failed: ${res.status}`);
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  }

  async function deleteSample(sampleId: string) {
    setDeletingId(sampleId);
    setDeleteError('');
    const res = await fetch(`/api/samples?id=${sampleId}`, { method: 'DELETE' });
    if (res.ok) {
      setSamples((prev) => prev.filter((s) => s.id !== sampleId));
    } else {
      setDeleteError('Could not delete this QR code. Please try again.');
    }
    setDeletingId(null);
  }

  async function handleRequestRetailer(retailerId: string) {
    setRequestingId(retailerId);
    await fetch('/api/partnerships/request-retailer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retailer_id: retailerId,
        commission_direct: commDirect * 100,
        commission_deferred: commDeferred * 100,
        commission_tier2: commTier2 * 100,
      }),
    });
    setRequestingId(null);
    if (brandId) await loadStores(brandId);
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  // Samples per store
  const byStore = useMemo(() => {
    const map = new Map<string, SampleWithDetails[]>();
    for (const s of samples) {
      if (!map.has(s.retailer_id)) map.set(s.retailer_id, []);
      map.get(s.retailer_id)!.push(s);
    }
    return map;
  }, [samples]);

  // Partner stores: active partnerships plus any store that holds samples
  const partnerStores = useMemo(() => {
    const ids = new Set<string>();
    for (const p of partnerships) if (p.status === 'active' && p.retailer_id) ids.add(p.retailer_id);
    byStore.forEach((_, id) => ids.add(id));
    return Array.from(ids)
      .map((id) => ({
        id,
        name: storeMeta.get(id)?.name ?? byStore.get(id)?.[0]?.retailer?.name ?? 'Unknown store',
        city: storeMeta.get(id)?.city ?? null,
        count: byStore.get(id)?.filter((s) => s.status === 'active').length ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [partnerships, byStore, storeMeta]);

  // Brand-initiated invitations have a token; retailer requests don't.
  const pending = partnerships.filter((p) => p.status === 'invited');

  // Default to the first partner store
  useEffect(() => {
    if (selection || loading || storesLoading) return;
    if (partnerStores[0]) setSelection({ kind: 'store', id: partnerStores[0].id });
    else if (pending[0]) setSelection({ kind: 'pending', id: pending[0].id });
    else if (availableStores[0]) setSelection({ kind: 'available', id: availableStores[0].id });
  }, [selection, loading, storesLoading, partnerStores, pending, availableStores]);

  const selectedStoreSamples = selection?.kind === 'store' ? byStore.get(selection.id) ?? [] : [];
  const printable = selectedStoreSamples.filter((s) => s.qr_code_url && s.status === 'active');

  // Tick every printable tag when switching store
  useEffect(() => {
    setChecked(new Set(printable.map((s) => s.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.kind, selection?.id, samples]);

  function printTags(storeName: string) {
    const tags = printable.filter((s) => checked.has(s.id));
    if (!tags.length) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const cells = tags
      .map(
        (s) => `<figure><img src="${esc(s.qr_code_url!)}" alt=""/><figcaption><strong>${esc(s.product?.name ?? 'Product')}</strong><span>${esc(
          [s.size, s.color].filter(Boolean).join(' · ')
        )}</span><span>${esc(storeName)}</span></figcaption></figure>`
      )
      .join('');
    win.document.write(`<!doctype html><html><head><title>QR tags · ${esc(storeName)}</title><style>
      body{font-family:'IBM Plex Mono',ui-monospace,monospace;color:#2C2324;margin:24px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      figure{margin:0;border:1px solid #D5D1C8;padding:16px;text-align:center;break-inside:avoid}
      img{width:150px;height:150px}
      figcaption{display:flex;flex-direction:column;gap:2px;font-size:12px;margin-top:8px}
      strong{font-size:12px;font-weight:500}
    </style></head><body><div class="grid">${cells}</div></body></html>`);
    win.document.close();
    win.onload = () => win.print();
  }

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-brand text-heading-xl uppercase text-primary">Stores and QR tags</h1>
        <p className="mt-1 text-body text-slate">Choose what each store shows, then print its tags</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/brand/samples/new" className={buttonClasses({ variant: 'secondary' })}>
          <Plus className="h-4 w-4" /> Add sample
        </Link>
        <Button onClick={() => setInviteOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
          Invite store
        </Button>
      </div>
    </div>
  );

  if (loading || storesLoading) {
    return (
      <div className="space-y-6">
        {header}
        <StoresTabs />
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ListSkeleton rows={4} />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const noStores = partnerStores.length === 0 && pending.length === 0 && availableStores.length === 0;

  return (
    <div className="space-y-6">
      {header}
      <StoresTabs />

      {noStores ? (
        <EmptyState
          className="bg-surface"
          icon={<Store className="h-5 w-5" />}
          title="No stores yet"
          description="Invite a store to Flaym. Once it accepts, you can send samples and print QR tags for it."
          action={
            <Button onClick={() => setInviteOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Invite store
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5">
          {/* Store list */}
          <Card padding="none" className="rounded-none p-2.5">
            <StoreGroup title="Your stores" empty={partnerStores.length === 0 ? 'No partner stores yet.' : undefined}>
              {partnerStores.map((s) => (
                <StoreButton
                  key={s.id}
                  active={selection?.kind === 'store' && selection.id === s.id}
                  onClick={() => setSelection({ kind: 'store', id: s.id })}
                  title={s.name}
                  subtitle={[s.city, `${s.count} product${s.count !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                />
              ))}
            </StoreGroup>

            {pending.length > 0 && (
              <StoreGroup title="Waiting">
                {pending.map((p) => (
                  <StoreButton
                    key={p.id}
                    muted
                    active={selection?.kind === 'pending' && selection.id === p.id}
                    onClick={() => setSelection({ kind: 'pending', id: p.id })}
                    title={(p.retailer_id && storeMeta.get(p.retailer_id)?.name) || p.invitation_email || 'Store'}
                    subtitle={p.invitation_token ? 'Invited · waiting' : 'Wants to partner'}
                    badge={<Badge tone="warning">{p.invitation_token ? 'Pending' : 'Request'}</Badge>}
                  />
                ))}
              </StoreGroup>
            )}

            {availableStores.length > 0 && (
              <StoreGroup title="Available stores">
                {availableStores.map((r) => (
                  <StoreButton
                    key={r.id}
                    muted
                    active={selection?.kind === 'available' && selection.id === r.id}
                    onClick={() => setSelection({ kind: 'available', id: r.id })}
                    title={r.name}
                    subtitle={[storeType(r.store_type), r.city].filter(Boolean).join(' · ') || 'On Flaym'}
                  />
                ))}
              </StoreGroup>
            )}

            <div className="border-t border-line px-3 pb-1.5 pt-3">
              <Link href="/brand/partnerships" className="text-caption text-slate underline-offset-2 hover:text-primary hover:underline">
                All partnerships →
              </Link>
            </div>
          </Card>

          {/* Detail panel */}
          <Card padding="none" className="min-w-0 rounded-none p-5 lg:p-6">
            {selection?.kind === 'store' && (() => {
              const store = partnerStores.find((s) => s.id === selection.id);
              const storeName = store?.name ?? 'Store';
              const sampledProductIds = new Set(selectedStoreSamples.map((s) => s.product_id));
              const notInStore = products.filter((p) => !sampledProductIds.has(p.id));
              const allChecked = printable.length > 0 && printable.every((s) => checked.has(s.id));
              const count = printable.filter((s) => checked.has(s.id)).length;
              return (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">
                      {storeName} · Products
                    </h2>
                    {printable.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setChecked(allChecked ? new Set() : new Set(printable.map((s) => s.id)))}
                        >
                          {allChecked ? 'Clear all' : 'Select all'}
                        </Button>
                        <Button variant="accent" disabled={count === 0} onClick={() => printTags(storeName)} leftIcon={<Printer className="h-4 w-4" />}>
                          Print {count} QR tag{count !== 1 ? 's' : ''}
                        </Button>
                      </div>
                    )}
                  </div>

                  {deleteError && (
                    <p role="alert" className="mt-4 border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
                      {deleteError}
                    </p>
                  )}

                  {selectedStoreSamples.length === 0 ? (
                    <EmptyState
                      className="mt-5 border-none py-10"
                      icon={<QrCode className="h-5 w-5" />}
                      title="No products in this store"
                      description="Send this store a sample to create its QR tag."
                      action={
                        <Link href="/brand/samples/new" className={buttonClasses()}>
                          <Plus className="h-4 w-4" /> Add sample
                        </Link>
                      }
                    />
                  ) : (
                    <ul className="mt-4 divide-y divide-line border-t border-line">
                      {selectedStoreSamples.map((sample) => {
                        const printableRow = !!sample.qr_code_url && sample.status === 'active';
                        const swapStatus = openSwaps.get(sample.id);
                        return (
                          <li key={sample.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5 sm:flex-nowrap">
                            <span className="w-[18px] shrink-0">
                              {printableRow && (
                                <Checkbox
                                  aria-label={`Print tag for ${sample.product?.name ?? 'product'}`}
                                  checked={checked.has(sample.id)}
                                  onChange={(e) =>
                                    setChecked((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(sample.id);
                                      else next.delete(sample.id);
                                      return next;
                                    })
                                  }
                                />
                              )}
                            </span>
                            <Thumb src={sample.product?.images?.[0]} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-body-sm text-primary">{sample.product?.name ?? 'Unknown product'}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-caption text-slate">
                                {[sample.size, sample.color].filter(Boolean).join(' · ') || 'One size'}
                                {sample.status !== 'active' && <StatusPill status={sample.status} />}
                                {sample.deposit_status === 'held' && sample.deposit_amount_dkk ? (
                                  <Badge tone="neutral">{formatDKK(sample.deposit_amount_dkk)} held</Badge>
                                ) : null}
                                {swapStatus && (
                                  <Link href="/brand/samples/swaps">
                                    <Badge tone="warning">Swap: {swapStatus.replace(/_/g, ' ')}</Badge>
                                  </Link>
                                )}
                              </div>
                            </div>
                            {sample.qr_code_url ? (
                              <Image src={sample.qr_code_url} alt="QR tag" width={40} height={40} className="shrink-0" />
                            ) : (
                              <span className="w-10 shrink-0 text-caption text-slate">—</span>
                            )}
                            <span className="w-16 shrink-0 text-right text-body-sm tabular-nums text-primary">
                              {sample.scan_count}
                              <span className="block text-caption text-slate">scans</span>
                            </span>
                            <div className="flex shrink-0 items-center">
                              {sample.qr_code_url && (
                                <IconButton label="Download QR" onClick={() => downloadQr(sample.qr_code_url!, sample.product?.name ?? 'sample')}>
                                  <Download className="h-4 w-4" />
                                </IconButton>
                              )}
                              <Link
                                href={`/p/${sample.id}`}
                                target="_blank"
                                aria-label="Open scan page"
                                title="Open scan page"
                                className="inline-flex h-9 w-9 items-center justify-center text-slate transition-colors hover:bg-surface-muted hover:text-primary"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                              <IconButton label="Delete QR code" disabled={deletingId === sample.id} onClick={() => setConfirmDelete(sample)}>
                                {deletingId === sample.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </IconButton>
                            </div>
                          </li>
                        );
                      })}
                      {notInStore.map((p) => (
                        <li key={p.id} className="flex items-center gap-4 py-3.5 opacity-70">
                          <span className="w-[18px] shrink-0" />
                          <Thumb src={p.images?.[0]} />
                          <p className="min-w-0 flex-1 truncate text-body-sm text-primary">{p.name}</p>
                          <span className="text-caption text-slate">Not in store</span>
                          <Link href="/brand/samples/new" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-4 text-caption text-slate">
                    Each tag is unique to product, brand and store, so a scan always credits the right store.
                  </p>
                </>
              );
            })()}

            {selection?.kind === 'pending' && (() => {
              const p = partnerships.find((x) => x.id === selection.id);
              if (!p) return null;
              const name = (p.retailer_id && storeMeta.get(p.retailer_id)?.name) || p.invitation_email || 'Store';
              const inviteUrl = p.invitation_token ? `${window.location.origin}/invite/${p.invitation_token}` : null;
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">{name}</h2>
                    <Badge tone="warning">{inviteUrl ? 'Pending' : 'Request'}</Badge>
                  </div>
                  <p className="text-body text-slate">
                    {inviteUrl
                      ? `Invited ${new Date(p.invited_at ?? p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. The store hasn't accepted yet.`
                      : 'This store asked to partner with you. Accept or decline it under Partnerships.'}
                  </p>
                  <p className="text-caption text-slate">
                    Commission: {formatCommission(p.commission_direct)} direct · {formatCommission(p.commission_deferred)} deferred ·{' '}
                    {formatCommission(p.commission_tier2)} tier 2
                  </p>
                  {inviteUrl ? (
                    <Button variant="secondary" onClick={() => copyUrl(inviteUrl)} leftIcon={copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
                      {copiedUrl ? 'Copied' : 'Copy invitation link'}
                    </Button>
                  ) : (
                    <Link href="/brand/partnerships" className={buttonClasses()}>
                      Review request
                    </Link>
                  )}
                </div>
              );
            })()}

            {selection?.kind === 'available' && (() => {
              const r = availableStores.find((x) => x.id === selection.id);
              if (!r) return null;
              return (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    {r.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.logo_url} alt="" className="h-12 w-12 shrink-0 border border-line object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-surface-muted text-heading-lg uppercase text-primary">
                        {r.name.charAt(0)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate font-brand text-body uppercase tracking-[0.3px] text-primary">{r.name}</h2>
                      <p className="text-caption text-slate">
                        {[storeType(r.store_type), r.city].filter(Boolean).join(' · ') || 'On Flaym'}
                      </p>
                    </div>
                  </div>
                  {r.description && <p className="text-body text-slate">{r.description}</p>}
                  <div>
                    <p className="mb-1.5 text-label uppercase text-slate">Store commission</p>
                    <div className="grid max-w-md grid-cols-3 gap-3">
                      <Field label="Direct %" htmlFor="req-direct">
                        <Input id="req-direct" type="number" min={0} max={100} value={commDirect} onChange={(e) => setCommDirect(Number(e.target.value))} />
                      </Field>
                      <Field label="Deferred %" htmlFor="req-deferred">
                        <Input id="req-deferred" type="number" min={0} max={100} value={commDeferred} onChange={(e) => setCommDeferred(Number(e.target.value))} />
                      </Field>
                      <Field label="Tier-2 %" htmlFor="req-tier2">
                        <Input id="req-tier2" type="number" min={0} max={100} value={commTier2} onChange={(e) => setCommTier2(Number(e.target.value))} />
                      </Field>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleRequestRetailer(r.id)}
                    loading={requestingId === r.id}
                    leftIcon={<Handshake className="h-4 w-4" />}
                  >
                    Request partnership
                  </Button>
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      <InviteStoreModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={() => brandId && loadStores(brandId)} />

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete QR code"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              fullWidth
              onClick={() => {
                if (confirmDelete) deleteSample(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-slate">
          Delete the QR code for <span className="text-primary">&ldquo;{confirmDelete?.product?.name ?? 'sample'}&rdquo;</span>? This can&apos;t be undone.
        </p>
      </Modal>
    </div>
  );
}

// "flower_shop" → "Flower shop"
function storeType(type: string | null) {
  if (!type) return null;
  const label = type.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function StoreGroup({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  return (
    <div className="pb-2">
      <p className="px-3 pb-1.5 pt-2 text-label uppercase text-slate">{title}</p>
      {empty ? <p className="px-3 pb-2 text-caption text-slate">{empty}</p> : children}
    </div>
  );
}

function StoreButton({
  title,
  subtitle,
  badge,
  active,
  muted,
  onClick,
}: {
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center justify-between gap-3 border-l-2 px-3 py-3 text-left transition-colors',
        active ? 'border-accent bg-canvas-warm' : 'border-transparent hover:bg-canvas-warm/60'
      )}
    >
      <span className="min-w-0">
        <span className={cn('block truncate text-body', muted && !active ? 'text-slate' : 'text-primary')}>{title}</span>
        <span className="mt-0.5 block truncate text-caption text-slate">{subtitle}</span>
      </span>
      {badge}
    </button>
  );
}

function Thumb({ src }: { src?: string }) {
  return src ? (
    <div className="relative h-10 w-[34px] shrink-0 overflow-hidden bg-surface-muted">
      <Image src={src} alt="" fill className="object-cover" sizes="34px" />
    </div>
  ) : (
    <div className="flex h-10 w-[34px] shrink-0 items-center justify-center bg-surface-muted">
      <QrCode className="h-4 w-4 text-slate" />
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center text-slate transition-colors hover:bg-surface-muted hover:text-primary disabled:opacity-50"
    >
      {children}
    </button>
  );
}
