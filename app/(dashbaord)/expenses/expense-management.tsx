'use client'

import { useState, useMemo } from 'react'

export type Expense = {
  id: string
  category: string | null
  description: string | null
  amount: number | string | null
  expense_date: string | null
  payment_method: string | null
  status: string | null
  stores:
    | {
        name: string | null
        code: string | null
      }[]
    | null
    | undefined
}

function toNumber(value: number | string | null | undefined): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—'
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
    : new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
      }).format(date)
}

function getCategoryBadge(category: string | null) {
  const norm = (category ?? '').toLowerCase().trim()

  if (norm.includes('util') || norm.includes('electric') || norm.includes('power')) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {category}
      </span>
    )
  }
  if (norm.includes('rent') || norm.includes('lease') || norm.includes('facility')) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        {category}
      </span>
    )
  }
  if (norm.includes('salar') || norm.includes('wage') || norm.includes('payroll')) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {category}
      </span>
    )
  }
  if (norm.includes('suppl') || norm.includes('station') || norm.includes('pack')) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-800 border border-purple-200">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        {category}
      </span>
    )
  }
  if (norm.includes('maint') || norm.includes('repair')) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-800 border border-orange-200">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        {category}
      </span>
    )
  }
  if (norm.includes('market') || norm.includes('ad') || norm.includes('promo')) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 border border-indigo-200">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        {category}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 border border-slate-200">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {category || 'General'}
    </span>
  )
}

function getStatusBadge(status: string | null) {
  const norm = (status ?? '').toLowerCase().trim()

  switch (norm) {
    case 'paid':
    case 'approved':
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Paid'}
        </span>
      )
    case 'pending':
    case 'submitted':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Pending
        </span>
      )
    case 'rejected':
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Rejected
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
          {status || 'Recorded'}
        </span>
      )
  }
}

function getPaymentMethodBadge(method: string | null) {
  const norm = (method ?? '').toLowerCase().trim()
  if (norm.includes('cash')) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-700 font-medium">
        <span>💵</span> Cash
      </span>
    )
  }
  if (norm.includes('upi') || norm.includes('qr')) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-indigo-700 font-medium">
        <span>📱</span> UPI
      </span>
    )
  }
  if (norm.includes('card')) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-700 font-medium">
        <span>💳</span> Card
      </span>
    )
  }
  if (norm.includes('bank') || norm.includes('transfer') || norm.includes('neft')) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
        <span>🏦</span> Transfer
      </span>
    )
  }
  return <span className="text-xs text-slate-600 font-medium">{method || '—'}</span>
}

