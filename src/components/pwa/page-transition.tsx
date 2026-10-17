'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    const timeout = setTimeout(() => setIsTransitioning(false), 20);
    return () => clearTimeout(timeout);
  }, [pathname]);

  return (
    <div
      className={`transition-opacity duration-150 ease-out ${
        // No transform at rest: a transform would make fixed children (bottom
        // action bars) position against this wrapper instead of the viewport.
        isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100'
      }`}
      style={{ transition: 'opacity 150ms ease-out, transform 150ms ease-out' }}
    >
      {children}
    </div>
  );
}
