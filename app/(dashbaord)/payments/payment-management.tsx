'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export type Payment = {
  id: string
  amount: number | string | null
  payment_method: string | null
  payment_status: string | null
  transaction_reference: string | null
  paid_at: string | null
  sales:
    | {
        invoice_number: string | null
      }[]
    | null
    | undefined
}

function toNumber(value: number | string | null | undefined): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }

  const amount = toNumber(value)

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getPaymentMethodBadge(method: string | null) {
  const normalized = (method ?? '').toLowerCase().trim()

  switch (normalized) {
    case 'cash':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 border border-slate-200">
          <span className="text-slate-500">💵</span>
          Cash
        </span>
      )
    case 'upi':
    case 'qr':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
          <span className="text-indigo-500">📱</span>
          UPI / QR
        </span>
      )
    case 'credit_card':
    case 'credit':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
          <span className="text-blue-500">💳</span>
          Credit Card
        </span>
      )
    case 'debit_card':
    case 'debit':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 border border-sky-200">
          <span className="text-sky-500">💳</span>
          Debit Card
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200">
          {method ? method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' ') : 'Unknown'}
        </span>
      )
  }
}

function getStatusBadge(status: string | null) {
  const normalized = (status ?? '').toLowerCase().trim()

  switch (normalized) {
    case 'completed':
    case 'success':
    case 'paid':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Completed
        </span>
      )
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Pending
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Failed
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
        </span>
      )
  }
}

export default function PaymentManagement({ payments }: { payments: Payment[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Summary Metrics
  const totalCollections = useMemo(() => {
    return payments.reduce((sum, p) => {
      const s = (p.payment_status ?? '').toLowerCase()
      if (s === 'completed' || s === 'success' || s === 'paid' || !s) {
        return sum + toNumber(p.amount)
      }
      return sum
    }, 0)
  }, [payments])

  const completedCount = useMemo(() => {
    return payments.filter((p) => {
      const s = (p.payment_status ?? '').toLowerCase()
      return s === 'completed' || s === 'success' || s === 'paid' || !s
    }).length
  }, [payments])

  const activeTenderTypes = useMemo(() => {
    const methods = new Set<string>()
    payments.forEach((p) => {
      if (p.payment_method) methods.add(p.payment_method.toLowerCase())
    })
    return methods.size
  }, [payments])

  const averageTicket = useMemo(() => {
    if (completedCount === 0) return 0
    return totalCollections / completedCount
  }, [totalCollections, completedCount])

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return payments.filter((payment) => {
      const invoiceNum = payment.sales?.[0]?.invoice_number?.toLowerCase() ?? ''
      const reference = payment.transaction_reference?.toLowerCase() ?? ''
      const method = payment.payment_method?.toLowerCase() ?? ''

      const matchesSearch =
        !q ||
        invoiceNum.includes(q) ||
        reference.includes(q) ||
        method.includes(q)

      const normalizedMethod = (payment.payment_method ?? '').toLowerCase()
      const matchesMethod =
        methodFilter === 'ALL' ||
        (methodFilter === 'CASH' && normalizedMethod === 'cash') ||
        (methodFilter === 'UPI' && (normalizedMethod === 'upi' || normalizedMethod === 'qr')) ||
        (methodFilter === 'CREDIT' && (normalizedMethod === 'credit_card' || normalizedMethod === 'credit')) ||
        (methodFilter === 'DEBIT' && (normalizedMethod === 'debit_card' || normalizedMethod === 'debit'))

      const normalizedStatus = (payment.payment_status ?? '').toLowerCase()
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'COMPLETED' && (normalizedStatus === 'completed' || normalizedStatus === 'success' || normalizedStatus === 'paid' || !normalizedStatus)) ||
        (statusFilter === 'PENDING' && normalizedStatus === 'pending') ||
        (statusFilter === 'FAILED' && normalizedStatus === 'failed')

      return matchesSearch && matchesMethod && matchesStatus
    })
  }, [payments, searchQuery, methodFilter, statusFilter])

  return (
    <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">Payments</h1>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 shrink-0">
                {payments.length} {payments.length === 1 ? 'Transaction' : 'Transactions'}
              </span>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Audit-verified sales payment logs, tender settlement breakdown, and transaction references.
            </p>
          </div>
        </div>

        <Link
          href="/sales"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition w-full sm:w-auto shrink-0"
        >
          <svg className="h-4 w-4 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Open POS Register</span>
        </Link>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Total Collections</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs shrink-0">
              💰
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg sm:text-2xl font-bold text-emerald-700 truncate">{formatCurrency(totalCollections)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Settled Transactions</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs shrink-0">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{completedCount}</span>
            <span className="text-xs text-slate-400">cleared</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Average Ticket</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs shrink-0">
              📊
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{formatCurrency(averageTicket)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Tender Channels</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-xs shrink-0">
              💳
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{activeTenderTypes}</span>
            <span className="text-xs text-slate-400">methods</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full min-w-0 max-w-full">
        <div className="relative flex-1 min-w-0">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by invoice number, transaction reference, or method..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50/50 pl-10 pr-9 py-2 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="flex-1 sm:flex-initial rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition min-w-[130px]"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI / QR</option>
            <option value="CREDIT">Credit Card</option>
            <option value="DEBIT">Debit Card</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-initial rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition min-w-[120px]"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>

          <span className="text-xs text-slate-500 whitespace-nowrap pl-1 shrink-0">
            Showing <strong>{filteredPayments.length}</strong> of {payments.length}
          </span>
        </div>
      </div>

      {/* Main Table / Empty States */}
      {payments.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            No Payment Transactions Recorded Yet
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Payment records appear automatically as transactions are completed at the point of sale counter or through invoice settlements.
          </p>
        </section>
      ) : filteredPayments.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center shadow-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800">No matching payments</h3>
          <p className="mt-1 text-xs text-slate-500">
            No payment transaction records matched your search query or filter selection.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setMethodFilter('ALL')
              setStatusFilter('ALL')
            }}
            className="mt-3 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            Clear Filters
          </button>
        </section>
      ) : (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="w-full overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="min-w-[850px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-4 sm:px-5 py-3.5">Invoice #</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5 text-right">Amount Received</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5">Payment Method</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5">Status</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5">Transaction Reference</th>
                  <th scope="col" className="whitespace-nowrap px-4 sm:px-5 py-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="whitespace-nowrap px-4 sm:px-5 py-4">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                        {payment.sales?.[0]?.invoice_number ?? '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-slate-900 font-mono text-base">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {getPaymentMethodBadge(payment.payment_method)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {getStatusBadge(payment.payment_status)}
                    </td>
                    <td className="max-w-[200px] px-4 py-4 font-mono text-xs text-slate-600 truncate">
                      {payment.transaction_reference ? (
                        <span className="bg-slate-50 px-2 py-1 rounded-md border border-slate-200 truncate inline-block max-w-full" title={payment.transaction_reference}>
                          {payment.transaction_reference}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 sm:px-5 py-4 text-slate-600 text-xs">
                      {formatDate(payment.paid_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
