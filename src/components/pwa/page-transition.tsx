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
        isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
      }`}
      style={{ transition: 'opacity 150ms ease-out, transform 150ms ease-out' }}
    >
      {children}
    </div>
  );
}
