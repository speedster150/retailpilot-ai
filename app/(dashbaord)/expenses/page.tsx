import { createClient } from '@/lib/supabase/server'
import { ExpenseManagement, type Expense } from './expense-management'

export default async function ExpensesPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id,
      category,
      description,
      amount,
      expense_date,
      payment_method,
      status,
      stores (
        name,
        code
      )
    `)
    .order('expense_date', { ascending: false })

  if (error) {
    return (
      <main className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Operating Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track store operational disbursements, supplier freight, utilities, facility rents, and general retail overhead.
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
              <h2 className="font-semibold text-base">Unable to Load Expense Records</h2>
              <p className="mt-1 text-sm text-red-800">
                {error.message || 'There was a problem retrieving expense records from the database.'}
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

  const expenses = (data ?? []) as Expense[]

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <ExpenseManagement initialExpenses={expenses} />
    </main>
  )
}
