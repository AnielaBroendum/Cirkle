'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ds';

// Print sheet for QR tags (Brand Portal 05 and Retail Portal 03).
// Each tag is 50 × 70 mm, nine to an A4 page, with a dashed cut line.
// The QR is the sample's stored image: the same code as before, never a new one.

type Tag = { sample_id: string; qr_code_url: string; product: string; brand: string; store: string };

export default function PrintTagsPage() {
  return (
    <Suspense fallback={null}>
      <PrintTags />
    </Suspense>
  );
}

function PrintTags() {
  const params = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const portal = params.get('portal') === 'retail' ? 'retail' : 'brand';
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [error, setError] = useState('');
  const requested = useRef(false);

  useEffect(() => {
    // Once per page load: every request logs a print.
    if (requested.current) return;
    requested.current = true;
    fetch('/api/tag-prints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample_ids: ids, portal }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) setError(data?.error ?? 'Could not load the tags.');
        else setTags(data.tags);
      })
      .catch(() => setError('Could not load the tags.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open the print dialog once every QR image has loaded.
  useEffect(() => {
    if (!tags?.length) return;
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('img[data-qr]'));
    Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => (img.onload = img.onerror = r))))).then(() =>
      window.print()
    );
  }, [tags]);

  return (
    <div className="min-h-screen bg-canvas font-brand text-primary">
      <style>{'@page { size: A4 portrait; margin: 10mm; }'}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4 print:hidden">
        <div>
          <h1 className="text-heading-lg uppercase">Print QR tags</h1>
          <p className="text-caption text-slate">
            {tags ? `${tags.length} tag${tags.length !== 1 ? 's' : ''} · 50 × 70 mm · print at 100% scale, then cut along the dashed lines` : 'Loading…'}
          </p>
        </div>
        {tags && <Button onClick={() => window.print()}>Print</Button>}
      </div>

      {error && <p className="px-6 py-8 text-body text-accent-strong">{error}</p>}

      {tags && (
        <div className="grid grid-cols-[repeat(auto-fill,50mm)] gap-[5mm] p-6 print:grid-cols-[repeat(3,50mm)] print:p-0">
          {tags.map((t) => (
            <div
              key={t.sample_id}
              className="flex h-[70mm] w-[50mm] break-inside-avoid flex-col items-center border border-dashed border-ash px-[3mm] pb-[3mm] pt-[4mm] text-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/flaym-logo-white.svg" alt="flaym" className="h-[5mm] w-auto invert" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-qr src={t.qr_code_url} alt={`QR code for ${t.product}`} className="mt-[1.5mm] h-[36mm] w-[36mm]" />
              <p className="mt-[1.5mm] text-label uppercase">Scan to shop</p>
              <p className="mt-[1.5mm] line-clamp-2 text-caption font-medium leading-tight">{t.product}</p>
              <p className="mt-auto line-clamp-1 text-caption leading-tight text-slate">{t.brand}</p>
              <p className="line-clamp-1 text-caption leading-tight text-slate">{t.store}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
