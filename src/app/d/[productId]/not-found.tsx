import Link from 'next/link';
import { Logo, buttonClasses } from '@/components/ds';

// Shown when a passed-on code points at a product that is no longer for sale.
export default function ProductNotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-canvas-dark px-5 font-brand text-on-primary">
      <div className="pt-[55px]">
        <Logo height={22} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="font-brand text-title uppercase tracking-[0.4px]">No longer available</p>
        <p className="mt-3 max-w-[280px] text-body text-ash">The brand has stopped selling this piece, or the link is wrong.</p>
        <Link href="/consumer/home" className={buttonClasses({ variant: 'accent', className: 'mt-8 w-full max-w-[280px]' })}>
          Scan a tag
        </Link>
      </div>
    </div>
  );
}
