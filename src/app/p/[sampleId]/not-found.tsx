import Link from 'next/link';
import { Logo, buttonClasses } from '@/components/ds';

// Shown when a scanned tag points at a sample that no longer exists.
export default function SampleNotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-canvas-dark px-5 font-brand text-on-primary">
      <div className="pt-[55px]">
        <Logo height={22} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="font-brand text-title uppercase tracking-[0.4px]">This tag has moved on</p>
        <p className="mt-3 max-w-[280px] text-body text-ash">
          The piece it belonged to isn&rsquo;t in this store any more. Ask the staff, or scan another tag.
        </p>
        <Link href="/consumer/home" className={buttonClasses({ variant: 'accent', className: 'mt-8 w-full max-w-[280px]' })}>
          Scan another tag
        </Link>
      </div>
    </div>
  );
}
