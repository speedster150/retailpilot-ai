export default function InventoryLoading() {
  return (
    <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 min-w-0">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-8 w-36 rounded-md bg-slate-200" />
            <div className="h-5 w-24 rounded-full bg-slate-200" />
          </div>
          <div className="h-4 w-full max-w-xs rounded-md bg-slate-200" />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="h-4 w-48 rounded-md bg-slate-200 hidden sm:block" />
          <div className="h-10 w-full sm:w-44 rounded-lg bg-slate-200 shrink-0" />
        </div>
      </div>

      {/* Summary KPI Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 min-w-0">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
            <div className="h-3.5 w-24 max-w-full rounded-md bg-slate-200 mb-2" />
            <div className="h-7 w-16 rounded-md bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Current Stock Section Skeleton */}
      <div className="w-full min-w-0 space-y-3">
        <div className="space-y-1.5">
          <div className="h-6 w-32 rounded-md bg-slate-200" />
          <div className="h-4 w-full max-w-xs rounded-md bg-slate-200" />
        </div>
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="h-4 w-full max-w-md rounded-md bg-slate-200" />
          </div>
          <div className="w-full overflow-x-auto">
            <div className="divide-y divide-slate-100 p-4 space-y-3 min-w-[600px]">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between pt-3 first:pt-0 gap-4">
                  <div className="h-4 w-36 rounded-md bg-slate-200 shrink-0" />
                  <div className="h-4 w-20 rounded-md bg-slate-200 shrink-0" />
                  <div className="h-4 w-24 rounded-md bg-slate-200 shrink-0" />
                  <div className="h-4 w-16 rounded-md bg-slate-200 shrink-0" />
                  <div className="h-5 w-20 rounded-full bg-slate-200 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Movement History Section Skeleton */}
      <div className="w-full min-w-0 space-y-3">
        <div className="space-y-1.5">
          <div className="h-6 w-40 rounded-md bg-slate-200" />
          <div className="h-4 w-full max-w-xs rounded-md bg-slate-200" />
        </div>
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="h-4 w-full max-w-md rounded-md bg-slate-200" />
          </div>
          <div className="w-full overflow-x-auto">
            <div className="divide-y divide-slate-100 p-4 space-y-3 min-w-[600px]">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between pt-3 first:pt-0 gap-4">
                  <div className="h-4 w-44 rounded-md bg-slate-200 shrink-0" />
                  <div className="h-5 w-24 rounded-full bg-slate-200 shrink-0" />
                  <div className="h-4 w-16 rounded-md bg-slate-200 shrink-0" />
                  <div className="h-4 w-28 rounded-md bg-slate-200 shrink-0" />
                  <div className="h-4 w-24 rounded-md bg-slate-200 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
