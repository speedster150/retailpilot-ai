export default function CustomersLoading() {
  return (
    <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6 animate-pulse" aria-busy="true">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-8 w-40 rounded-md bg-slate-200" />
            <div className="h-5 w-24 rounded-full bg-slate-200" />
          </div>
          <div className="h-4 w-full max-w-xs sm:max-w-sm rounded-md bg-slate-200" />
        </div>
        <div className="h-10 w-full sm:w-44 rounded-lg bg-slate-200 shrink-0" />
      </div>

      {/* Summary KPI Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 min-w-0">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
            <div className="h-3.5 w-20 rounded-md bg-slate-200 mb-2" />
            <div className="h-7 w-16 rounded-md bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Search / Filter Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 w-full min-w-0">
        <div className="h-10 flex-1 min-w-0 rounded-lg bg-slate-200" />
        <div className="h-10 w-full sm:w-36 rounded-lg bg-slate-200 shrink-0" />
        <div className="h-10 w-full sm:w-36 rounded-lg bg-slate-200 shrink-0" />
      </div>

      {/* Table Skeleton */}
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[650px] p-4 space-y-3">
            <div className="border-b border-slate-200 pb-3">
              <div className="h-4 w-full rounded-md bg-slate-200" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between pt-3 first:pt-0">
                <div className="h-4 w-36 rounded-md bg-slate-200" />
                <div className="h-4 w-32 rounded-md bg-slate-200" />
                <div className="h-5 w-24 rounded-full bg-slate-200" />
                <div className="h-4 w-28 rounded-md bg-slate-200" />
                <div className="h-4 w-24 rounded-md bg-slate-200" />
                <div className="h-5 w-16 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
