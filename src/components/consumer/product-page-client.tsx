'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Share2, ShoppingBag, MapPin, Users, ChevronLeft, Package, Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { formatDKK } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';

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
  };
  scanData: {
    sample_id?: string;
    product_id: string;
    source_type: 'retailer' | 'peer';
    source_retailer_id?: string;
    source_user_id?: string;
  };
};

export default function ProductPageClient({ product, brand, attribution, scanData }: ProductPageProps) {
  const { user, loading: authLoading } = useAuth();
  const [currentImage, setCurrentImage] = useState(0);
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

  // Record the scan
  useEffect(() => {
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
      window.prompt('Kopiér dette link:', url);
    }
  }

  const images = product.images?.length > 0 ? product.images : [];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-lg mx-auto flex items-center justify-between h-12 px-4">
          <Link href="/" className="p-1 -ml-1 text-gray-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="font-bold text-base text-cirkle-950">Cirkle</span>
          <div className="w-7" />
        </div>
      </header>

      {/* Image carousel */}
      {images.length > 0 ? (
        <div className="relative bg-gray-50">
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            <style>{`.carousel-hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            {images.map((src, i) => (
              <div key={i} className="w-full flex-shrink-0 snap-center aspect-[4/5] relative">
                <Image src={src} alt={`${product.name} ${i + 1}`} fill className="object-cover" sizes="100vw" priority={i === 0} />
              </div>
            ))}
          </div>
          {images.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentImage ? 'w-6 bg-cirkle-600' : 'w-1.5 bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-[4/5] bg-gray-100 flex items-center justify-center">
          <Package className="h-16 w-16 text-gray-300" />
        </div>
      )}

      {/* Product info */}
      <div className="max-w-lg mx-auto px-5 pt-5 pb-36">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-1">
          {brand.logo_url && (
            <Image src={brand.logo_url} alt={brand.name} width={20} height={20} className="rounded-full" />
          )}
          <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">{brand.name}</span>
        </div>

        {/* Name + Price */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>
          <span className="text-xl font-bold text-gray-900 whitespace-nowrap">{formatDKK(product.price_dkk)}</span>
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{product.description}</p>
        )}

        {/* Materials */}
        {product.materials && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Materials</h3>
            <p className="text-sm text-gray-700">{product.materials}</p>
          </div>
        )}

        {/* Available sizes */}
        {product.sizes?.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Sizes</h3>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <span key={size} className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg">
                  {size}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Available colors */}
        {product.colors?.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Colors</h3>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <span key={color} className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg">
                  {color}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Attribution */}
        <div className="flex items-center gap-2 py-3 px-4 bg-gray-50 rounded-xl mb-2">
          {attribution.type === 'retailer' ? (
            <MapPin className="h-4 w-4 text-cirkle-500 flex-shrink-0" />
          ) : (
            <Users className="h-4 w-4 text-cirkle-500 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-700">
              {attribution.type === 'retailer'
                ? `Scanned at ${attribution.name}`
                : `Shared by ${attribution.name}`}
            </p>
            {attribution.peerPointsMessage && (
              <p className="text-xs text-cirkle-600 mt-0.5">{attribution.peerPointsMessage}</p>
            )}
          </div>
        </div>
      </div>

      {/* "Copied" toast */}
      {showCopied && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-toast-in">
          <Check className="h-4 w-4 text-green-400" />
          Link copied!
        </div>
      )}

      {/* Fixed bottom CTAs — Buy is an <a> tag so it works before JS hydrates */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center gap-3">
          <a
            href={buyHref}
            onClick={handleBuyClick}
            className="flex-1 flex items-center justify-center gap-2 bg-cirkle-600 text-white font-semibold py-3.5 rounded-xl hover:bg-cirkle-700 active:bg-cirkle-800 transition no-underline"
          >
            <ShoppingBag className="h-4 w-4" />
            Buy now
          </a>
          <button
            onClick={handleSave}
            disabled={saving || saved || !hydrated}
            className={`flex items-center justify-center p-3.5 rounded-xl border transition ${
              saved
                ? 'bg-pink-50 border-pink-200 text-pink-500'
                : !hydrated
                ? 'border-gray-100 text-gray-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Heart className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} />
            )}
          </button>
          <button
            onClick={handleShare}
            disabled={!hydrated}
            className={`flex items-center justify-center p-3.5 rounded-xl border transition ${
              showCopied
                ? 'border-green-200 bg-green-50 text-green-600'
                : !hydrated
                ? 'border-gray-100 text-gray-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            {showCopied ? <LinkIcon className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
