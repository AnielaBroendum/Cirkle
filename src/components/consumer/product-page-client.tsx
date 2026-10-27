'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Share2, Link as LinkIcon, Loader2 } from 'lucide-react';
import { formatDKK } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { BottomNav, Toast, cn } from '@/components/ds';
import { addToBasket } from './basket-store';
import { consumerTabs } from './tab-items';
import { BrandStoriesViewer, type BrandStory } from './brand-stories-viewer';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type ProductPageProps = {
  product: {
    id: string;
    name: string;
    description: string | null;
    price_dkk: number;
    images: string[];
    sizes: string[];
    colors: string[];
    materials: string | null;
    category: string | null;
  };
  brand: {
    id: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    /** Up to 10, shown on all the brand's products (Figma 13). */
    brand_stories?: (BrandStory & { position: number })[];
  };
  attribution: {
    type: 'retailer' | 'peer';
    name: string;
    peerPointsMessage?: string;
    scannedAt?: string;
  };
  scanData: {
    sample_id?: string;
    product_id: string;
    source_type: 'retailer' | 'peer';
    source_retailer_id?: string;
    source_user_id?: string;
  };
  /** When false, the view is in-app browsing and records no scan. */
  recordScan?: boolean;
};

export default function ProductPageClient({ product, brand, attribution, scanData, recordScan = true }: ProductPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [currentImage, setCurrentImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(product.sizes?.length === 1 ? product.sizes[0] : null);
  const [selectedColor, setSelectedColor] = useState<string | null>(product.colors?.length === 1 ? product.colors[0] : null);
  const [selectionError, setSelectionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const stories = [...(brand.brand_stories ?? [])].sort((a, b) => a.position - b.position);
  const scanRecorded = useRef(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Mark component as hydrated so we know JS is running
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Record the scan (skip for in-app browsing, which isn't a scan).
  // Wait for auth to resolve first, otherwise the scan is saved as anonymous
  // (no scanner_user_id) and never shows up in the user's discoveries.
  useEffect(() => {
    if (!recordScan) return;
    if (authLoading) return;
    if (scanRecorded.current) return;
    scanRecorded.current = true;

    fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...scanData,
        scanner_user_id: user?.id || null,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setScanId(data.id);
      })
      .catch(() => {})
      .finally(() => {
        // Back from signup after tapping Buy (?then=basket): the scan is now
        // recorded with the new account, so continue to the basket.
        if (user && new URLSearchParams(window.location.search).get('then') === 'basket') {
          router.replace('/consumer/basket');
        }
      });
  }, [scanData, user?.id, authLoading, recordScan]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    if (!carouselRef.current) return;
    const el = carouselRef.current;
    const index = Math.round(el.scrollLeft / el.offsetWidth);
    setCurrentImage(index);
  }

  // Build the Buy URL — works as an href for <a> tag (pre-hydration)
  // and also used by the JS-enhanced click handler
  const checkoutPath = `/consumer/checkout/${product.id}${scanId ? `?scan=${scanId}` : ''}`;
  const signupPath = `/auth/signup?role=consumer&redirect=${encodeURIComponent(checkoutPath)}`;
  const buyHref = user ? checkoutPath : signupPath;

  // Scanned → Scan tab is active; opened in-app (Saved / History) → Profile.
  const tabs = consumerTabs(recordScan ? { scanMatch: ['/p', '/d'] } : { profileMatch: ['/d'] });

  async function handleSave() {
    if (!user) {
      window.location.href = `/auth/signup?role=consumer&redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    // A save records the size the shopper wants (it shows the brand which
    // sizes to produce), so ask for one first, like Buy.
    if (product.sizes?.length > 1 && !selectedSize) {
      setSelectionError('Pick a size to save');
      return;
    }
    setSelectionError('');

    setSaving(true);
    try {
      const res = await fetch('/api/saved-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, size: selectedSize }),
      });
      if (res.ok) setSaved(true);
    } catch {
      // silently fail
    }
    setSaving(false);
  }

  async function handleShare() {
    const url = window.location.href;

    // Try native share (works on mobile HTTPS)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${product.name} — Flaym`, url });
        return;
      } catch {
        // user cancelled or not supported — fall through
      }
    }

    // Try clipboard API
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
        return;
      } catch {
        // blocked on HTTP — fall through
      }
    }

    // Last resort: hidden textarea + execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      // Absolute last resort: prompt the user to copy manually
      window.prompt('Copy this link:', url);
    }
  }


  // Figma 04b: "Buy" adds to the basket (05) and opens it. Logged-out shoppers
  // keep the item (localStorage) through signup, which redirects to the basket.
  function handleBuyToBasket(e: React.MouseEvent) {
    if (!hydrated) return; // pre-hydration: the <a> falls back to direct checkout
    e.preventDefault();
    if (product.sizes?.length > 0 && !selectedSize) {
      setSelectionError('Pick a size first');
      return;
    }
    if (product.colors?.length > 0 && !selectedColor) {
      setSelectionError('Pick a colour first');
      return;
    }
    setSelectionError('');
    addToBasket({
      productId: product.id,
      name: product.name,
      brandId: brand.id,
      brandName: brand.name,
      priceOre: product.price_dkk,
      image: product.images?.[0] ?? null,
      size: selectedSize,
      color: selectedColor,
      foundVia: { type: attribution.type, name: attribution.name },
    });
    if (authLoading || !user) {
      // Come back to this product page first so the scan is recorded with the
      // new account (that's what attributes the sale), then on to the basket.
      const back = new URL(window.location.href);
      back.searchParams.set('then', 'basket');
      window.location.href = `/auth/signup?role=consumer&redirect=${encodeURIComponent(back.pathname + back.search)}`;
      return;
    }
    router.push('/consumer/basket');
  }

  const images = product.images?.length > 0 ? product.images : [];
  // Swatches only after hydration (CSS.supports is browser-only), and only if
  // the browser can paint every colour name.
  const swatches =
    hydrated && typeof CSS !== 'undefined' && (product.colors ?? []).every((c) => CSS.supports('color', c.toLowerCase()));
  const inApp = !recordScan; // opened from Saved / History rather than scanned

  return (
    <div className={cn('relative mx-auto min-h-screen max-w-lg bg-canvas-dark font-brand text-on-primary', user ? 'pb-16' : '')}>
      {/* Image carousel (Figma: 430px tall) */}
      <div className="relative h-[430px] bg-surface-dark">
        {images.length > 0 ? (
          <div ref={carouselRef} onScroll={handleScroll} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto">
            {images.map((src, i) => (
              <div key={i} className="relative h-full w-full flex-shrink-0 snap-center">
                <Image src={src} alt={`${product.name} ${i + 1}`} fill className="object-cover" sizes="(max-width: 512px) 100vw, 512px" priority={i === 0} />
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full bg-flaym-gradient" aria-hidden />
        )}

        {/* Back + share */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-14">
          <a
            href={user ? '/consumer/home' : '/'}
            aria-label="Back"
            onClick={(e) => {
              // Prefer going back in history (e.g. to Saved); fall back to the href.
              if (hydrated && typeof window !== 'undefined' && window.history.length > 1) {
                e.preventDefault();
                router.back();
              }
            }}
            className="grid h-9 w-9 place-items-center rounded-pill bg-primary/60 text-body text-on-primary"
          >
            ←
          </a>
          <button
            type="button"
            onClick={handleShare}
            disabled={!hydrated}
            aria-label="Share"
            className="grid h-9 w-9 place-items-center rounded-pill bg-primary/60 text-on-primary disabled:opacity-60"
          >
            {showCopied ? <LinkIcon className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Swipe nudge: only while there is more to swipe to */}
        {images.length > 1 && currentImage === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-[200px] flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-heading-lg leading-none text-on-primary">
              <span>‹</span>
              <span className="h-7 w-7 rounded-pill border-2 border-on-primary" />
              <span>›</span>
            </div>
            <span className="bg-primary/60 px-2.5 py-1.5 text-caption text-on-primary">Swipe for more</span>
          </div>
        )}

        {/* DPP / About (Figma 12) */}
        <Link
          href={`/d/${product.id}/about`}
          className="absolute bottom-3.5 left-5 bg-primary/60 px-2.5 py-1.5 text-label tracking-normal text-on-primary"
        >
          ‹ About
        </Link>

        {/* Brand stories (Figma 04b) */}
        {stories.length > 0 && (
          <button
            type="button"
            onClick={() => setStoriesOpen(true)}
            className="absolute bottom-3.5 right-5 bg-primary/60 px-2.5 py-1.5 text-label tracking-normal text-on-primary"
          >
            Brand stories ›
          </button>
        )}

        {/* Image position */}
        {images.length > 1 && currentImage > 0 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-pill transition-all', i === currentImage ? 'w-4 bg-on-primary' : 'w-1.5 bg-on-primary/40')} />
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="px-5 pb-36 pt-[18px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-label uppercase text-smoke">{brand.name}</p>
            <h1 className="mt-1.5 font-brand text-heading-lg font-normal uppercase text-on-primary">{product.name}</h1>
          </div>
          <span className="whitespace-nowrap text-title font-medium leading-tight">{formatDKK(product.price_dkk)}</span>
        </div>

        {/* Where you found it */}
        <p className="mt-4 text-caption text-ash">
          {attribution.type === 'retailer' ? (inApp ? 'Saved at ' : 'Found at ') : 'Passed on by '}
          <span className="text-accent">{attribution.name}</span>
          {attribution.scannedAt && <span className="text-smoke"> · {timeAgo(attribution.scannedAt)}</span>}
        </p>
        {attribution.type === 'retailer' && inApp && (
          <p className="text-caption text-ash">The store still gets its cut.</p>
        )}
        {attribution.type === 'peer' && attribution.peerPointsMessage && (
          <p className="text-caption text-ash">{attribution.peerPointsMessage}</p>
        )}

        {/* Sizes */}
        {product.sizes?.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
            {product.sizes.map((size) => {
              const on = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setSelectedSize(size);
                    setSelectionError('');
                    // A different size can be saved again.
                    if (size !== selectedSize) setSaved(false);
                  }}
                  className={cn(
                    'h-10 min-w-12 px-3 text-body transition-colors',
                    on ? 'bg-on-primary text-primary' : 'border border-char text-on-primary hover:border-on-primary'
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        )}

        {/* Colours: Figma swatches when every name is a CSS colour, otherwise
            text chips (brands write names like "Sort" that a browser can't paint). */}
        {product.colors?.length > 0 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Colour">
            {product.colors.map((color) => {
              const on = selectedColor === color;
              const pick = () => {
                setSelectedColor(color);
                setSelectionError('');
              };
              return swatches ? (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={color}
                  title={color}
                  onClick={pick}
                  // Colour names come from the brand's product data.
                  style={{ backgroundColor: color.toLowerCase() }}
                  className={cn('h-[22px] w-[22px] rounded-pill', on && 'border-2 border-on-primary')}
                />
              ) : (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={pick}
                  className={cn(
                    'h-8 px-3 text-caption transition-colors',
                    on ? 'bg-on-primary text-primary' : 'border border-char text-on-primary hover:border-on-primary'
                  )}
                >
                  {color}
                </button>
              );
            })}
            {swatches && (
              <span className="ml-1.5 text-caption text-ash">
                {selectedColor ?? product.colors[0]}
                {product.colors.length > 1 && ` · ${product.colors.length} colours`}
              </span>
            )}
          </div>
        )}

        {selectionError && <p className="mt-3 text-caption text-accent">{selectionError}</p>}

        {product.description && <p className="mt-5 text-caption text-ash">{product.description}</p>}
      </div>

      {/* "Copied" toast */}
      {showCopied && (
        <div className="fixed left-1/2 top-16 z-[60] -translate-x-1/2">
          <Toast message="Link copied" type="info" className="border-line-dark" />
        </div>
      )}

      {/* Buy + Save. Buy is an <a> so it still works before JS hydrates. */}
      <div className={cn('fixed inset-x-0 z-40 bg-canvas-dark', user ? 'bottom-16' : 'bottom-0 pb-[env(safe-area-inset-bottom)]')}>
        <div className="mx-auto flex max-w-lg gap-2.5 px-5 py-3">
          <a
            href={buyHref}
            onClick={handleBuyToBasket}
            className="flex h-[52px] flex-1 items-center justify-center bg-accent text-body-lg font-medium text-on-primary transition-colors hover:bg-accent/90"
          >
            Buy
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved || !hydrated}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 border border-char text-body-lg font-medium text-on-primary transition-colors hover:border-on-primary disabled:hover:border-char"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Logged-in shoppers get the app's tab bar, as in Figma 04b / 04c. */}
      {user && <BottomNav items={tabs} />}
      {storiesOpen && stories.length > 0 && (
        <BrandStoriesViewer stories={stories} brand={brand} onClose={() => setStoriesOpen(false)} />
      )}
    </div>
  );
}
