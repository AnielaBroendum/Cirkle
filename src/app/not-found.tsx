import Link from 'next/link';
import { Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      <div className="p-4 rounded-full bg-gray-100 mb-6">
        <Search className="h-8 w-8 text-gray-400" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 text-gray-500 max-w-sm">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 bg-cirkle-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-cirkle-700 transition"
      >
        Go to homepage
      </Link>
    </div>
  );
}
