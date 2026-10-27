'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ds';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center font-brand">
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center bg-surface-muted">
        <AlertTriangle className="h-7 w-7 text-accent" />
      </div>
      <h1 className="font-brand text-heading-xl uppercase text-primary">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-body text-slate">
        An unexpected error occurred. Please try again.
      </p>
      <Button variant="accent" onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
