'use client'

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { saveCustomer, type CustomerActionState } from './actions'

export type Customer = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  address: string | null
  loyalty_points: number | string | null
  is_active: boolean | null
  created_at: string | null
}

export type CustomerSalesSummary = {
  id: string
  customer_id: string | null
  total_amount: number | string | null
  status: string | null
}

const initialState: CustomerActionState = {}

function toNumber(value: number | string | null | undefined): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number | string | null | undefined): string {
  const amount = toNumber(value)

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function formatLoyaltyPoints(value: number | string | null): string {
  if (value === null || value === undefined) return '0'
  const points = toNumber(value)
  return points.toLocaleString('en-IN')
}

function getLoyaltyTierBadge(pointsRaw: number | string | null) {
  const points = toNumber(pointsRaw)

  if (points >= 500) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200 shadow-2xs">
        <span className="text-amber-500 font-bold">★</span>
        Gold Tier
      </span>
    )
  }

  if (points >= 100) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200 shadow-2xs">
        <span className="text-indigo-500 font-bold">★</span>
        Silver Tier
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
      Bronze Tier
    </span>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition"
    >
      {pending ? (
        <>
          <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Saving Customer...</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Save Customer Profile</span>
        </>
      )}
    </button>
  )
}

function CustomerForm({ onCancel }: { onCancel: () => void }) {
  const [state, formAction] = useActionState(saveCustomer, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      onCancel()
      router.refresh()
    }
  }, [onCancel, router, state.success])

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="font-semibold text-slate-700">Customer Full Name *</span>
          <input
            required
            name="name"
            placeholder="e.g. Priya Sharma, Rohan Gupta"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Account Status</span>
          <select
            name="is_active"
            defaultValue="true"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          >
            <option value="true">Active Account</option>
            <option value="false">Inactive / Archived</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Telephone / Mobile</span>
          <input
            type="tel"
            name="phone"
            inputMode="tel"
            placeholder="e.g. +91 98765 43210"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Email Address</span>
          <input
            type="email"
            name="email"
            inputMode="email"
            placeholder="e.g. customer@domain.com"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Initial Loyalty Points</span>
          <input
            type="number"
            min="0"
            step="1"
            name="loyalty_points"
            defaultValue="0"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3">
          <span className="font-semibold text-slate-700">Delivery Address</span>
          <textarea
            name="address"
            rows={2}
            placeholder="e.g. Flat 402, Green Valley Apartments, Indiranagar, Bengaluru..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>
      </div>

      {state.error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-900 font-medium flex items-center gap-2">
          <svg className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      {state.success && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900 font-medium flex items-center gap-2">
          <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{state.success}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-300 transition"
        >
          Cancel
        </button>
        <SubmitButton />
      </div>
    </form>
  )
}

