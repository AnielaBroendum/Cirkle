import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-cirkle-950">
          Cirkle
        </h1>
        <p className="text-xl text-gray-600">
          Discover and buy fashion — in stores and from friends.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href="/auth/signup?role=brand"
            className="px-8 py-3 bg-cirkle-600 text-white rounded-lg font-medium hover:bg-cirkle-700 transition"
          >
            I'm a Brand
          </Link>
          <Link
            href="/auth/signup?role=retailer"
            className="px-8 py-3 bg-cirkle-100 text-cirkle-700 rounded-lg font-medium hover:bg-cirkle-200 transition"
          >
            I'm a Retailer
          </Link>
          <Link
            href="/auth/signup?role=consumer"
            className="px-8 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
          >
            I'm Shopping
          </Link>
        </div>

        <p className="text-sm text-gray-400 pt-8">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-cirkle-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
