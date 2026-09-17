export default function ReportsLoading() {
  return (
    <main className="space-y-6 p-6 max-w-7xl mx-auto animate-pulse" aria-busy="true">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-48 rounded-md bg-slate-200" />
            <div className="h-5 w-20 rounded-full bg-slate-200" />
          </div>
          <div className="h-4 w-96 rounded-md bg-slate-200" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 rounded-lg bg-slate-200" />
          <div className="h-9 w-40 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* Summary KPI Cards Skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="h-3.5 w-28 rounded-md bg-slate-200 mb-2" />
            <div className="h-7 w-24 rounded-md bg-slate-200 mb-1" />
            <div className="h-3 w-32 rounded-md bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Search / Filter Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="h-10 flex-1 rounded-lg bg-slate-200" />
        <div className="h-10 w-44 rounded-lg bg-slate-200" />
      </div>

      {/* Reports Feed Skeleton */}
      <div className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="space-y-2">
                <div className="h-5 w-32 rounded-full bg-slate-200" />
                <div className="h-6 w-64 rounded-md bg-slate-200" />
              </div>
              <div className="h-4 w-40 rounded-md bg-slate-200" />
            </div>

            <div className="h-16 rounded-xl bg-slate-100" />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="rounded-xl bg-slate-50 p-3.5 space-y-2">
                  <div className="h-3 w-20 rounded-md bg-slate-200" />
                  <div className="h-6 w-28 rounded-md bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
