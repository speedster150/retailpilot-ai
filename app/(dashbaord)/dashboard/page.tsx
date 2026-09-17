import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type Sale = {
  id: string
  invoice_number: string | null
  sale_date: string | null
  total_amount: number | string | null
  status: string | null
}

type SaleItem = {
  sale_id: string | null
  quantity: number | string | null
}

type Payment = {
  sale_id: string | null
  amount: number | string | null
  payment_method: string | null
  payment_status: string | null
}

type Refund = {
  refund_amount: number | string | null
}

type Expense = {
  amount: number | string | null
}

type InventoryMovement = {
  id: string
  movement_type: string | null
  quantity: number | string | null
  created_at: string | null
  products:
    | {
        name: string | null
        sku: string | null
      }[]
    | null
    | undefined
  stores:
    | {
        name: string | null
        code: string | null
      }[]
    | null
    | undefined
}

type RecentSale = Sale & {
  itemCount: number
  payment: Payment | undefined
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number) {
  return value.toLocaleString('en-IN')
}

function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function formatStatus(value: string | null) {
  if (!value) {
    return 'Completed'
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

function formatLabel(value: string | null) {
  if (!value) {
    return '—'
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function movementDelta(movement: InventoryMovement) {
  const quantity = toNumber(movement.quantity)
  const type = movement.movement_type?.toLowerCase() ?? ''
  const isOutbound = ['out', 'sale', 'sold', 'decrease', 'remove'].some(
    (keyword) => type.includes(keyword)
  )

  return isOutbound ? -quantity : quantity
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    salesResult,
    saleItemsResult,
    paymentsResult,
    refundsResult,
    expensesResult,
    productsResult,
    customersResult,
    inventoryResult,
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('id, invoice_number, sale_date, total_amount, status')
      .order('sale_date', { ascending: false }),
    supabase.from('sale_items').select('sale_id, quantity'),
    supabase
      .from('payments')
      .select('sale_id, amount, payment_method, payment_status'),
    supabase.from('returns').select('refund_amount'),
    supabase.from('expenses').select('amount'),
    supabase.from('products').select('id'),
    supabase.from('customers').select('id'),
    supabase
      .from('inventory_ledger')
      .select(`
        id,
        movement_type,
        quantity,
        created_at,
        products (
          name,
          sku
        ),
        stores (
          name,
          code
        )
      `)
      .order('created_at', { ascending: false }),
  ])

  const queryError = [
    salesResult.error,
    saleItemsResult.error,
    paymentsResult.error,
    refundsResult.error,
    expensesResult.error,
    productsResult.error,
    customersResult.error,
    inventoryResult.error,
  ].find(Boolean)

  if (queryError) {
    return (
      <main className="space-y-6 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            RetailPilot AI Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Monitor sales, inventory, customers, and business performance.
          </p>
        </div>

        <section
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-900 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-red-600 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <div>
              <h2 className="font-semibold text-red-900">Unable to load dashboard data</h2>
              <p className="mt-1 text-sm text-red-700">
                There was a problem retrieving one or more dashboard metrics from the database.
              </p>
              {queryError.message && (
                <p className="mt-2 text-xs font-mono text-red-600 bg-red-100/60 p-2 rounded">
                  {queryError.message}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    )
  }

  const sales = (salesResult.data ?? []) as Sale[]
  const saleItems = (saleItemsResult.data ?? []) as SaleItem[]
  const payments = (paymentsResult.data ?? []) as Payment[]
  const refunds = (refundsResult.data ?? []) as Refund[]
  const expenses = (expensesResult.data ?? []) as Expense[]
  const products = productsResult.data ?? []
  const customers = customersResult.data ?? []
  const inventoryMovements = (inventoryResult.data ?? []) as InventoryMovement[]

  const itemCounts = new Map<string, number>()
  for (const item of saleItems) {
    if (item.sale_id) {
      itemCounts.set(
        item.sale_id,
        (itemCounts.get(item.sale_id) ?? 0) + toNumber(item.quantity)
      )
    }
  }

  const paymentsBySale = new Map<string, Payment>()
  for (const payment of payments) {
    if (payment.sale_id && !paymentsBySale.has(payment.sale_id)) {
      paymentsBySale.set(payment.sale_id, payment)
    }
  }

  const recentSales: RecentSale[] = sales.slice(0, 5).map((sale) => ({
    ...sale,
    itemCount: itemCounts.get(sale.id) ?? 0,
    payment: paymentsBySale.get(sale.id),
  }))

  const totalSales = sales.reduce(
    (total, sale) => total + toNumber(sale.total_amount),
    0
  )
  const totalRefunds = refunds.reduce(
    (total, refund) => total + toNumber(refund.refund_amount),
    0
  )
  const totalExpenses = expenses.reduce(
    (total, expense) => total + toNumber(expense.amount),
    0
  )
  const currentStockUnits = inventoryMovements.reduce(
    (total, movement) => total + movementDelta(movement),
    0
  )

  return (
    <main className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              RetailPilot AI Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Operations
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Monitor real-time sales, ledger-backed inventory, operational expenses, and customer activity.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/ai-assistant"
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-sm font-medium text-indigo-700 shadow-2xs hover:bg-indigo-100/70 transition focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          >
            <svg
              className="h-4 w-4 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Ask AI
          </Link>
          <Link
            href="/sales"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-gray-800 transition focus:outline-hidden focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            <svg
              className="h-4 w-4 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Sale / POS
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <section
        aria-label="Key performance indicators"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {/* Total Sales */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Revenue
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
              💰
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700">
            {formatCurrency(totalSales)}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Gross recorded transaction volume</p>
        </div>

        {/* Refunds */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Returns & Refunds
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-xs">
              ↩
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-rose-700">
            {formatCurrency(totalRefunds)}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Compensating customer refunds</p>
        </div>

        {/* Expenses */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Operating Expenses
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-xs">
              📊
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-amber-700">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Store overhead & supplier liabilities</p>
        </div>

        {/* Products */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Catalog Products
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs">
              📦
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {formatNumber(products.length)}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Active SKUs monitored in organization</p>
        </div>

        {/* Customers */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Customer Profiles
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs">
              👥
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {formatNumber(customers.length)}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Registered retail & loyalty accounts</p>
        </div>

        {/* Current Stock Units */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Stock In Hand
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700 border border-teal-100 text-xs">
              ⚡
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-teal-700">
            {formatNumber(currentStockUnits)}{' '}
            <span className="text-base font-medium text-slate-400">units</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Authoritative ledger-derived inventory</p>
        </div>
      </section>

      {/* Tables Section: Recent Sales & Inventory Activity */}
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Recent Sales Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent Sales</h2>
              <p className="text-xs text-slate-500">Latest completed point-of-sale transactions</p>
            </div>
            <Link
              href="/sales"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              Open POS &rarr;
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <div className="p-8 text-center">
              <svg
                className="mx-auto h-10 w-10 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="mt-2 text-sm font-medium text-slate-900">No sales recorded yet</p>
              <p className="mt-1 text-xs text-slate-500">
                New sales processed through the POS terminal will appear here automatically.
              </p>
              <Link
                href="/sales"
                className="mt-3 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
              >
                Start a Sale
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[580px] w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Invoice</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 text-center font-semibold">Qty</th>
                    <th className="px-5 py-3 font-semibold">Payment</th>
                    <th className="px-5 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-gray-900 font-mono text-xs">
                        {sale.invoice_number ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs text-gray-600">
                        {formatDate(sale.sale_date)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-center text-xs text-gray-700 font-medium">
                        {formatNumber(sale.itemCount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs">
                        {sale.payment ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/60">
                            {formatLabel(sale.payment.payment_method)} · {formatStatus(sale.payment.payment_status)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Unpaid
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-gray-900">
                        {formatCurrency(toNumber(sale.total_amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inventory Activity Stream */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Inventory Activity</h2>
              <p className="text-xs text-slate-500">Immutable ledger movements</p>
            </div>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              View Ledger &rarr;
            </Link>
          </div>

          {inventoryMovements.length === 0 ? (
            <div className="p-8 text-center">
              <svg
                className="mx-auto h-10 w-10 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="mt-2 text-sm font-medium text-gray-900">No inventory movements</p>
              <p className="mt-1 text-xs text-gray-500">
                Purchases, sales, and returns will record ledger movements automatically.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {inventoryMovements.slice(0, 5).map((movement) => {
                const delta = movementDelta(movement)
                const isOutflow = delta < 0

                return (
                  <li
                    key={movement.id}
                    className="px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {movement.products?.[0]?.name ?? 'Product'}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-medium ${
                              isOutflow
                                ? 'bg-amber-50 text-amber-800 border border-amber-200/50'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/50'
                            }`}
                          >
                            {formatLabel(movement.movement_type)}
                          </span>
                          <span>·</span>
                          <span className="truncate">{movement.stores?.[0]?.name ?? 'Store'}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`font-semibold text-sm ${
                            isOutflow ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {delta > 0 ? `+${formatNumber(delta)}` : formatNumber(delta)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {formatDate(movement.created_at)}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}
