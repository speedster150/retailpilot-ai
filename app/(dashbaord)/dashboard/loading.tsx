export default function DashboardLoading() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-label="Loading Dashboard">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-4 w-96 rounded-md bg-gray-100 animate-pulse" />
        </div>
        <div className="flex gap-2.5">
          <div className="h-9 w-28 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs animate-pulse space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-8 w-8 rounded-lg bg-gray-100" />
            </div>
            <div className="h-7 w-32 rounded bg-gray-200" />
            <div className="h-3 w-40 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Tables Section Skeleton */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4 animate-pulse">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-100" />
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div className="space-y-1.5">
                  <div className="h-4 w-28 rounded bg-gray-200" />
                  <div className="h-3 w-20 rounded bg-gray-100" />
                </div>
                <div className="h-4 w-16 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4 animate-pulse">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="h-5 w-36 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-100" />
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-gray-200" />
                  <div className="h-3 w-24 rounded bg-gray-100" />
                </div>
                <div className="h-4 w-14 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
