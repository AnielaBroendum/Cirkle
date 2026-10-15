'use client';

import { useRouter } from 'next/navigation';

/** Figma "←" back link: goes back in history, or to `fallbackHref` on a fresh tab. */
export default function BackButton({ fallbackHref, className }: { fallbackHref: string; className?: string }) {
  const router = useRouter();
  return (
    <a
      href={fallbackHref}
      aria-label="Back"
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className={className ?? 'text-[16px] leading-none text-on-primary'}
    >
      ←
    </a>
  );
}
