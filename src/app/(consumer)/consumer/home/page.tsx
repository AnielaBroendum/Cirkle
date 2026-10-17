'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Logo, buttonClasses, cn } from '@/components/ds';
import { useQRScanner } from '@/components/consumer/qr-scanner';
import { useBasket } from '@/components/consumer/basket-store';

// Figma 03 "Scan (start screen)": the in-app camera only. Your scan history
// (the old Discoveries feed) now lives under Profile → History.

const CORNERS = [
  'left-0 top-0 border-l-4 border-t-4',
  'right-0 top-0 border-r-4 border-t-4',
  'bottom-0 left-0 border-b-4 border-l-4',
  'bottom-0 right-0 border-b-4 border-r-4',
];

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, notFlaym, retry, torchAvailable, torchOn, toggleTorch } = useQRScanner(videoRef);
  const basket = useBasket();
  const live = state === 'scanning';

  return (
    // Full-bleed under the tab bar: 100dvh minus the 64px bar.
    <div className="relative h-[calc(100dvh-4rem)] min-h-[520px] overflow-hidden bg-flaym-scan">
      <video
        ref={videoRef}
        playsInline
        muted
        aria-hidden
        className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-300', live ? 'opacity-100' : 'opacity-0')}
      />

      {/* Top bar: logo · basket · torch */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-[55px]">
        <Logo height={22} />
        <div className="flex items-center gap-2.5">
          {basket.length > 0 && (
            <Link
              href="/consumer/basket"
              aria-label={`Basket, ${basket.length} ${basket.length === 1 ? 'item' : 'items'}`}
              className="relative grid h-[34px] w-[34px] place-items-center rounded-pill border border-on-primary text-on-primary"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-pill bg-accent px-1 text-[10px] leading-none text-on-primary">
                {basket.length}
              </span>
            </Link>
          )}
          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torchOn ? 'Turn off the light' : 'Turn on the light'}
              aria-pressed={torchOn}
              className={cn(
                'grid h-[34px] w-[34px] place-items-center rounded-pill border border-on-primary text-[13px]',
                torchOn ? 'bg-on-primary text-primary' : 'text-on-primary'
              )}
            >
              ϟ
            </button>
          )}
        </div>
      </div>

      {/* Viewfinder (Figma: 240×240, 44px Flaym-orange corners) */}
      <div className="absolute left-1/2 top-[44%] h-60 w-60 -translate-x-1/2 -translate-y-1/2" aria-hidden>
        {CORNERS.map((c) => (
          <span key={c} className={cn('absolute h-11 w-11 border-accent', c)} />
        ))}
      </div>

      {/* Hint / states */}
      <div className="absolute inset-x-0 top-[calc(44%+148px)] flex flex-col items-center px-8 text-center">
        {state === 'scanning' || state === 'starting' ? (
          <p role="status" className="bg-primary/70 px-4 py-2.5 text-body text-on-primary">
            {notFlaym ? 'That’s not a Flaym tag' : state === 'starting' ? 'Starting camera…' : 'Point at a Flaym tag'}
          </p>
        ) : (
          <div className="bg-primary/80 px-5 py-4" role="alert">
            <p className="text-body text-on-primary">
              {state === 'denied'
                ? 'Flaym needs your camera to scan tags.'
                : state === 'unsupported'
                  ? 'No camera found on this device.'
                  : 'The camera didn’t start.'}
            </p>
            <p className="mt-1.5 text-caption text-line">
              {state === 'denied'
                ? 'Allow camera access in your browser settings, or scan the tag with your phone’s camera app.'
                : 'You can also scan the tag with your phone’s camera app.'}
            </p>
            {state !== 'unsupported' && (
              <button type="button" onClick={retry} className={buttonClasses({ variant: 'accent', size: 'sm', className: 'mt-4' })}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
