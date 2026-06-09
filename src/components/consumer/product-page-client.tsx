'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, Share2, ShoppingBag, MapPin, Users, ChevronLeft, Package, Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { formatDKK } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';

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
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const scanRecorded = useRef(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Mark component as hydrated so we know JS is running
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Record the scan (skip for in-app browsing, which isn't a scan).
  useEffect(() => {
    if (!recordScan) return;
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
      .catch(() => {});
  }, [scanData, user?.id]);

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

  function handleBuyClick(e: React.MouseEvent) {
    // If auth is still loading, let the link navigate to signup as fallback
    if (authLoading) return;

    // If we have a scanId from the JS-side scan recording, update the URL
    if (user && scanId) {
      e.preventDefault();
      window.location.href = `/consumer/checkout/${product.id}?scan=${scanId}`;
    }
    // Otherwise let the <a> tag navigate naturally
  }

  async function handleSave() {
    if (!user) {
      window.location.href = `/auth/signup?role=consumer&redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setSaving(true);
    try {
      await fetch('/api/saved-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, scan_id: scanId }),
      });
      setSaved(true);
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
        await navigator.share({ title: `${product.name} — Cirkle`, url });
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

  const images = product.images?.length > 0 ? product.images : [];

  return (
    <div className="relative mx-auto min-h-screen max-w-lg bg-espresso-bg text-espresso-cream">
      {/* Image carousel with overlaid chrome */}
      <div className="relative bg-espresso-surface">
        {images.length > 0 ? (
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          >
            {images.map((src, i) => (
              <div key={i} className="relative aspect-[4/5] w-full flex-shrink-0 snap-center">
                <Image src={src} alt={`${product.name} ${i + 1}`} fill className="object-cover" sizes="100vw" priority={i === 0} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex aspect-[4/5] items-center justify-center"
            style={{ background: 'linear-gradient(160deg,#E0915C 0%,#7a3f1f 70%,#2a1308 100%)' }}
          >
            <Package className="h-16 w-16 text-white/30" />
          </div>
        )}

        {/* Top glass controls */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-12">
          <a
            href={user ? '/consumer/home' : '/'}
            onClick={(e) => {
              // Prefer going back in history (e.g. to the feed); fall back to the href.
              if (hydrated && typeof window !== 'undefined' && window.history.length > 1) {
                e.preventDefault();
                router.back();
              }
            }}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-espresso-bg/50 text-white backdrop-blur transition active:scale-90"
          >
            <ChevronLeft className="h-5 w-5" />
          </a>
          <button
            onClick={handleShare}
            disabled={!hydrated}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-espresso-bg/50 text-white backdrop-blur transition active:scale-90 disabled:opacity-60"
          >
            {showCopied ? <LinkIcon className="h-[18px] w-[18px]" /> : <Share2 className="h-[18px] w-[18px]" />}
          </button>
        </div>

        {/* Scan attribution chip */}
        <div className="absolute bottom-7 left-5 right-5 flex items-center gap-2 self-start rounded-full border border-white/15 bg-espresso-bg/65 px-4 py-2.5 text-[11.5px] font-semibold text-espresso-cream backdrop-blur w-fit max-w-[calc(100%-2.5rem)]">
          {attribution.type === 'retailer' ? (
            <MapPin className="h-[14px] w-[14px] flex-none text-terracotta" />
          ) : (
            <Users className="h-[14px] w-[14px] flex-none text-terracotta" />
          )}
          <span className="truncate">
            {attribution.type === 'retailer'
              ? `Scanned at ${attribution.name}`
              : `Shared by ${attribution.name}`}
          </span>
          {attribution.scannedAt && (
            <span className="flex-none text-espresso-muted">· {timeAgo(attribution.scannedAt)}</span>
          )}
        </div>

        {/* Carousel dots */}
        {images.length > 1 && (
          <div className="absolute bottom-5 right-4 flex gap-1.5">
            {images.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === currentImage ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pulled-up sheet */}
      <div className="relative -mt-7 rounded-t-[28px] bg-espresso-bg px-5 pb-40 pt-6">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-espresso-line" />

        {/* Brand */}
        <div className="flex items-center gap-2">
          {brand.logo_url && (
            <Image src={brand.logo_url} alt={brand.name} width={20} height={20} className="rounded-full" />
          )}
          <span className="text-[10.5px] font-bold uppercase tracking-[2.2px] text-terracotta">{brand.name}</span>
        </div>

        {/* Name + Price */}
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="font-display text-[28px] italic leading-tight text-espresso-cream">{product.name}</h1>
          <span className="whitespace-nowrap text-[22px] font-bold text-espresso-cream">{formatDKK(product.price_dkk)}</span>
        </div>

        {/* Description */}
        {product.description && (
          <p className="mt-3.5 text-[13px] leading-relaxed text-espresso-muted">{product.description}</p>
        )}

        {/* Sizes */}
        {product.sizes?.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[1.8px] text-espresso-muted-2">Size</h3>
            <div className="flex flex-wrap gap-2.5">
              {product.sizes.map((size) => {
                const on = selectedSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[46px] rounded-[13px] border px-3.5 py-3 text-sm font-semibold transition active:scale-95 ${
                      on
                        ? 'border-espresso-cream bg-espresso-cream text-espresso-bg'
                        : 'border-espresso-line bg-espresso-surface text-espresso-cream'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Colors */}
        {product.colors?.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[1.8px] text-espresso-muted-2">Colour</h3>
            <div className="flex flex-wrap gap-2.5">
              {product.colors.map((color) => (
                <span key={color} className="rounded-[13px] border border-espresso-line bg-espresso-surface px-3.5 py-2.5 text-xs font-medium text-espresso-cream">
                  {color}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Materials */}
        {product.materials && (
          <div className="mt-5">
            <h3 className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[1.8px] text-espresso-muted-2">Materials</h3>
            <p className="text-[13px] text-espresso-muted">{product.materials}</p>
          </div>
        )}

        {/* Maker / attribution context */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-espresso-line bg-espresso-surface p-3.5">
          {brand.logo_url ? (
            <span className="relative h-11 w-11 flex-none overflow-hidden rounded-full border border-espresso-line bg-white">
              <Image src={brand.logo_url} alt={brand.name} fill className="object-cover" sizes="44px" />
            </span>
          ) : (
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full font-display text-lg italic text-white"
              style={{ background: 'linear-gradient(135deg,#E0915C,#8b4f1f)' }}>
              {brand.name?.[0] ?? 'C'}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-espresso-cream">{brand.name}</p>
            <p className="text-xs text-espresso-muted">
              {attribution.type === 'retailer'
                ? `Discovered at ${attribution.name} · ✦ Emerging maker`
                : `Shared by ${attribution.name}`}
            </p>
          </div>
        </div>

        {/* Why you found this */}
        <div className="mt-5">
          <h3 className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[1.8px] text-espresso-muted-2">Why you found this</h3>
          <p className="text-[13px] leading-relaxed text-espresso-muted">
            {attribution.type === 'retailer' ? (
              <>You scanned a sample at <span className="text-espresso-cream">{attribution.name}</span>. Buy within 90 days and they earn for the introduction — that&rsquo;s how Cirkle keeps small spaces thriving.</>
            ) : (
              attribution.peerPointsMessage || <>Shared by a friend. When you buy, they earn Cirkle Points.</>
            )}
          </p>
        </div>
      </div>

      {/* "Copied" toast */}
      {showCopied && (
        <div className="fixed left-1/2 top-16 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-espresso-cream px-4 py-2.5 text-sm font-semibold text-espresso-bg shadow-lg animate-toast-in">
          <Check className="h-4 w-4 text-sage" />
          Link copied!
        </div>
      )}

      {/* Fixed bottom CTAs — Buy is an <a> tag so it works before JS hydrates */}
      <div
        className="fixed inset-x-0 bottom-0 z-50"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'linear-gradient(rgba(26,15,8,0), #1A0F08 28%)',
        }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 pb-6 pt-4">
          <button
            onClick={handleSave}
            disabled={saving || saved || !hydrated}
            className={`grid h-14 w-14 flex-none place-items-center rounded-2xl border transition active:scale-90 ${
              saved
                ? 'border-terracotta bg-terracotta text-espresso-bg'
                : 'border-espresso-line bg-espresso-surface text-espresso-cream'
            }`}
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Heart className={`h-[22px] w-[22px] ${saved ? 'fill-current' : ''}`} />
            )}
          </button>
          <a
            href={buyHref}
            onClick={handleBuyClick}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-terracotta font-bold text-espresso-bg no-underline transition active:scale-[0.97]"
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            Buy now · {formatDKK(product.price_dkk)}
          </a>
        </div>
      </div>
    </div>
  );
}
