'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { Check, Copy, Download, ExternalLink, Loader2, Printer, QrCode, Store, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  Chip,
  EmptyState,
  ListSkeleton,
  Modal,
  PageHeader,
  Panel,
  PanelHeader,
  ScanBar,
  Skeleton,
  StatusPill,
  Thumb,
  buttonClasses,
  cn,
  portalPanel,
} from '@/components/ds';
import { StoresTabs } from '@/components/brand/stores-tabs';
import { InviteStoreModal } from '@/components/brand/invite-store-modal';
import { getAppUrl } from '@/lib/base-url';
import type { Database } from '@/lib/database.types';

/*
 * Stores & QR tags, Portals v2 (Figma "Brand Portal v2 / 05 Stores and QR tags", 365:318).
 * Scan counts from get_brand_store_scans (020). Print tag re-prints the existing code of the
 * sample (/print/tags → /api/tag-prints), never a new one. Kept outside Figma: the sub-tabs
 * (requests, swaps, deposits, partnerships), Download QR, Open scan page and Delete per tag
 * (Edit product sends people here to take a piece out of a store). Resend invite is MISSING:
 * only "Copy invitation link" exists.
 */

type Sample = Database['public']['Tables']['samples']['Row'];
type Product = Pick<Database['public']['Tables']['products']['Row'], 'id' | 'name' | 'images' | 'sizes' | 'colors'>;
type RetailerProfile = Pick<Database['public']['Tables']['retailer_profiles']['Row'], 'id' | 'name' | 'city' | 'logo_url'>;
type Partnership = Database['public']['Tables']['brand_retailer_partnerships']['Row'];
type ScanData = NonNullable<Database['public']['Functions']['get_brand_store_scans']['Returns']>;

function sizeRange(sizes: string[] | null) {
  if (!sizes?.length) return '–';
  if (sizes.length === 1) return sizes[0];
  return `${sizes[0]}–${sizes[sizes.length - 1]}`;
}

const count = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

