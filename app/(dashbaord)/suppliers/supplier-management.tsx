'use client'

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { saveSupplier } from './actions'
import type { SupplierActionState } from './actions'

export type Supplier = {
  id: string
  organization_id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  payment_terms: string | null
  is_active: boolean
  created_at: string | null
}

export type SupplierPurchaseOrderSummary = {
  id: string
  supplier_id: string | null
  status: string | null
}

const initialState: SupplierActionState = {}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-violet-700 active:bg-violet-800 focus:outline-hidden focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition"
    >
      {pending ? (
        <>
          <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Saving Supplier...</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add Supplier</span>
        </>
      )}
    </button>
  )
}

function SupplierForm({ onCancel }: { onCancel: () => void }) {
  const [state, formAction] = useActionState(saveSupplier, initialState)
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
          <span className="font-semibold text-slate-700">Supplier Name</span>
          <input
            required
            name="name"
            placeholder="e.g. Fresh Dairy Co., Apex Logistics Pvt Ltd"
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
            <option value="true">Active (Eligible for POs)</option>
            <option value="false">Inactive</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Primary Contact Person</span>
          <input
            name="contact_person"
            placeholder="e.g. Rajesh Kumar"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Contact Phone</span>
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
            placeholder="e.g. orders@supplier.com"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Payment & Credit Terms</span>
          <input
            name="payment_terms"
            placeholder="e.g. Net 30, Due on Receipt, 50% Advance"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="font-semibold text-slate-700">Billing / Warehouse Address</span>
          <textarea
            name="address"
            rows={2}
            placeholder="e.g. Plot 12, Industrial Area, Phase II, Bengaluru..."
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

export default function SupplierManagement({
  suppliers,
  purchaseOrders = [],
}: {
  suppliers: Supplier[]
  purchaseOrders?: SupplierPurchaseOrderSummary[]
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const cancelForm = useCallback(() => setIsFormOpen(false), [])

  // Aggregate PO counts per supplier
  const poStats = useMemo(() => {
    const stats = new Map<string, { total: number; active: number }>()
    for (const po of purchaseOrders) {
      if (po.supplier_id) {
        const current = stats.get(po.supplier_id) ?? { total: 0, active: 0 }
        current.total += 1
        const s = (po.status ?? '').toLowerCase()
        if (s === 'ordered' || s === 'pending' || s === 'draft' || s === 'partially_received') {
          current.active += 1
        }
        stats.set(po.supplier_id, current)
      }
    }
    return stats
  }, [purchaseOrders])

  // Summary Metrics
  const activeCount = useMemo(
    () => suppliers.filter((s) => s.is_active).length,
    [suppliers]
  )
  const inactiveCount = useMemo(
    () => suppliers.filter((s) => !s.is_active).length,
    [suppliers]
  )
  const totalOpenPOs = useMemo(() => {
    let count = 0
    for (const val of poStats.values()) {
      count += val.active
    }
    return count
  }, [poStats])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          supplier.name,
          supplier.contact_person,
          supplier.phone,
          supplier.email,
          supplier.payment_terms,
          supplier.address,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery))

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && supplier.is_active) ||
        (statusFilter === 'INACTIVE' && !supplier.is_active)

      return matchesQuery && matchesStatus
    })
  }, [suppliers, normalizedQuery, statusFilter])

  return (
    <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white shadow-2xs shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">Suppliers</h1>
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 border border-violet-200 shrink-0">
              {suppliers.length} {suppliers.length === 1 ? 'Supplier' : 'Suppliers'}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Manage vendor directories, communication channels, and purchasing credit terms.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen((open) => !open)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-xs transition w-full sm:w-auto shrink-0 ${
            isFormOpen
              ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              : 'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 focus:outline-hidden focus:ring-2 focus:ring-violet-500 focus:ring-offset-2'
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
              <svg className="h-4 w-4 text-violet-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>+ Add Supplier</span>
            </>
          )}
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Registered Vendors</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 text-violet-700 border border-violet-100 text-xs shrink-0">
              🏢
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{suppliers.length}</span>
            <span className="text-xs text-slate-400">vendors</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Active Partners</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs shrink-0">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 truncate">{activeCount}</span>
            <span className="text-xs text-emerald-600">available</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Inactive Accounts</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-xs shrink-0">
              💤
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-600 truncate">{inactiveCount}</span>
            <span className="text-xs text-slate-400">archived</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Active Open POs</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs shrink-0">
              📋
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-indigo-700 truncate">{totalOpenPOs}</span>
            <span className="text-xs text-indigo-600">inbound</span>
          </div>
        </div>
      </div>

      {/* Add Supplier Form Drawer */}
      {isFormOpen && (
        <section className="rounded-xl border border-violet-100 bg-white p-4 sm:p-6 shadow-md transition-all w-full min-w-0 max-w-full">
          <div className="border-b border-slate-200 pb-4 mb-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Add New Supplier</h2>
            <p className="mt-1 text-xs text-slate-500">
              Register a supplier to link product procurement pricing and issue approved purchase orders.
            </p>
          </div>
          <SupplierForm onCancel={cancelForm} />
        </section>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs w-full min-w-0 max-w-full">
        <div className="relative flex-1 min-w-0">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by vendor name, contact person, phone, email, terms..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-9 py-2 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-violet-500 focus:outline-hidden focus:ring-2 focus:ring-violet-500/20 transition"
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

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 min-w-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-initial rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Partners Only</option>
            <option value="INACTIVE">Inactive Accounts</option>
          </select>

          <span className="text-xs text-slate-500 whitespace-nowrap pl-1 shrink-0">
            Showing <strong>{filteredSuppliers.length}</strong> of {suppliers.length}
          </span>
        </div>
      </div>

      {/* Main Table / Empty States */}
      {suppliers.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            No Suppliers Registered Yet
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Build your supplier relationships to establish purchasing terms, minimum order quantities, and reliable procurement pipelines.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-violet-700 transition"
            >
              + Add First Supplier
            </button>
          </div>
        </section>
      ) : filteredSuppliers.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center shadow-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800">No matching suppliers</h3>
          <p className="mt-1 text-xs text-slate-500">
            No supplier records matched your search query or filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
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
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-4 sm:px-5 py-3.5">Supplier Name</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5">Primary Contact</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5">Communication Channels</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5">Address / Location</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5">Credit Terms & Orders</th>
                  <th scope="col" className="whitespace-nowrap px-4 sm:px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => {
                  const supplierPOs = poStats.get(supplier.id)

                  return (
                    <tr key={supplier.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {supplier.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          Added {formatDate(supplier.created_at)}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {supplier.contact_person ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800">{supplier.contact_person}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        <div className="space-y-1 text-xs">
                          {supplier.phone ? (
                            <div>
                              <a
                                href={`tel:${supplier.phone}`}
                                className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                📞 {supplier.phone}
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400">No phone</span>
                          )}
                          {supplier.email ? (
                            <div>
                              <a
                                href={`mailto:${supplier.email}`}
                                className="text-slate-600 hover:text-slate-900 hover:underline"
                              >
                                ✉️ {supplier.email}
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      <td className="max-w-xs px-4 py-4 text-slate-600 text-xs" title={supplier.address ?? ''}>
                        {supplier.address ? (
                          <span className="line-clamp-2 leading-relaxed">{supplier.address}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-xs">
                        <div className="space-y-1">
                          {supplier.payment_terms ? (
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-800 border border-slate-200">
                              Terms: {supplier.payment_terms}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No terms set</span>
                          )}
                          {supplierPOs && supplierPOs.total > 0 ? (
                            <div className="text-[11px] text-slate-500 font-medium">
                              {supplierPOs.total} total PO{supplierPOs.total === 1 ? '' : 's'}{' '}
                              {supplierPOs.active > 0 && (
                                <span className="text-blue-600 font-semibold">
                                  ({supplierPOs.active} active)
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">0 orders recorded</div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        {supplier.is_active ? (
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
