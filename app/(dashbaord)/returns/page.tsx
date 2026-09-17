import { createClient } from '@/lib/supabase/server'
import { ReturnsView, type ReturnRecord } from './returns-view'

export default async function ReturnsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Returns & Reverse Sales</h1>
          <p className="mt-1 text-sm text-slate-500">
            Issue customer refunds, reverse sales, and automatically restock the immutable inventory ledger.
          </p>
        </div>
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-amber-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Authentication Required</h2>
              <p className="mt-1 text-sm text-amber-800">
                Please sign in to your RetailPilot account to view and process return records.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const { data, error } = await supabase
    .from('returns')
    .select(`
      id,
      return_number,
      status,
      reason,
      refund_amount,
      returned_at,
      sales (
        invoice_number
      ),
      customers (
        name
      )
    `)
    .order('returned_at', { ascending: false })

  if (error) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Returns & Reverse Sales</h1>
          <p className="mt-1 text-sm text-slate-500">
            Issue customer refunds, reverse sales, and automatically restock the immutable inventory ledger.
          </p>
        </div>

        <section
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-950 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Unable to Load Return Records</h2>
              <p className="mt-1 text-sm text-red-800">
                {error.message || 'There was a problem retrieving return records from the database.'}
              </p>
              {error.details && (
                <p className="text-xs text-red-700 mt-2 font-mono bg-red-100/50 p-2 rounded">
                  Details: {error.details}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    )
  }

  const returns = (data ?? []) as ReturnRecord[]

  return (
    <main className="w-full min-w-0 max-w-7xl mx-auto p-4 sm:p-6">
      <ReturnsView initialReturns={returns} />
    </main>
  )
}
