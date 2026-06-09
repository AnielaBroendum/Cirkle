'use client';

import { AlertTriangle } from 'lucide-react';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      <div className="p-4 rounded-full bg-red-50 mb-6">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-gray-500 max-w-sm">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 bg-cirkle-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-cirkle-700 transition"
      >
        Try again
      </button>
    </div>
  );
}
