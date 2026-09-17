export default function ExpensesLoading() {
  return (
    <main className="space-y-6 p-6 max-w-7xl mx-auto animate-pulse" aria-busy="true">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-44 rounded-md bg-slate-200" />
            <div className="h-5 w-20 rounded-full bg-slate-200" />
          </div>
          <div className="h-4 w-96 rounded-md bg-slate-200" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-slate-200" />
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
      <div className="flex flex-col lg:flex-row gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="h-10 flex-1 rounded-lg bg-slate-200" />
        <div className="h-10 w-36 rounded-lg bg-slate-200" />
        <div className="h-10 w-32 rounded-lg bg-slate-200" />
        <div className="h-10 w-36 rounded-lg bg-slate-200" />
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
          <div className="h-4 w-full rounded-md bg-slate-200" />
        </div>
        <div className="divide-y divide-slate-100 p-5 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between pt-3 first:pt-0">
              <div className="h-5 w-24 rounded-full bg-slate-200" />
              <div className="h-4 w-48 rounded-md bg-slate-200" />
              <div className="h-4 w-28 rounded-md bg-slate-200" />
              <div className="h-5 w-20 rounded-md bg-slate-200" />
              <div className="h-4 w-24 rounded-md bg-slate-200" />
              <div className="h-5 w-16 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