export default function CustomerManagement({
  customers,
  sales = [],
}: {
  customers: Customer[]
  sales?: CustomerSalesSummary[]
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [tierFilter, setTierFilter] = useState('ALL')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const cancelForm = useCallback(() => setIsFormOpen(false), [])

  // Aggregate purchase statistics per customer
  const customerStats = useMemo(() => {
    const stats = new Map<string, { orderCount: number; totalSpend: number }>()

    for (const sale of sales) {
      if (sale.customer_id) {
        const current = stats.get(sale.customer_id) ?? { orderCount: 0, totalSpend: 0 }
        current.orderCount += 1
        current.totalSpend += toNumber(sale.total_amount)
        stats.set(sale.customer_id, current)
      }
    }

    return stats
  }, [sales])

  // Summary KPI Metrics
  const activeCount = useMemo(
    () => customers.filter((c) => c.is_active !== false).length,
    [customers]
  )

  const totalPoints = useMemo(() => {
    return customers.reduce((sum, c) => sum + toNumber(c.loyalty_points), 0)
  }, [customers])

  const totalSpendTracked = useMemo(() => {
    let sum = 0
    for (const val of customerStats.values()) {
      sum += val.totalSpend
    }
    return sum
  }, [customerStats])

  const normalizedQuery = query.trim().toLowerCase()

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          customer.name,
          customer.phone,
          customer.email,
          customer.address,
        ].some((val) => val?.toLowerCase().includes(normalizedQuery))

      const isActive = customer.is_active !== false
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && isActive) ||
        (statusFilter === 'INACTIVE' && !isActive)

      const points = toNumber(customer.loyalty_points)
      const matchesTier =
        tierFilter === 'ALL' ||
        (tierFilter === 'GOLD' && points >= 500) ||
        (tierFilter === 'SILVER' && points >= 100 && points < 500) ||
        (tierFilter === 'BRONZE' && points < 100)

      return matchesQuery && matchesStatus && matchesTier
    })
  }, [customers, normalizedQuery, statusFilter, tierFilter])

  return (
    <main className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              {customers.length} {customers.length === 1 ? 'Customer' : 'Customers'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage customer directories, loyalty point balances, and purchase activity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen((open) => !open)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-xs transition ${
            isFormOpen
              ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }`}
        >
          {isFormOpen ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Close Form</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>+ Add Customer</span>
            </>
          )}
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Registered Accounts</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs">
              👥
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{customers.length}</span>
            <span className="text-xs text-slate-400">profiles</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Accounts</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{activeCount}</span>
            <span className="text-xs text-emerald-600">verified</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Loyalty Points</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-xs">
              ★
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700">{totalPoints.toLocaleString('en-IN')}</span>
            <span className="text-xs text-amber-600">pts</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lifetime Spend</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs">
              ₹
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-700">{formatCurrency(totalSpendTracked)}</span>
          </div>
        </div>
      </div>

      {/* Add Customer Form Drawer */}
      {isFormOpen && (
        <section className="rounded-xl border border-indigo-100 bg-white p-6 shadow-md transition-all">
          <div className="border-b border-slate-200 pb-4 mb-5">
            <h2 className="text-lg font-bold text-slate-900">Add New Customer</h2>
            <p className="mt-1 text-xs text-slate-500">
              Register a customer profile to track POS purchases, accrue loyalty point rewards, and enable return lookups.
            </p>
          </div>
          <CustomerForm onCancel={cancelForm} />
        </section>
      )}

      {/* Search and Multi-Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer name, phone, email, or address..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-9 py-2 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          >
            <option value="ALL">All Accounts</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          >
            <option value="ALL">All Loyalty Tiers</option>
            <option value="GOLD">Gold (500+ pts)</option>
            <option value="SILVER">Silver (100-499 pts)</option>
            <option value="BRONZE">Bronze (&lt;100 pts)</option>
          </select>

          <span className="text-xs text-slate-500 whitespace-nowrap pl-1">
            Showing <strong>{filteredCustomers.length}</strong> of {customers.length}
          </span>
        </div>
      </div>

      {/* Main Table / Empty States */}
      {customers.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            No Customers Registered Yet
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Build your customer directory to reward repeat shoppers with loyalty points, track customer lifetime value, and speed up POS checkouts.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              + Add First Customer
            </button>
          </div>
        </section>
      ) : filteredCustomers.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center shadow-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800">No matching customers</h3>
          <p className="mt-1 text-xs text-slate-500">
            No customer records matched your search query or filter selection.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setStatusFilter('ALL')
              setTierFilter('ALL')
            }}
            className="mt-3 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            Clear Filters
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Customer</th>
                  <th scope="col" className="px-4 py-3.5">Contact Channels</th>
                  <th scope="col" className="px-4 py-3.5">Loyalty Rewards</th>
                  <th scope="col" className="px-4 py-3.5">Purchase Activity</th>
                  <th scope="col" className="px-4 py-3.5">Delivery Address</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => {
                  const stats = customerStats.get(customer.id)
                  const isActive = customer.is_active !== false

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {customer.name ?? 'Unnamed Customer'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          Joined {formatDate(customer.created_at)}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        <div className="space-y-1 text-xs">
                          {customer.phone ? (
                            <div>
                              <a
                                href={`tel:${customer.phone}`}
                                className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                📞 {customer.phone}
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400">No phone</span>
                          )}
                          {customer.email ? (
                            <div>
                              <a
                                href={`mailto:${customer.email}`}
                                className="text-slate-600 hover:text-slate-900 hover:underline"
                              >
                                ✉️ {customer.email}
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          {getLoyaltyTierBadge(customer.loyalty_points)}
                          <div className="text-xs font-mono font-bold text-slate-900">
                            {formatLoyaltyPoints(customer.loyalty_points)} <span className="text-slate-400 font-normal">pts</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs">
                        {stats && stats.orderCount > 0 ? (
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 text-sm">
                              {formatCurrency(stats.totalSpend)}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {stats.orderCount} total order{stats.orderCount === 1 ? '' : 's'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400 italic">No orders yet</div>
                        )}
                      </td>

                      <td className="max-w-xs px-4 py-4 text-slate-600 text-xs" title={customer.address ?? ''}>
                        {customer.address ? (
                          <span className="line-clamp-2 leading-relaxed">{customer.address}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
