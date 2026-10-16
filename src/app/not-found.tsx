import Link from 'next/link';
import { Search } from 'lucide-react';
import { buttonClasses } from '@/components/ds';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center font-brand">
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center bg-surface-muted">
        <Search className="h-7 w-7 text-muted" />
      </div>
      <h1 className="font-brand text-heading-xl uppercase text-primary">Page not found</h1>
      <p className="mt-2 max-w-sm text-body text-muted">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link href="/" className={buttonClasses({ variant: 'accent', className: 'mt-6' })}>
        Go to homepage
      </Link>
    </div>
  );
}
