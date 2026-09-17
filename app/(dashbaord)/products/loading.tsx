export default function ProductsLoading() {
  return (
    <main className="space-y-8 p-6" aria-busy="true" aria-label="Loading Products">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200/80 pb-5 animate-pulse">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-44 rounded-lg bg-gray-200" />
            <div className="h-6 w-20 rounded-full bg-gray-100" />
          </div>
          <div className="h-4 w-96 rounded-md bg-gray-100" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-gray-200" />
      </div>

      {/* Search & Catalogue Section Skeleton */}
      <div className="space-y-4 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-6 w-36 rounded bg-gray-200" />
            <div className="h-4 w-48 rounded bg-gray-100" />
          </div>
          <div className="h-10 w-full sm:w-80 rounded-lg bg-gray-100" />
        </div>

        {/* Table Skeleton */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs">
          <div className="h-11 bg-gray-50 border-b border-gray-100" />
          <div className="divide-y divide-gray-100 p-4 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex justify-between items-center pt-3 first:pt-0">
                <div className="space-y-1.5 w-1/4">
                  <div className="h-4 w-32 rounded bg-gray-200" />
                  <div className="h-3 w-20 rounded bg-gray-100" />
                </div>
                <div className="h-4 w-24 rounded bg-gray-100" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-16 rounded bg-gray-200" />
                <div className="h-6 w-16 rounded-full bg-gray-100" />
                <div className="h-4 w-20 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Supplier Links Skeleton */}
      <div className="pt-6 border-t border-gray-200 space-y-4 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="space-y-1.5">
            <div className="h-6 w-40 rounded bg-gray-200" />
            <div className="h-4 w-52 rounded bg-gray-100" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-gray-200" />
        </div>
        <div className="h-48 rounded-xl border border-gray-200 bg-white" />
      </div>
    </main>
  )
}
