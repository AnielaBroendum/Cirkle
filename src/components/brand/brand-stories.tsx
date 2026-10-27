'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { fileReader } from '@/lib/media-probe';
import { STORY_ACCEPT, STORY_RULES, checkStory, fileType } from '@/lib/media-rules';
import { Button, Card, cn } from '@/components/ds';
import { moveItem, useDragOrder } from './use-drag-order';

// Figma "Brand Portal / 08 Account" → Brand stories. Up to 10, shown on all
// the brand's products in the app, in this order (drag to change it).
// Files are checked here before upload and again by /api/brand-stories.

type Story = {
  id: string;
  position: number;
  kind: 'video' | 'image';
  url: string;
  duration_seconds: number | null;
};

export function BrandStories({ brandId }: { brandId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function load() {
    const { data } = await createClient().from('brand_stories').select('id, position, kind, url, duration_seconds').eq('brand_id', brandId).order('position');
    setStories((data ?? []) as Story[]);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, [brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveOrder(next: Story[]) {
    const before = stories;
    setStories(next);
    const res = await fetch('/api/brand-stories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map((s) => s.id) }),
    });
    if (!res.ok) {
      setStories(before);
      setErrors(['Could not save the new order. Try again.']);
    }
  }
  const { itemProps, over } = useDragOrder(stories, saveOrder);

  async function remove(id: string) {
    setStories((s) => s.filter((x) => x.id !== id));
    const res = await fetch(`/api/brand-stories?id=${id}`, { method: 'DELETE' });
    if (!res.ok) setErrors(['Could not remove the story. Try again.']);
    await load();
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const free = STORY_RULES.maxStories - stories.length;
    const picked = Array.from(files);
    const problems: string[] = [];
    if (picked.length > free) problems.push(`Up to 10 stories. ${picked.length - free} not added.`);

    setUploading(true);
    setErrors([]);
    const supabase = createClient();
    for (const file of picked.slice(0, free)) {
      const type = fileType(file);
      const check = await checkStory(fileReader(file), type);
      if (!check.ok) {
        problems.push(`${file.name}: ${check.error}`);
        continue;
      }
      const ext = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'image/png': 'png' }[type] ?? 'jpg';
      const path = `${brandId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('brand-stories').upload(path, file, { contentType: type, upsert: false });
      if (error) {
        problems.push(`${file.name}: ${error.message}`);
        continue;
      }
      const res = await fetch('/api/brand-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) problems.push(`${file.name}: ${data?.error ?? 'Upload failed.'}`);
      else setStories((s) => [...s, data.story as Story]);
    }
    setErrors(problems);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  const canAdd = stories.length < STORY_RULES.maxStories;

  return (
    <Card padding="none" className="rounded-none p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">
            Brand stories <span className="ml-1.5 text-caption normal-case text-slate">{stories.length} / 10</span>
          </h2>
          <p className="mt-1 text-caption text-slate">Shown on all your products in the app. Up to 10 stories. Drag to change the order.</p>
        </div>
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={!canAdd || uploading} loading={uploading} leftIcon={<Plus className="h-4 w-4" />}>
          Upload story
        </Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ol className="flex flex-wrap gap-4">
          {stories.map((s, i) => (
            <li key={s.id} {...itemProps(i)} className="group cursor-grab active:cursor-grabbing">
              <div className={cn('relative h-40 w-[90px] overflow-hidden border bg-flaym-gradient', over === i ? 'border-accent' : 'border-line')}>
                {s.kind === 'video' ? (
                  <video src={`${s.url}#t=0.1`} muted playsInline preload="metadata" className="pointer-events-none h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.url} alt="" className="pointer-events-none h-full w-full object-cover" />
                )}
                <span className="absolute bottom-1.5 left-1.5 bg-primary/70 px-1.5 py-0.5 text-caption tabular-nums text-on-primary">
                  {s.kind === 'video' ? `0:${String(Math.round(s.duration_seconds ?? 0)).padStart(2, '0')}` : `${STORY_RULES.image.showSeconds} s`}
                </span>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  aria-label={`Remove story ${i + 1}`}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center bg-primary/70 text-on-primary hover:bg-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-caption text-slate">{i + 1}</span>
                <span className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                  {i > 0 && (
                    <button type="button" onClick={() => saveOrder(moveItem(stories, i, i - 1))} aria-label={`Move story ${i + 1} earlier`} className="text-slate hover:text-primary">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  {i < stories.length - 1 && (
                    <button type="button" onClick={() => saveOrder(moveItem(stories, i, i + 1))} aria-label={`Move story ${i + 1} later`} className="text-slate hover:text-primary">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </div>
            </li>
          ))}
          {loaded && canAdd && (
            <li>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex h-40 w-[90px] flex-col items-center justify-center gap-1 border border-dashed border-line text-caption text-primary hover:border-primary disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : '+ Upload'}
              </button>
            </li>
          )}
        </ol>

        <div className="self-start bg-surface-muted p-4 text-caption text-cinder">
          <p className="mb-2 text-label uppercase text-slate">File requirements</p>
          <ul className="space-y-1.5">
            <li>Video: MP4 or MOV (H.264), max 20 seconds, max 50 MB</li>
            <li>Image: JPG or PNG, max 10 MB, shown for 6 seconds</li>
            <li>Size: 1080 × 1920 px, portrait 9:16</li>
            <li>Keep text and logos away from the top and bottom 250 px, where the app shows the progress bar and buttons</li>
          </ul>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="mt-4 space-y-1" role="alert">
          {errors.map((e) => (
            <li key={e} className="text-caption text-accent-strong">
              {e}
            </li>
          ))}
        </ul>
      )}

      <input ref={inputRef} type="file" accept={STORY_ACCEPT} multiple onChange={(e) => upload(e.target.files)} className="hidden" />
    </Card>
  );
}
