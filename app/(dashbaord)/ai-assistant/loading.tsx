export default function AIAssistantLoading() {
  return (
    <main className="space-y-6 p-6 max-w-7xl mx-auto animate-pulse" aria-busy="true" aria-label="Loading RetailPilot Copilot">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-48 rounded-md bg-slate-200" />
            <div className="h-5 w-24 rounded-full bg-slate-200" />
          </div>
          <div className="h-4 w-96 rounded-md bg-slate-200" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-48 rounded-full bg-slate-200" />
        </div>
      </div>

      {/* Copilot Chat Container Skeleton */}
      <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[580px] rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Chat Header Skeleton */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-4 w-36 rounded-md bg-slate-200" />
              <div className="h-3 w-48 rounded-md bg-slate-200" />
            </div>
          </div>
          <div className="h-6 w-24 rounded-full bg-slate-200" />
        </div>

        {/* Message Feed Skeleton */}
        <div className="flex-1 p-6 space-y-4 bg-slate-50/40">
          <div className="flex items-start gap-3 max-w-2xl">
            <div className="h-8 w-8 rounded-full bg-slate-200 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-1/3 rounded-md bg-slate-200" />
              <div className="h-16 rounded-xl bg-slate-200" />
            </div>
          </div>
        </div>

        {/* Suggested Prompts Skeleton */}
        <div className="border-t border-slate-100 bg-white px-6 py-3 flex gap-2">
          <div className="h-6 w-20 rounded-full bg-slate-200" />
          <div className="h-6 w-32 rounded-full bg-slate-200" />
          <div className="h-6 w-28 rounded-full bg-slate-200" />
        </div>

        {/* Prompt Input Skeleton */}
        <div className="border-t border-slate-200 bg-white p-4 flex gap-3">
          <div className="h-12 flex-1 rounded-xl bg-slate-200" />
          <div className="h-12 w-28 rounded-xl bg-slate-200" />
        </div>
      </div>
    </main>
  )
}