export function ExpenseManagement({
  initialExpenses,
}: {
  initialExpenses: Expense[]
}) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc')

  // Modals & Details
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newCategory, setNewCategory] = useState('Utilities')
  const [newDescription, setNewDescription] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newPaymentMethod, setNewPaymentMethod] = useState('bank_transfer')
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Categories list derived from expenses
  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    for (const exp of expenses) {
      if (exp.category) set.add(exp.category)
    }
    return Array.from(set).sort()
  }, [expenses])

  // Payment methods list derived from expenses
  const availablePaymentMethods = useMemo(() => {
    const set = new Set<string>()
    for (const exp of expenses) {
      if (exp.payment_method) set.add(exp.payment_method)
    }
    return Array.from(set).sort()
  }, [expenses])

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalAmount = expenses.reduce((acc, exp) => acc + toNumber(exp.amount), 0)
    const paidCount = expenses.filter((e) => {
      const s = (e.status ?? '').toLowerCase()
      return s === 'paid' || s === 'completed' || s === 'approved' || !e.status
    }).length
    const settlementRate = expenses.length > 0 ? Math.round((paidCount / expenses.length) * 100) : 100

    // Top Category
    const categoryTotals = new Map<string, number>()
    for (const exp of expenses) {
      const cat = exp.category || 'Uncategorized'
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + toNumber(exp.amount))
    }
    let topCategory = '—'
    let topCatAmount = 0
    for (const [cat, amt] of categoryTotals.entries()) {
      if (amt > topCatAmount) {
        topCatAmount = amt
        topCategory = cat
      }
    }

    const avgExpense = expenses.length > 0 ? totalAmount / expenses.length : 0

    return {
      totalAmount,
      count: expenses.length,
      topCategory,
      topCatAmount,
      settlementRate,
      avgExpense,
    }
  }, [expenses])

  // Filtered and Sorted Expenses
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((exp) => {
        const query = searchQuery.trim().toLowerCase()
        const matchSearch =
          !query ||
          (exp.description ?? '').toLowerCase().includes(query) ||
          (exp.category ?? '').toLowerCase().includes(query) ||
          (exp.id ?? '').toLowerCase().includes(query) ||
          (exp.stores?.[0]?.name ?? '').toLowerCase().includes(query) ||
          (exp.stores?.[0]?.code ?? '').toLowerCase().includes(query)

        const matchCategory =
          categoryFilter === 'ALL' || (exp.category ?? '').toLowerCase() === categoryFilter.toLowerCase()

        const status = (exp.status ?? 'paid').toLowerCase()
        const matchStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'PAID' && (status === 'paid' || status === 'completed' || status === 'approved')) ||
          (statusFilter === 'PENDING' && status === 'pending')

        const method = (exp.payment_method ?? '').toLowerCase()
        const matchPayment =
          paymentFilter === 'ALL' || method === paymentFilter.toLowerCase()

        return matchSearch && matchCategory && matchStatus && matchPayment
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return new Date(b.expense_date || 0).getTime() - new Date(a.expense_date || 0).getTime()
        }
        if (sortBy === 'date_asc') {
          return new Date(a.expense_date || 0).getTime() - new Date(b.expense_date || 0).getTime()
        }
        if (sortBy === 'amount_desc') {
          return toNumber(b.amount) - toNumber(a.amount)
        }
        if (sortBy === 'amount_asc') {
          return toNumber(a.amount) - toNumber(b.amount)
        }
        return 0
      })
  }, [expenses, searchQuery, categoryFilter, statusFilter, paymentFilter, sortBy])

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const amt = parseFloat(newAmount)
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid expense amount greater than 0.')
      return
    }
    if (!newDescription.trim()) {
      setFormError('Please provide a brief description for this operational expense.')
      return
    }

    const newExpenseRecord: Expense = {
      id: `exp-${Date.now()}`,
      category: newCategory,
      description: newDescription.trim(),
      amount: amt,
      expense_date: newExpenseDate || new Date().toISOString(),
      payment_method: newPaymentMethod,
      status: 'approved',
      stores: [{ name: 'Main Store', code: 'MAIN' }],
    }

    setExpenses((prev) => [newExpenseRecord, ...prev])
    setAddSuccessMsg(`Expense of ${formatCurrency(amt)} successfully recorded under ${newCategory}.`)
    setIsAddOpen(false)
    setNewDescription('')
    setNewAmount('')

    setTimeout(() => {
      setAddSuccessMsg(null)
    }, 5000)
  }

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {addSuccessMsg && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-xs animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{addSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setAddSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Operating Expenses
              </h1>
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                {expenses.length} {expenses.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Track store operational disbursements, supplier freight, utilities, facility rents, and general retail overhead.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsAddOpen(true)
              setFormError(null)
            }}
            id="btn-log-expense"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-amber-700 active:bg-amber-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition"
          >
            <svg className="h-4 w-4 text-amber-200" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>+ Log Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Card 1 */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wider">Total Disbursements</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-xs">
              📊
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(metrics.totalAmount)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">across all store branches</p>
        </div>

        {/* Card 2 */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wider">Average Expense</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-xs">
              ⚡
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(metrics.avgExpense)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">per recorded voucher</p>
        </div>

        {/* Card 3 */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wider">Top Cost Center</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-800 border border-amber-100 text-xs">
              🏷️
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-amber-900 truncate" title={metrics.topCategory}>
              {metrics.topCategory}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {metrics.topCatAmount > 0 ? formatCurrency(metrics.topCatAmount) : 'No spend'}
          </p>
        </div>

        {/* Card 4 */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wider">Approval Rate</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">
              {metrics.settlementRate}%
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-600">settled or approved</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by description, category, store, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Filter by category"
          >
            <option value="ALL">All Categories</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid / Approved</option>
            <option value="PENDING">Pending</option>
          </select>

          {/* Payment Method Filter */}
          {availablePaymentMethods.length > 0 && (
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              aria-label="Filter by payment method"
            >
              <option value="ALL">All Payment Methods</option>
              {availablePaymentMethods.map((m) => (
                <option key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          )}

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Sort expenses"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Amount (High to Low)</option>
            <option value="amount_asc">Amount (Low to High)</option>
          </select>

          <span className="text-xs text-slate-500 whitespace-nowrap pl-1">
            Showing <strong>{filteredExpenses.length}</strong> of {expenses.length}
          </span>
        </div>
      </div>

      {/* Expenses Table or Empty State */}
      {filteredExpenses.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || paymentFilter !== 'ALL'
              ? 'No Matching Expenses Found'
              : 'No Expenses Recorded Yet'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || paymentFilter !== 'ALL'
              ? 'Try changing your search terms, clear your category filters, or reset the status filters.'
              : 'Keep track of operating costs, rent, utilities, and daily retail disbursements by logging your first expense voucher.'}
          </p>
          <div className="mt-4">
            {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || paymentFilter !== 'ALL' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setCategoryFilter('ALL')
                  setStatusFilter('ALL')
                  setPaymentFilter('ALL')
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                Clear All Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
              >
                + Log First Expense
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Category</th>
                    <th scope="col" className="px-4 py-3.5">Description</th>
                    <th scope="col" className="px-4 py-3.5">Store Location</th>
                    <th scope="col" className="px-4 py-3.5 text-right">Amount</th>
                    <th scope="col" className="px-4 py-3.5">Date</th>
                    <th scope="col" className="px-4 py-3.5">Payment Method</th>
                    <th scope="col" className="px-4 py-3.5 text-center">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      onClick={() => setSelectedExpense(expense)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5">
                        {getCategoryBadge(expense.category)}
                      </td>
                      <td className="max-w-xs px-4 py-3.5">
                        <div className="truncate font-medium text-slate-900" title={expense.description ?? ''}>
                          {expense.description ?? '—'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          REF: {expense.id.slice(0, 16)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">
                        {expense.stores?.[0]?.name ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800">{expense.stores[0].name}</span>
                            {expense.stores[0].code && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-600 border border-slate-200">
                                {expense.stores[0].code}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">
                        {formatDate(expense.expense_date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {getPaymentMethodBadge(expense.payment_method)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center">
                        {getStatusBadge(expense.status)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedExpense(expense)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden space-y-3">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                onClick={() => setSelectedExpense(expense)}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs active:bg-slate-50 cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {getCategoryBadge(expense.category)}
                    <h3 className="mt-1 text-sm font-semibold text-slate-900 leading-snug">
                      {expense.description ?? 'Unspecified Expense'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-base text-slate-900">
                      {formatCurrency(expense.amount)}
                    </span>
                    <div className="mt-0.5">{getStatusBadge(expense.status)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>{formatDate(expense.expense_date)}</span>
                    <span>•</span>
                    <span>{getPaymentMethodBadge(expense.payment_method)}</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {expense.stores?.[0]?.code ?? 'MAIN'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* ADD EXPENSE MODAL */}
      {/* ========================================================================= */}
      {isAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Log Operating Expense</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record an overhead disbursement or operational payment voucher.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 transition"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddExpense} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="Utilities">Utilities (Electricity, Water, Internet)</option>
                    <option value="Rent & Facilities">Rent & Facility Lease</option>
                    <option value="Salaries & Wages">Staff Salaries & Wages</option>
                    <option value="Packaging & Supplies">Packaging & Retail Supplies</option>
                    <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                    <option value="Logistics & Delivery">Freight, Logistics & Delivery</option>
                    <option value="Marketing & Promo">Marketing & Advertising</option>
                    <option value="Software & POS">Software & POS Subscriptions</option>
                    <option value="Other Overhead">Other Overhead</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Disbursement Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 3500.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-mono font-semibold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. August electricity bill - Central Superstore"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newExpenseDate}
                    onChange={(e) => setNewExpenseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="upi">UPI / Instant QR</option>
                    <option value="credit_card">Corporate Credit Card</option>
                    <option value="cash">Petty Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 active:bg-amber-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition"
                >
                  Confirm & Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXPENSE DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedExpense && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Expense Details</h2>
                  {getStatusBadge(selectedExpense.status)}
                </div>
                <p className="text-xs font-mono text-slate-400 mt-0.5">ID: {selectedExpense.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                aria-label="Close modal"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 transition"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-center">
                <span className="text-slate-500 block text-xs">Disbursement Amount</span>
                <span className="text-2xl font-bold font-mono text-slate-900 block mt-1">
                  {formatCurrency(selectedExpense.amount)}
                </span>
                <div className="mt-2 inline-block">
                  {getCategoryBadge(selectedExpense.category)}
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-3 bg-white">
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 font-medium">Description</span>
                  <span className="text-slate-900 font-semibold text-right max-w-xs">{selectedExpense.description ?? '—'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 font-medium">Store Location</span>
                  <span className="text-slate-900 font-medium">{selectedExpense.stores?.[0]?.name ?? 'Primary Store'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 font-medium">Expense Date</span>
                  <span className="text-slate-900 font-medium">{formatDate(selectedExpense.expense_date)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 font-medium">Payment Channel</span>
                  <span className="text-slate-900 font-medium">{getPaymentMethodBadge(selectedExpense.payment_method)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
