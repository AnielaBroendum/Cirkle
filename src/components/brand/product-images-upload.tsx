'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { fileReader } from '@/lib/media-probe';
import { PRODUCT_IMAGE_ACCEPT, PRODUCT_IMAGE_RULES, checkProductImage, fileType } from '@/lib/media-rules';
import { cn } from '@/components/ds';
import { useDragOrder } from './use-drag-order';

// Figma "Brand Portal / 04 Edit product" → Images. Up to 8, the first is the
// main image; drag to reorder. Each file is checked here before upload and
// again on the server (/api/product-images/verify) after it.

type Props = {
  brandId: string;
  value: string[];
  onChange: (urls: string[]) => void;
};

export function ProductImagesUpload({ brandId, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const { itemProps, move, over } = useDragOrder(value, onChange);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const free = PRODUCT_IMAGE_RULES.max - value.length;
    const picked = Array.from(files);
    const problems: string[] = [];
    if (picked.length > free) problems.push(`Up to ${PRODUCT_IMAGE_RULES.max} images. ${picked.length - free} not added.`);

    setUploading(Math.min(picked.length, free));
    setErrors([]);
    const supabase = createClient();
    const added: string[] = [];
    for (const file of picked.slice(0, free)) {
      const type = fileType(file);
      const check = await checkProductImage(fileReader(file), type);
      if (!check.ok) {
        problems.push(`${file.name}: ${check.error}`);
        continue;
      }
      const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${brandId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: type, upsert: false });
      if (error) {
        problems.push(`${file.name}: ${error.message}`);
        continue;
      }
      const res = await fetch('/api/product-images/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) problems.push(`${file.name}: ${data?.error ?? 'Upload failed.'}`);
      else added.push(data.url);
    }
    if (added.length) onChange([...value, ...added].slice(0, PRODUCT_IMAGE_RULES.max));
    setErrors(problems);
    setUploading(0);
    if (inputRef.current) inputRef.current.value = '';
  }

  const canAdd = value.length < PRODUCT_IMAGE_RULES.max;

  return (
    <div className="font-brand">
      <div className="grid grid-cols-3 gap-3">
        {value.map((url, i) => (
          <div
            key={url}
            {...itemProps(i)}
            className={cn(
              'group relative aspect-[3/4] cursor-grab overflow-hidden border bg-surface-muted active:cursor-grabbing',
              i === 0 && 'col-span-2 row-span-2',
              over === i ? 'border-accent' : 'border-line'
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={i === 0 ? 'Main image' : `Image ${i + 1}`} className="pointer-events-none h-full w-full object-cover" />
            {i === 0 && <span className="absolute bottom-1.5 left-2 text-label uppercase text-on-primary [text-shadow:0_0_6px_rgb(0_0_0/0.5)]">Main</span>}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label="Remove image"
              className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center bg-primary/70 text-on-primary hover:bg-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {/* Move buttons for touch and keyboard */}
            <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              {i > 0 && (
                <button type="button" onClick={() => move(i, i - 1)} aria-label="Move earlier" className="inline-flex h-6 w-6 items-center justify-center bg-primary/70 text-on-primary">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              )}
              {i < value.length - 1 && (
                <button type="button" onClick={() => move(i, i + 1)} aria-label="Move later" className="inline-flex h-6 w-6 items-center justify-center bg-primary/70 text-on-primary">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading > 0}
            className={cn(
              'flex aspect-[3/4] flex-col items-center justify-center gap-1.5 border border-dashed border-line bg-surface text-caption text-primary transition-colors hover:border-primary disabled:opacity-60',
              value.length === 0 && 'col-span-2 row-span-2'
            )}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {uploading ? `Checking ${uploading}…` : 'Add'}
          </button>
        )}
      </div>

      <p className="mt-3 text-caption text-slate">
        JPG, PNG or WebP · min. 1200 × 1600 px (3:4, portrait) · max 10 MB per image · up to 8 images. The first image is the main
        image in the app. Drag to change the order.
      </p>
      {errors.length > 0 && (
        <ul className="mt-2 space-y-1" role="alert">
          {errors.map((e) => (
            <li key={e} className="text-caption text-accent-strong">
              {e}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={PRODUCT_IMAGE_ACCEPT}
        multiple
        onChange={(e) => upload(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
