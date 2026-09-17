import { createClient } from '@/lib/supabase/server'
import CustomerManagement, { type Customer, type CustomerSalesSummary } from './customer-management'

export default async function CustomersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage customer directories, loyalty point balances, and purchase activity.
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
                Please sign in to your RetailPilot account to view customer records.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const [customersResult, salesResult] = await Promise.all([
    supabase
      .from('customers')
      .select(`
        id,
        name,
        phone,
        email,
        address,
        loyalty_points,
        is_active,
        created_at
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('sales')
      .select('id, customer_id, total_amount, status'),
  ])

  if (customersResult.error) {
    return (
      <main className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage customer directories, loyalty point balances, and purchase activity.
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
              <h2 className="font-semibold text-base">Unable to Load Customer Records</h2>
              <p className="mt-1 text-sm text-red-800">
                There was a problem retrieving customer accounts from the database.
                Please check your connection and try refreshing the page.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const customers = (customersResult.data ?? []) as Customer[]
  const sales = (salesResult.data ?? []) as CustomerSalesSummary[]

  return <CustomerManagement customers={customers} sales={sales} />
}
