'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

// Figma "App / 13 Brand stories": full screen, one progress bar per story,
// images for 6 s, videos for their own length. Tap right for the next story,
// left for the previous one; swipe down (or ×, or Esc) to close.

export type BrandStory = { id: string; kind: 'video' | 'image'; url: string; duration_seconds: number | null };

const IMAGE_MS = 6000;

export function BrandStoriesViewer({
  stories,
  brand,
  onClose,
}: {
  stories: BrandStory[];
  brand: { name: string; logo_url: string | null };
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0–1 of the current story
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchY = useRef<number | null>(null);
  const story = stories[index];

  const next = () => (index < stories.length - 1 ? (setIndex(index + 1), setProgress(0)) : onClose());
  const prev = () => (index > 0 ? (setIndex(index - 1), setProgress(0)) : setProgress(0));

  // Images: a 6-second timer. Videos report their own progress (onTimeUpdate).
  useEffect(() => {
    if (story.kind !== 'image') return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const p = (now - start) / IMAGE_MS;
      if (p >= 1) return next();
      setProgress(p);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${brand.name} stories`}
      className="fixed inset-0 z-50 mx-auto max-w-lg bg-canvas-dark font-brand text-on-primary"
      onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (touchY.current !== null && e.changedTouches[0].clientY - touchY.current > 80) onClose();
        touchY.current = null;
      }}
    >
      {story.kind === 'video' ? (
        <video
          key={story.id}
          ref={videoRef}
          src={story.url}
          autoPlay
          playsInline
          muted
          onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
          onEnded={next}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={story.id} src={story.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}

      {/* Tap zones */}
      <button type="button" aria-label="Previous story" onClick={prev} className="absolute inset-y-0 left-0 w-1/3" />
      <button type="button" aria-label="Next story" onClick={next} className="absolute inset-y-0 right-0 w-2/3" />

      {/* Progress + header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-primary/60 to-transparent px-5 pb-8 pt-12">
        <div className="flex gap-1">
          {stories.map((s, i) => (
            <span key={s.id} className="h-0.5 flex-1 overflow-hidden bg-on-primary/30">
              <span
                className="block h-full bg-on-primary"
                style={{ width: `${i < index ? 100 : i === index ? Math.min(100, progress * 100) : 0}%` }}
              />
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="h-8 w-8 overflow-hidden rounded-pill bg-ash">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {brand.logo_url && <img src={brand.logo_url} alt="" className="h-full w-full object-cover" />}
          </span>
          <span className="text-body">{brand.name}</span>
          <span className="text-caption text-ash">
            {index + 1} / {stories.length}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close stories"
        className="absolute right-4 top-[60px] inline-flex h-9 w-9 items-center justify-center text-on-primary"
      >
        <X className="h-5 w-5" />
      </button>

      <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/70 to-transparent pb-8 pt-16 text-center text-caption text-ash">
        Tap to skip · swipe down to close
      </p>
    </div>
  );
}