export default function BrandSamplesPage() {
  const { user } = useAuth();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [stores, setStores] = useState<Map<string, RetailerProfile>>(new Map());
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Sample | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  async function load(id: string) {
    const supabase = createClient();
    const [samplesRes, productsRes, partnershipsRes, scansRes] = await Promise.all([
      supabase.from('samples').select('*').eq('brand_id', id).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, images, sizes, colors').eq('brand_id', id).order('name'),
      supabase.from('brand_retailer_partnerships').select('*').eq('brand_id', id).order('created_at', { ascending: false }),
      supabase.rpc('get_brand_store_scans'),
    ]);
    const s = (samplesRes.data ?? []) as Sample[];
    const p = (partnershipsRes.data ?? []) as Partnership[];
    const retailerIds = Array.from(
      new Set([...s.map((x) => x.retailer_id), ...p.map((x) => x.retailer_id).filter((x): x is string => !!x)])
    );
    const retailersRes = retailerIds.length
      ? await supabase.from('retailer_profiles').select('id, name, city, logo_url').in('id', retailerIds)
      : { data: [] };
    setSamples(s);
    setProducts((productsRes.data ?? []) as Product[]);
    setPartnerships(p);
    setStores(new Map(((retailersRes.data ?? []) as RetailerProfile[]).map((r) => [r.id, r])));
    setScanData((scansRes.data as ScanData | null) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    createClient()
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }: { data: { id: string } | null }) => {
        if (!data) return setLoading(false);
        setBrandId(data.id);
        load(data.id);
      });
  }, [user]);

  const storeScans = useMemo(() => new Map((scanData?.stores ?? []).map((s) => [s.retailer_id, s])), [scanData]);
  const productScans = useMemo(
    () => new Map((scanData?.product_scans ?? []).map((s) => [`${s.retailer_id}|${s.product_id}`, s.scans])),
    [scanData]
  );

  // Partner stores: active partnerships plus any store holding one of the brand's samples. Most scanned first.
  const partnerStores = useMemo(() => {
    const ids = new Set<string>();
    for (const p of partnerships) if (p.status === 'active' && p.retailer_id) ids.add(p.retailer_id);
    for (const s of samples) ids.add(s.retailer_id);
    return Array.from(ids)
      .map((id) => ({
        id,
        name: stores.get(id)?.name ?? 'Unknown store',
        city: stores.get(id)?.city ?? null,
        logo: stores.get(id)?.logo_url ?? null,
        scans: storeScans.get(id)?.scans ?? 0,
        products: storeScans.get(id)?.products ?? 0,
      }))
      .sort((a, b) => b.scans - a.scans || a.name.localeCompare(b.name));
  }, [partnerships, samples, stores, storeScans]);

  const pending = partnerships.filter((p) => p.status === 'invited');

  // Start on the store a search result links to (?store=<id>), else the most scanned one.
  useEffect(() => {
    if (selected || loading) return;
    const linked = new URLSearchParams(window.location.search).get('store');
    if (linked && partnerStores.some((s) => s.id === linked)) setSelected(linked);
    else if (partnerStores[0]) setSelected(partnerStores[0].id);
  }, [selected, loading, partnerStores]);

  const store = partnerStores.find((s) => s.id === selected) ?? null;
  const storeSamples = samples.filter((s) => s.retailer_id === selected);
  // One row per product: its active sample here (the oldest, as /api/tag-prints prints), else the latest other one.
  const rows = useMemo(() => {
    return products
      .map((p) => {
        const mine = storeSamples.filter((s) => s.product_id === p.id);
        const active = mine.filter((s) => s.status === 'active').sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
        const sample = active ?? mine[0] ?? null;
        return { product: p, sample, printable: !!active?.qr_code_url, scans: selected ? productScans.get(`${selected}|${p.id}`) ?? 0 : 0 };
      })
      .sort((a, b) => Number(b.printable) - Number(a.printable) || b.scans - a.scans || a.product.name.localeCompare(b.product.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, samples, selected, productScans]);
  const printable = rows.filter((r) => r.printable);
  const maxScans = Math.max(1, ...rows.map((r) => r.scans));

  // Tick every printable tag when switching store.
  useEffect(() => {
    setChecked(new Set(printable.map((r) => r.sample!.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, samples]);

  const chosen = printable.filter((r) => checked.has(r.sample!.id)).map((r) => r.sample!.id);
  const allChecked = printable.length > 0 && chosen.length === printable.length;

  // Re-prints the existing codes on 50 × 70 mm tags (/print/tags logs each one).
  function printTags(ids: string[]) {
    if (ids.length) window.open(`/print/tags?portal=brand&ids=${ids.join(',')}`, '_blank');
  }

  // The QR lives on Supabase Storage (another origin), where browsers ignore the download
  // attribute. Fetch it and download a same-origin blob; fall back to opening it.
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
    if (res.ok) setSamples((prev) => prev.filter((s) => s.id !== sampleId));
    else setDeleteError('Could not delete this QR code. Please try again.');
    setDeletingId(null);
  }

  function copyInvite(p: Partnership) {
    if (!p.invitation_token) return;
    navigator.clipboard.writeText(`${getAppUrl()}/invite/${p.invitation_token}`);
    setCopied(p.id);
    setTimeout(() => setCopied(null), 2000);
  }

  const header = (
    <div className="space-y-5">
      <PageHeader
        title="Stores & QR tags"
        subtitle="Choose what each store shows, then print its tags."
        actions={
          <Button variant="flame" onClick={() => setInviteOpen(true)} className="h-[43px]">
            + Invite store
          </Button>
        }
      />
      <StoresTabs />
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-[86px]" />
          <Skeleton className="h-[86px]" />
        </div>
        <ListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {partnerStores.length === 0 && pending.length === 0 ? (
        <EmptyState
          icon={<Store className="h-5 w-5" />}
          title="No stores yet"
          description="Invite a store to Flaym. Once it accepts, you can place products there and print their QR tags."
          action={
            <Button variant="flame" onClick={() => setInviteOpen(true)}>
              + Invite store
            </Button>
          }
        />
      ) : (
        <>
          {/* Store cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {partnerStores.map((s) => {
              const on = s.id === selected;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  aria-pressed={on}
                  className={cn(portalPanel, 'flex flex-col gap-4 p-[18px] text-left transition-colors', on ? 'border-accent' : 'hover:border-flare/20')}
                >
                  <span className="flex items-center gap-2.5">
                    <Thumb src={s.logo} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-body-sm font-medium text-flare">{s.name}</span>
                      <span className="block truncate text-caption text-smoke">
                        {[s.city, plural(s.products, 'product')].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-title font-medium tabular-nums text-flare">{plural(s.scans, 'scan')}</span>
                    {on ? <span className="bg-primary px-2.5 py-1 text-caption font-medium text-on-primary">Selected</span> : <span className="text-body text-ash">↗</span>}
                  </span>
                </button>
              );
            })}
            {pending.map((p) => {
              const name = (p.retailer_id && stores.get(p.retailer_id)?.name) || p.invitation_email || 'Store';
              const invited = !!p.invitation_token;
              return (
                <div key={p.id} className={cn(portalPanel, 'flex flex-col gap-4 p-[18px]')}>
                  <span className="flex items-center gap-2.5">
                    <Thumb size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-body-sm font-medium text-flare">{name}</span>
                      <span className="block truncate text-caption text-smoke">{invited ? 'Invited · waiting' : 'Wants to partner'}</span>
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <Chip className="bg-accent-tint text-accent-bright">
                      <span className="h-2 w-2 rounded-pill bg-accent" aria-hidden />
                      {invited ? 'Pending' : 'Request'}
                    </Chip>
                    {invited ? (
                      <button
                        type="button"
                        onClick={() => copyInvite(p)}
                        className="flex items-center gap-1.5 border border-flare/10 px-3 py-1.5 text-caption font-medium text-flare hover:border-flare/30"
                      >
                        {copied === p.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === p.id ? 'Copied' : 'Copy invite link'}
                      </button>
                    ) : (
                      <Link href="/brand/partnerships" className="border border-flare/10 px-3 py-1.5 text-caption font-medium text-flare hover:border-flare/30">
                        Review
                      </Link>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Selected store's products */}
          {store && (
            <Panel className="flex flex-col gap-4">
              <PanelHeader
                title={`${store.name} · products`}
                subtitle={`${plural(printable.length, 'product')} placed · tags are unique to product, brand and store`}
                action={
                  printable.length > 0 && (
                    <div className="flex flex-wrap gap-2.5">
                      <Button
                        variant="secondary"
                        onClick={() => setChecked(allChecked ? new Set() : new Set(printable.map((r) => r.sample!.id)))}
                        className="h-9 px-3.5 text-caption"
                      >
                        {allChecked ? 'Clear all' : 'Select all'}
                      </Button>
                      <Button variant="flame" disabled={chosen.length === 0} onClick={() => printTags(chosen)} className="h-9 px-3.5 text-caption">
                        <Printer className="h-4 w-4" /> Print {plural(chosen.length, 'QR tag')}
                      </Button>
                    </div>
                  )
                }
              />

              {deleteError && (
                <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
                  {deleteError}
                </p>
              )}

              {rows.length === 0 ? (
                <p className="py-8 text-center text-caption text-smoke">No products yet. Add one in the product library.</p>
              ) : (
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse font-brand text-body-sm">
                    <thead>
                      <tr className="border-b border-line-dark-subtle text-left text-label uppercase text-smoke">
                        <th className="w-9 px-1 pb-2.5" />
                        <th className="px-2 pb-2.5 font-medium">Product</th>
                        <th className="hidden px-2 pb-2.5 font-medium lg:table-cell">Sizes</th>
                        <th className="px-2 pb-2.5 font-medium">QR tag</th>
                        <th className="px-2 pb-2.5 font-medium">Scans</th>
                        <th className="px-1 pb-2.5">
                          <span className="sr-only">More</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ product, sample, printable: canPrint, scans }) => {
                        const on = !!sample && checked.has(sample.id);
                        return (
                          <tr
                            key={product.id}
                            className={cn('border-b border-line-dark-subtle last:border-b-0', canPrint && on && 'bg-accent-tint')}
                          >
                            <td className="px-1 py-3">
                              {canPrint && sample && (
                                <Checkbox
                                  aria-label={`Print tag for ${product.name}`}
                                  checked={on}
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
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-3">
                                <Thumb src={product.images?.[0]} size={36} />
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-flare">{product.name}</p>
                                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-smoke">
                                    {[sample?.size, sample?.color].filter(Boolean).join(' · ') || product.colors?.join(' · ') || null}
                                    {sample && sample.status !== 'active' && <StatusPill status={sample.status} />}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden whitespace-nowrap px-2 text-ash lg:table-cell">{sizeRange(product.sizes)}</td>
                            <td className="px-2">
                              {canPrint && sample ? (
                                <button
                                  type="button"
                                  onClick={() => printTags([sample.id])}
                                  className="inline-flex items-center gap-1.5 border border-flare/10 px-2.5 py-1.5 text-caption font-medium text-flare hover:border-flare/30"
                                >
                                  <QrCode className="h-3.5 w-3.5" /> Print tag
                                </button>
                              ) : (
                                <span className="flex flex-wrap items-center gap-2">
                                  <Chip>
                                    <span className="h-2 w-2 rounded-pill bg-smoke" aria-hidden />
                                    Not in store
                                  </Chip>
                                  <Link href={`/brand/products/${product.id}/edit`} className="text-caption text-ash underline-offset-2 hover:text-flare hover:underline">
                                    Place
                                  </Link>
                                </span>
                              )}
                            </td>
                            <td className="px-2">
                              <ScanBar value={scans > 0 ? scans : null} max={maxScans} />
                            </td>
                            <td className="px-1">
                              {sample && (
                                <div className="flex justify-end">
                                  {sample.qr_code_url && (
                                    <IconButton label="Download QR" onClick={() => downloadQr(sample.qr_code_url!, product.name)}>
                                      <Download className="h-4 w-4" />
                                    </IconButton>
                                  )}
                                  <Link
                                    href={`/p/${sample.id}`}
                                    target="_blank"
                                    aria-label="Open scan page"
                                    title="Open scan page"
                                    className="inline-flex h-8 w-8 items-center justify-center text-smoke transition-colors hover:text-flare"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                  <IconButton label="Delete QR code" disabled={deletingId === sample.id} onClick={() => setConfirmDelete(sample)}>
                                    {deletingId === sample.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </IconButton>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="flex items-center gap-2.5 bg-surface-dark/60 px-3.5 py-3 text-caption text-ash">
                <QrCode className="h-4 w-4 shrink-0 text-smoke" />
                Missing or worn tag? Print it again. It keeps the same code, so every scan still credits the right store.
              </p>
            </Panel>
          )}
        </>
      )}

      <InviteStoreModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={() => brandId && load(brandId)} />

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
        <p className="text-smoke">
          Delete the QR code for{' '}
          <span className="text-flare">&ldquo;{products.find((p) => p.id === confirmDelete?.product_id)?.name ?? 'sample'}&rdquo;</span>? Printed tags
          stop working and the product leaves this store. This can&apos;t be undone.
        </p>
      </Modal>
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
      className="inline-flex h-8 w-8 items-center justify-center text-smoke transition-colors hover:text-flare disabled:opacity-50"
    >
      {children}
    </button>
  );
}
