export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="animate-pulse bg-gray-100 rounded-lg h-9 w-9" />
          <div className="animate-pulse bg-gray-200 rounded h-7 w-20" />
          <div className="animate-pulse bg-gray-100 rounded h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="animate-pulse bg-gray-100 rounded-lg h-8 w-8" />
          <div className="flex-1 space-y-2">
            <div className="animate-pulse bg-gray-200 rounded h-4 w-3/4" />
            <div className="animate-pulse bg-gray-100 rounded h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="animate-pulse bg-gray-200 rounded-lg h-48 w-full" />
      <div className="space-y-2">
        <div className="animate-pulse bg-gray-200 rounded h-5 w-2/3" />
        <div className="animate-pulse bg-gray-100 rounded h-4 w-1/2" />
      </div>
    </div>
  );
}
