'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  lookupSaleForReturn,
  processCreateReturn,
  getReturnDetails,
  type SaleLookupItem,
  type SaleLookupResult,
  type ReturnDetailsResult,
} from './actions'

export type ReturnRecord = {
  id: string
  return_number: string | null
  status: string | null
  reason: string | null
  refund_amount: number | string | null
  payment_method?: string | null
  returned_at: string | null
  sales:
    | {
        invoice_number: string | null
      }[]
    | null
    | undefined
  customers:
    | {
        name: string | null
      }[]
    | null
    | undefined
}

function toNumber(value: number | string | null | undefined): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined) return '₹0.00'
  const amount = toNumber(value)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function formatStatus(value: string | null) {
  if (!value) return 'Completed'
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function ReturnsView({
  initialReturns,
}: {
  initialReturns: ReturnRecord[]
}) {
  const [returnsList, setReturnsList] = useState<ReturnRecord[]>(initialReturns)
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Create Return Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [isLookingUp, startLookupTransition] = useTransition()
  const [lookupResult, setLookupResult] = useState<SaleLookupResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  // Items return quantity selection: Map<productId, number>
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({})
  const [returnReason, setReturnReason] = useState('Customer Changed Mind')
  const [customReason, setCustomReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<
    'cash' | 'upi' | 'credit_card' | 'debit_card' | 'store_credit'
  >('cash')

  // Submission & Confirmation State
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Success Modal State
  const [successData, setSuccessData] = useState<{
    returnNumber: string
    invoiceNumber: string
    unitsReturned: number
    refundAmount: number
    paymentMethod: string
  } | null>(null)

  // Details Modal State
  const [selectedReturnDetails, setSelectedReturnDetails] =
    useState<ReturnDetailsResult['returnRecord'] | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // KPI Calculations
  const totalRefundsValue = useMemo(() => {
    return returnsList.reduce((sum, r) => sum + toNumber(r.refund_amount), 0)
  }, [returnsList])

  const completedReturnsCount = useMemo(() => {
    return returnsList.filter((r) => (r.status ?? '').toLowerCase() === 'completed' || !r.status).length
  }, [returnsList])

  const pendingReturnsCount = useMemo(() => {
    return returnsList.filter((r) => (r.status ?? '').toLowerCase() === 'pending').length
  }, [returnsList])

  // Filtered returns list
  const filteredReturns = useMemo(() => {
    return returnsList.filter((r) => {
      const term = searchFilter.trim().toLowerCase()
      const retNum = (r.return_number ?? '').toLowerCase()
      const invNum = (r.sales?.[0]?.invoice_number ?? '').toLowerCase()
      const cust = (r.customers?.[0]?.name ?? '').toLowerCase()
      const reason = (r.reason ?? '').toLowerCase()

      const matchesSearch =
        !term ||
        retNum.includes(term) ||
        invNum.includes(term) ||
        cust.includes(term) ||
        reason.includes(term)

      const status = (r.status ?? 'completed').toLowerCase()
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'COMPLETED' && status === 'completed') ||
        (statusFilter === 'PENDING' && status !== 'completed')

      return matchesSearch && matchesStatus
    })
  }, [returnsList, searchFilter, statusFilter])

  // Handle invoice search
  const handleLookup = () => {
    if (!invoiceQuery.trim()) {
      setLookupError('Please enter a valid invoice number to look up.')
      return
    }
    setLookupError(null)
    setLookupResult(null)
    setReturnQuantities({})

    startLookupTransition(async () => {
      const res = await lookupSaleForReturn(invoiceQuery.trim())
      if (!res.success) {
        setLookupError(res.error ?? 'Invoice not found. Please verify the invoice number.')
      } else {
        setLookupResult(res)
        // Default all return quantities to 0
        const initialMap: Record<string, number> = {}
        for (const item of res.items ?? []) {
          initialMap[item.productId] = 0
        }
        setReturnQuantities(initialMap)
      }
    })
  }

  // Update item return quantity with safety bounds
  const handleQuantityChange = (item: SaleLookupItem, qty: number) => {
    const safeQty = Math.max(0, Math.min(item.returnableQuantity, Math.floor(qty)))
    setReturnQuantities((prev) => ({
      ...prev,
      [item.productId]: safeQty,
    }))
  }

  // Calculated totals for modal
  const totalUnitsToReturn = Object.values(returnQuantities).reduce(
    (sum, q) => sum + (q || 0),
    0
  )

  const totalRefundAmount =
    (lookupResult?.items ?? []).reduce((sum, item) => {
      const qty = returnQuantities[item.productId] || 0
      return sum + qty * item.unitPrice
    }, 0) || 0

  // Open Details Modal
  const handleViewDetails = async (returnId: string) => {
    setIsLoadingDetails(true)
    setSelectedReturnDetails(null)
    const res = await getReturnDetails(returnId)
    setIsLoadingDetails(false)
    if (res.success && res.returnRecord) {
      setSelectedReturnDetails(res.returnRecord)
    }
  }

  // Process Return Submission
  const handleConfirmSubmit = async () => {
    if (!lookupResult || !lookupResult.invoiceNumber) return
    const finalReason =
      returnReason === 'Other' && customReason.trim()
        ? customReason.trim()
        : returnReason

    const itemsToSubmit = (lookupResult.items ?? [])
      .filter((it) => (returnQuantities[it.productId] || 0) > 0)
      .map((it) => ({
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        returnQuantity: returnQuantities[it.productId] || 0,
        unitPrice: it.unitPrice,
      }))

    if (itemsToSubmit.length === 0) {
      setSubmitError('Please specify at least 1 unit to return.')
      setShowConfirm(false)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await processCreateReturn({
        invoiceNumber: lookupResult.invoiceNumber,
        reason: finalReason,
        refundMethod,
        items: itemsToSubmit,
      })

      setIsSubmitting(false)
      setShowConfirm(false)

      if (!res.success || !res.returnNumber) {
        setSubmitError(res.error ?? 'Failed to process return. Please try again.')
      } else {
        // Success! Show success receipt modal
        setSuccessData({
          returnNumber: res.returnNumber,
          invoiceNumber: res.invoiceNumber ?? lookupResult.invoiceNumber,
          unitsReturned: res.unitsReturned ?? totalUnitsToReturn,
          refundAmount: res.refundAmount ?? totalRefundAmount,
          paymentMethod: res.paymentMethod ?? refundMethod,
        })

        // Add newly created return to top of table
        const newRecord: ReturnRecord = {
          id: res.returnNumber,
          return_number: res.returnNumber,
          status: 'completed',
          reason: finalReason,
          refund_amount: res.refundAmount ?? totalRefundAmount,
          returned_at: new Date().toISOString(),
          sales: [{ invoice_number: lookupResult.invoiceNumber }],
          customers: [{ name: lookupResult.customerName ?? 'Walk-in Customer' }],
        }
        setReturnsList((prev) => [newRecord, ...prev])

        // Reset creation form
        setIsCreateOpen(false)
        setLookupResult(null)
        setInvoiceQuery('')
        setReturnQuantities({})
      }
    } catch (err: unknown) {
      setIsSubmitting(false)
      setShowConfirm(false)
      setSubmitError(
        err instanceof Error ? err.message : 'An unexpected error occurred while processing return.'
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Returns & Reverse Sales
              </h1>
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                {returnsList.length} {returnsList.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Issue customer refunds, reverse sales transactions, and automatically synchronize the immutable inventory ledger.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreateOpen(true)
            setLookupResult(null)
            setLookupError(null)
            setSubmitError(null)
            setInvoiceQuery('')
          }}
          id="btn-create-return"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 active:bg-rose-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition"
        >
          <svg className="h-4 w-4 text-rose-200" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>+ Create Return</span>
        </button>
      </div>

      {/* KPI Overview Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Returns</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-xs">
              ↩
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{returnsList.length}</span>
            <span className="text-xs text-slate-400">records</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Refunds Issued</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-xs">
              ₹
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700">{formatCurrency(totalRefundsValue)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Completed</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{completedReturnsCount}</span>
            <span className="text-xs text-emerald-600">finalized</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-xs">
              ⏳
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700">{pendingReturnsCount}</span>
            <span className="text-xs text-amber-600">active</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by Return Number, Invoice, Customer, or Reason..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50/50 pl-10 pr-9 py-2 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 transition"
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => setSearchFilter('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 shadow-2xs focus:border-rose-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 transition"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed Only</option>
            <option value="PENDING">Pending / Other</option>
          </select>

          <span className="text-xs text-slate-500 whitespace-nowrap pl-1">
            Showing <strong>{filteredReturns.length}</strong> of {returnsList.length}
          </span>
        </div>
      </div>

      {/* Returns History Table */}
      {filteredReturns.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {searchFilter ? 'No Matching Returns Found' : 'No Returns Recorded Yet'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {searchFilter
              ? 'Try modifying your search keywords or clear your status filters.'
              : 'Return transactions will appear here once processed. Click "+ Create Return" to look up a completed sale and issue a refund.'}
          </p>
          <div className="mt-4">
            {searchFilter ? (
              <button
                type="button"
                onClick={() => {
                  setSearchFilter('')
                  setStatusFilter('ALL')
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(true)
                  setLookupResult(null)
                  setLookupError(null)
                  setSubmitError(null)
                  setInvoiceQuery('')
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 transition"
              >
                + Process First Return
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Return Number</th>
                  <th scope="col" className="px-4 py-3.5">Original Invoice</th>
                  <th scope="col" className="px-4 py-3.5">Customer</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Status</th>
                  <th scope="col" className="px-4 py-3.5">Return Reason</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Refund Amount</th>
                  <th scope="col" className="px-4 py-3.5">Returned Date</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((returnRecord) => {
                  const isCompleted = (returnRecord.status ?? '').toLowerCase() === 'completed' || !returnRecord.status

                  return (
                    <tr
                      key={returnRecord.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(returnRecord.id)}
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="font-mono font-bold text-indigo-600 hover:text-indigo-800 text-sm">
                          {returnRecord.return_number ?? '—'}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="font-mono text-xs font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {returnRecord.sales?.[0]?.invoice_number ?? '—'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-900 font-medium">
                        {returnRecord.customers?.[0]?.name ?? 'Walk-in Customer'}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {formatStatus(returnRecord.status)}
                          </span>
                        )}
                      </td>

                      <td className="max-w-xs truncate px-4 py-4 text-slate-600 text-xs" title={returnRecord.reason ?? ''}>
                        {returnRecord.reason ?? '—'}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-slate-900 font-mono text-sm">
                        {formatCurrency(returnRecord.refund_amount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-500 text-xs">
                        {formatDate(returnRecord.returned_at)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleViewDetails(returnRecord.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Breakdown
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* CREATE RETURN MODAL */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Process Customer Return
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Look up a completed sale invoice to restock returned merchandise and issue customer refunds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-5 space-y-6">
              {/* Step 1: Invoice Lookup */}
              <div>
                <label htmlFor="return-invoice-search" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  1. Search Original Invoice Number *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="return-invoice-search"
                      type="text"
                      placeholder="e.g. INV-20260912-8492"
                      value={invoiceQuery}
                      onChange={(e) => setInvoiceQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleLookup()
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-hidden transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={isLookingUp}
                    id="btn-lookup-invoice"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 transition"
                  >
                    {isLookingUp ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <span>Lookup Invoice</span>
                    )}
                  </button>
                </div>

                {lookupError && (
                  <div role="alert" className="mt-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 font-medium flex items-center gap-2">
                    <svg className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{lookupError}</span>
                  </div>
                )}
              </div>

              {/* Step 2: Sale & Items Information */}
              {lookupResult && lookupResult.items && (
                <div className="space-y-5">
                  {/* Sale Metadata Summary Box */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-500 block">Invoice</span>
                      <strong className="text-slate-900 font-mono text-sm">{lookupResult.invoiceNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Store Location</span>
                      <strong className="text-slate-900">{lookupResult.storeName ?? 'Main Branch'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Customer</span>
                      <strong className="text-slate-900">{lookupResult.customerName ?? 'Walk-in Customer'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Sale Date</span>
                      <strong className="text-slate-900">{formatDate(lookupResult.saleDate ?? null)}</strong>
                    </div>
                  </div>

                  {/* Line Items Return Quantities Table */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                      2. Purchased Merchandise & Return Quantities
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="min-w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-3.5 py-2.5">Product</th>
                            <th className="px-3 py-2.5 text-center">Sold Qty</th>
                            <th className="px-3 py-2.5 text-center">Already Ret.</th>
                            <th className="px-3 py-2.5 text-center">Returnable</th>
                            <th className="px-3 py-2.5 text-right">Unit Price</th>
                            <th className="px-3 py-2.5 text-center w-36">Return Qty</th>
                            <th className="px-3.5 py-2.5 text-right">Refund Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lookupResult.items.map((item) => {
                            const currentReturnQty = returnQuantities[item.productId] || 0
                            const isFullyReturned = item.returnableQuantity <= 0

                            return (
                              <tr key={item.productId} className={isFullyReturned ? 'bg-slate-50/50 opacity-60' : 'bg-white'}>
                                <td className="px-3.5 py-3">
                                  <div className="font-semibold text-slate-900">{item.productName}</div>
                                  <div className="text-slate-400 text-[11px] font-mono">SKU: {item.sku ?? '—'}</div>
                                </td>
                                <td className="px-3 py-3 text-center text-slate-700 font-medium">
                                  {item.originalQuantity}
                                </td>
                                <td className="px-3 py-3 text-center text-slate-500">
                                  {item.alreadyReturnedQuantity}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                      isFullyReturned
                                        ? 'bg-slate-100 text-slate-500'
                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }`}
                                  >
                                    {item.returnableQuantity}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-right font-medium text-slate-700 font-mono">
                                  {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {isFullyReturned ? (
                                    <span className="text-slate-400 italic text-[11px]">Fully Returned</span>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleQuantityChange(item, currentReturnQty - 1)}
                                        disabled={currentReturnQty <= 0}
                                        aria-label={`Decrease ${item.productName}`}
                                        className="h-7 w-7 rounded-md border border-slate-300 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        max={item.returnableQuantity}
                                        value={currentReturnQty}
                                        onChange={(e) => handleQuantityChange(item, parseInt(e.target.value) || 0)}
                                        className="w-14 text-center rounded-md border border-slate-300 py-1 font-semibold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleQuantityChange(item, currentReturnQty + 1)}
                                        disabled={currentReturnQty >= item.returnableQuantity}
                                        aria-label={`Increase ${item.productName}`}
                                        className="h-7 w-7 rounded-md border border-slate-300 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition"
                                      >
                                        +
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3.5 py-3 text-right font-bold text-slate-900 font-mono">
                                  {formatCurrency(currentReturnQty * item.unitPrice)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Step 3: Return Reason & Payment Method */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="return-reason-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                        3. Reason for Return
                      </label>
                      <select
                        id="return-reason-select"
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-hidden transition"
                      >
                        <option value="Customer Changed Mind">Customer Changed Mind</option>
                        <option value="Defective / Damaged Product">Defective / Damaged Product</option>
                        <option value="Wrong Item Delivered / Scanned">Wrong Item Delivered / Scanned</option>
                        <option value="Expired / Past Best Before">Expired / Past Best Before</option>
                        <option value="Price Discrepancy / Overcharge">Price Discrepancy / Overcharge</option>
                        <option value="Other">Other (Custom Reason)</option>
                      </select>

                      {returnReason === 'Other' && (
                        <input
                          type="text"
                          placeholder="Specify custom return reason..."
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        />
                      )}
                    </div>

                    <div>
                      <label htmlFor="refund-payment-method" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                        4. Refund Payment Method
                      </label>
                      <select
                        id="refund-payment-method"
                        value={refundMethod}
                        onChange={(e) =>
                          setRefundMethod(
                            e.target.value as
                              | 'cash'
                              | 'upi'
                              | 'credit_card'
                              | 'debit_card'
                              | 'store_credit'
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-hidden transition"
                      >
                        <option value="cash">Cash Settlement</option>
                        <option value="upi">UPI / Instant Transfer</option>
                        <option value="credit_card">Credit Card Refund</option>
                        <option value="debit_card">Debit Card Refund</option>
                        <option value="store_credit">Store Credit / Customer Voucher</option>
                      </select>
                    </div>
                  </div>

                  {/* Financial Summary Banner */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-indigo-950 font-semibold">
                        Merchandise Returning: <span className="text-indigo-700 font-bold">{totalUnitsToReturn} items</span>
                      </div>
                      <div className="text-[11px] text-indigo-700 mt-0.5">
                        Compensating movement &quot;Customer Return&quot; will be appended to immutable ledger.
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-indigo-900 font-medium">Total Refund Amount</div>
                      <div className="text-xl font-extrabold text-indigo-950 font-mono">
                        {formatCurrency(totalRefundAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {submitError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 font-medium flex items-center gap-2">
                  <svg className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                id="btn-process-return-submit"
                disabled={!lookupResult || totalUnitsToReturn <= 0 || isSubmitting}
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                Confirm Return ({totalUnitsToReturn} Units)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              Confirm Reverse Sale & Refund
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to process this return of{' '}
              <strong className="text-slate-900">{totalUnitsToReturn} units</strong> on invoice{' '}
              <span className="font-mono font-semibold text-slate-900">{lookupResult?.invoiceNumber}</span>?
            </p>

            <div className="my-4 rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Refund Amount:</span>
                <strong className="text-slate-900 font-bold">{formatCurrency(totalRefundAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Payment Method:</span>
                <strong className="text-slate-900 capitalize font-sans">{refundMethod.replace('_', ' ')}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Ledger Movement:</span>
                <strong className="text-emerald-700 font-semibold font-sans">+ Customer Return (Restock)</strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                Back to Edit
              </button>
              <button
                type="button"
                id="btn-final-confirm-return"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Yes, Process Return</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successData && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-slate-900">
              Return Completed Successfully
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Compensating ledger movement recorded and refund settlement issued.
            </p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-left space-y-2.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Return Number:</span>
                <strong className="text-indigo-600 font-bold">{successData.returnNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Original Invoice:</span>
                <strong className="text-slate-900">{successData.invoiceNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Units Restocked:</span>
                <strong className="text-emerald-700 font-bold">+{successData.unitsReturned} units</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Refund Issued:</span>
                <strong className="text-slate-900 font-bold">{formatCurrency(successData.refundAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Refund Method:</span>
                <strong className="text-slate-900 capitalize font-sans">{successData.paymentMethod.replace('_', ' ')}</strong>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setSuccessData(null)}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-xs transition"
              >
                Close & View Returns
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Details Drawer / Modal */}
      {(isLoadingDetails || selectedReturnDetails) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Return Details — {selectedReturnDetails?.returnNumber ?? 'Loading...'}
                </h2>
                <p className="text-xs text-slate-500">
                  Detailed breakdown of refunded merchandise and ledger restock movements.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReturnDetails(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {isLoadingDetails ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                  <p>Loading return breakdown...</p>
                </div>
              ) : selectedReturnDetails ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Original Invoice</span>
                      <strong className="text-slate-900 font-mono">{selectedReturnDetails.invoiceNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Store Location</span>
                      <strong className="text-slate-900">{selectedReturnDetails.storeName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Customer</span>
                      <strong className="text-slate-900">{selectedReturnDetails.customerName ?? 'Walk-in Customer'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Date Returned</span>
                      <strong className="text-slate-900">{formatDate(selectedReturnDetails.returnedAt)}</strong>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3.5 text-xs bg-slate-50/50">
                    <span className="text-slate-500">Reason: </span>
                    <strong className="text-slate-900">{selectedReturnDetails.reason ?? 'None specified'}</strong>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase text-slate-700 mb-2">Restocked Items</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="min-w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-3.5 py-2.5">Product</th>
                            <th className="px-3.5 py-2.5 text-center">Restocked Qty</th>
                            <th className="px-3.5 py-2.5 text-right">Unit Price</th>
                            <th className="px-3.5 py-2.5 text-right">Refund Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedReturnDetails.items.map((it) => (
                            <tr key={it.id}>
                              <td className="px-3.5 py-2.5">
                                <span className="font-semibold text-slate-900">{it.productName}</span>
                                {it.sku && <span className="text-slate-400 font-mono ml-2">SKU: {it.sku}</span>}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-bold text-emerald-700 font-mono">
                                +{it.quantity}
                              </td>
                              <td className="px-3.5 py-2.5 text-right text-slate-600 font-mono">
                                {formatCurrency(it.unitPrice)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 font-mono">
                                {formatCurrency(it.refundAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-100 p-3.5 rounded-xl text-sm">
                    <span className="font-semibold text-slate-700">
                      Total Refund ({selectedReturnDetails.paymentMethod ? selectedReturnDetails.paymentMethod.replace('_', ' ') : 'cash'})
                    </span>
                    <span className="text-lg font-extrabold text-slate-900 font-mono">
                      {formatCurrency(selectedReturnDetails.refundAmount)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReturnDetails(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
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
