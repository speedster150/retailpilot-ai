export default function SalesLoading() {
  return (
    <main className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto animate-pulse" aria-busy="true">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-48 rounded-md bg-slate-200" />
            <div className="h-5 w-28 rounded-full bg-slate-200" />
          </div>
          <div className="h-4 w-72 rounded-md bg-slate-200" />
        </div>
        <div className="h-10 w-64 rounded-lg bg-slate-200" />
      </div>

      {/* POS Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Product Catalog (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Store & Customer Selectors Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="h-10 rounded-lg bg-slate-200" />
            <div className="h-10 rounded-lg bg-slate-200" />
          </div>

          {/* Search & Category Pills Skeleton */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="h-10 rounded-lg bg-slate-200" />
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-7 w-20 rounded-full bg-slate-200" />
              ))}
            </div>
          </div>

          {/* Product Cards Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2">
                <div className="h-4 w-3/4 rounded-md bg-slate-200" />
                <div className="h-3 w-1/2 rounded-md bg-slate-200" />
                <div className="h-4 w-1/3 rounded-md bg-slate-200 pt-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cart & Checkout (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="h-6 w-20 rounded-md bg-slate-200" />
            <div className="h-4 w-14 rounded-md bg-slate-200" />
          </div>

          {/* Cart items skeleton */}
          <div className="space-y-3 py-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-100" />
            ))}
          </div>

          {/* Financial summary skeleton */}
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="h-4 w-full rounded-md bg-slate-200" />
            <div className="h-4 w-full rounded-md bg-slate-200" />
            <div className="h-6 w-full rounded-md bg-slate-200" />
          </div>

          {/* Payment buttons skeleton */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-slate-200" />
            ))}
          </div>

          {/* Checkout button skeleton */}
          <div className="h-12 w-full rounded-xl bg-slate-200" />
        </div>
      </div>
    </main>
  )
}
