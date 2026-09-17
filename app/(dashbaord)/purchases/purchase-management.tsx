'use client'

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createPurchaseOrder } from './actions'
import type { PurchaseOrderActionState } from './actions'

export type PurchaseOrder = {
  id: string
  po_number: string | null
  status: string | null
  order_date: string | null
  expected_date: string | null
  notes: string | null
  suppliers:
    | {
        name: string | null
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

export type PurchaseOrderItem = {
  purchase_order_id: string | null
  quantity: number | string | null
}

export type ProductOption = {
  id: string
  name: string
  sku: string | null
  is_active: boolean
}

export type SupplierOption = {
  id: string
  name: string
  is_active: boolean
}

export type StoreOption = {
  id: string
  name: string
  code: string | null
  is_active: boolean
}

export type ProductSupplierOption = {
  id: string
  product_id: string
  supplier_id: string
  supplier_sku: string | null
  purchase_price: number | string | null
  minimum_order_quantity: number | string | null
  lead_time_days: number | string | null
  is_preferred: boolean
}

type DraftLine = {
  key: string
  productId: string
  quantity: string
  unitCost: string
}

const initialState: PurchaseOrderActionState = {}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(toNumber(value))
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function getStatusBadge(status: string | null) {
  const normalized = (status ?? '').toLowerCase().trim()

  switch (normalized) {
    case 'received':
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Received
        </span>
      )
    case 'ordered':
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Ordered
        </span>
      )
    case 'partially_received':
    case 'partial':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          Partially Received
        </span>
      )
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Cancelled
        </span>
      )
    case 'draft':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Draft
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

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition w-full sm:w-auto"
    >
      {pending ? (
        <>
          <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Creating Purchase Order...</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Create Purchase Order</span>
        </>
      )}
    </button>
  )
}

function PurchaseOrderForm({
  products,
  suppliers,
  stores,
  productSuppliers,
  onCancel,
}: {
  products: ProductOption[]
  suppliers: SupplierOption[]
  stores: StoreOption[]
  productSuppliers: ProductSupplierOption[]
  onCancel: () => void
}) {
  const [state, formAction] = useActionState(
    createPurchaseOrder,
    initialState
  )
  const [supplierId, setSupplierId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([
    { key: 'line-1', productId: '', quantity: '1', unitCost: '' },
  ])
  const lineNumber = useRef(1)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      onCancel()
      router.refresh()
    }
  }, [onCancel, router, state.success])

  const relationshipFor = useCallback(
    (productId: string, selectedSupplierId: string) => {
      const relationships = productSuppliers.filter(
        (relationship) =>
          relationship.product_id === productId &&
          relationship.supplier_id === selectedSupplierId
      )

      return (
        relationships.find((relationship) => relationship.is_preferred) ??
        relationships[0]
      )
    },
    [productSuppliers]
  )

  const updateLine = useCallback(
    (key: string, changes: Partial<DraftLine>) => {
      setLines((currentLines) =>
        currentLines.map((line) =>
          line.key === key ? { ...line, ...changes } : line
        )
      )
    },
    []
  )

  const selectProduct = useCallback(
    (key: string, productId: string) => {
      const relationship = relationshipFor(productId, supplierId)
      updateLine(key, {
        productId,
        unitCost:
          relationship?.purchase_price === null ||
          relationship?.purchase_price === undefined
            ? ''
            : String(relationship.purchase_price),
      })
    },
    [relationshipFor, supplierId, updateLine]
  )

  const selectSupplier = useCallback(
    (nextSupplierId: string) => {
      setSupplierId(nextSupplierId)
      setLines((currentLines) =>
        currentLines.map((line) => {
          const relationship = relationshipFor(line.productId, nextSupplierId)

          return {
            ...line,
            unitCost:
              relationship?.purchase_price === null ||
              relationship?.purchase_price === undefined
                ? ''
                : String(relationship.purchase_price),
          }
        })
      )
    },
    [relationshipFor]
  )

  const addLine = useCallback(() => {
    lineNumber.current += 1
    setLines((currentLines) => [
      ...currentLines,
      {
        key: `line-${lineNumber.current}`,
        productId: '',
        quantity: '1',
        unitCost: '',
      },
    ])
  }, [])

  const removeLine = useCallback((key: string) => {
    setLines((currentLines) => currentLines.filter((line) => line.key !== key))
  }, [])

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum + toNumber(line.quantity) * toNumber(line.unitCost),
        0
      ),
    [lines]
  )

  const canSubmit =
    products.length > 0 && suppliers.length > 0 && stores.length > 0

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines.map(({ productId, quantity, unitCost }) => ({
            productId,
            quantity,
            unitCost,
          }))
        )}
      />

      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
        <label className="space-y-1.5 text-sm min-w-0">
          <span className="font-semibold text-slate-700">Destination Store</span>
          <select
            required
            name="store_id"
            defaultValue=""
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          >
            <option value="">Select receiving store</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
                {store.code ? ` (${store.code})` : ''}
                {!store.is_active ? ' (Inactive)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm min-w-0">
          <span className="font-semibold text-slate-700">Supplier</span>
          <select
            required
            name="supplier_id"
            value={supplierId}
            onChange={(event) => selectSupplier(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          >
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
                {!supplier.is_active ? ' (Inactive)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm min-w-0">
          <span className="font-semibold text-slate-700">
            Expected Delivery Date
          </span>
          <input
            type="date"
            name="expected_date"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3 min-w-0">
          <span className="font-semibold text-slate-700">Order Notes & Logistics Reference</span>
          <textarea
            name="notes"
            rows={2}
            placeholder="e.g. Special freight instructions, supplier quote ref, payment terms..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>
      </div>

      {/* Order Line Items Section */}
      <div className="space-y-4 pt-2 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">Purchase Order Line Items</h3>
            <p className="text-xs text-slate-500">Specify products, order quantities, and agreed purchase unit rates.</p>
          </div>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition shrink-0"
          >
            <span className="text-indigo-600 font-bold">+</span>
            Add Product Line
          </button>
        </div>

        <div className="space-y-3 min-w-0">
          {lines.map((line, index) => {
            const relationship = relationshipFor(line.productId, supplierId)
            const lineTotal = toNumber(line.quantity) * toNumber(line.unitCost)

            return (
              <div
                key={line.key}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all min-w-0"
              >
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <label className="space-y-1 text-sm min-w-0">
                    <span className="font-semibold text-slate-700">
                      Product #{index + 1}
                    </span>
                    <select
                      required
                      value={line.productId}
                      onChange={(event) =>
                        selectProduct(line.key, event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition min-w-0"
                    >
                      <option value="">Select a product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.sku ? ` (${product.sku})` : ''}
                          {!product.is_active ? ' (Inactive)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-sm min-w-0">
                    <span className="font-semibold text-slate-700">Quantity</span>
                    <input
                      required
                      min="1"
                      step="1"
                      type="number"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: event.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition min-w-0"
                    />
                  </label>

                  <label className="space-y-1 text-sm min-w-0">
                    <span className="font-semibold text-slate-700">Unit Cost (₹)</span>
                    <input
                      required
                      min="0"
                      step="0.01"
                      type="number"
                      value={line.unitCost}
                      onChange={(event) =>
                        updateLine(line.key, { unitCost: event.target.value })
                      }
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition min-w-0"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    title={lines.length === 1 ? 'At least one line item is required' : 'Remove product line'}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:cursor-not-allowed disabled:opacity-40 transition w-full sm:w-auto shrink-0"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 text-xs text-slate-500">
                  <div className="flex items-center gap-2 flex-wrap">
                    {relationship ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 font-medium text-slate-700 border border-slate-200 shadow-2xs flex-wrap">
                        {relationship.is_preferred && (
                          <span className="text-amber-500 font-bold">★ Preferred</span>
                        )}
                        <span>Agreed: {formatCurrency(relationship.purchase_price)}</span>
                        <span>· MOQ: {toNumber(relationship.minimum_order_quantity)}</span>
                        <span>· Lead: {toNumber(relationship.lead_time_days)}d</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">
                        No saved supplier pricing terms. Enter unit rate manually.
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900">
                    Line Total: <span className="text-indigo-600">{formatCurrency(lineTotal)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Form Action Summary & Footer */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-600">Calculated PO Total:</span>
          <span className="text-xl font-bold text-slate-900">{formatCurrency(total)}</span>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-initial rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-300 transition text-center"
          >
            Cancel
          </button>
          <SubmitButton disabled={!canSubmit} />
        </div>
      </div>

      {!canSubmit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 font-medium">
          ⚠️ Please ensure at least one active store, supplier, and product are registered in the system before creating a purchase order.
        </div>
      )}

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
    </form>
  )
}

export default function PurchaseManagement({
  purchaseOrders,
  purchaseOrderItems,
  products,
  suppliers,
  stores,
  productSuppliers,
}: {
  purchaseOrders: PurchaseOrder[]
  purchaseOrderItems: PurchaseOrderItem[]
  products: ProductOption[]
  suppliers: SupplierOption[]
  stores: StoreOption[]
  productSuppliers: ProductSupplierOption[]
}) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const cancelForm = useCallback(() => setIsFormOpen(false), [])

  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of purchaseOrderItems) {
      if (item.purchase_order_id) {
        counts.set(
          item.purchase_order_id,
          (counts.get(item.purchase_order_id) ?? 0) + toNumber(item.quantity)
        )
      }
    }
    return counts
  }, [purchaseOrderItems])

  // Aggregate metrics
  const activeOrdersCount = useMemo(
    () =>
      purchaseOrders.filter((po) => {
        const s = (po.status ?? '').toLowerCase()
        return s === 'ordered' || s === 'pending' || s === 'draft' || s === 'partially_received'
      }).length,
    [purchaseOrders]
  )

  const receivedOrdersCount = useMemo(
    () =>
      purchaseOrders.filter((po) => {
        const s = (po.status ?? '').toLowerCase()
        return s === 'received' || s === 'completed'
      }).length,
    [purchaseOrders]
  )

  const totalUnitsPlanned = useMemo(
    () =>
      purchaseOrderItems.reduce(
        (sum, item) => sum + toNumber(item.quantity),
        0
      ),
    [purchaseOrderItems]
  )

  // Filtered purchase orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (po.po_number && po.po_number.toLowerCase().includes(q)) ||
        (po.suppliers?.[0]?.name && po.suppliers[0].name.toLowerCase().includes(q)) ||
        (po.stores?.[0]?.name && po.stores[0].name.toLowerCase().includes(q)) ||
        (po.stores?.[0]?.code && po.stores[0].code.toLowerCase().includes(q)) ||
        (po.notes && po.notes.toLowerCase().includes(q))

      const status = (po.status ?? '').toLowerCase()
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ORDERED' && (status === 'ordered' || status === 'pending')) ||
        (statusFilter === 'RECEIVED' && (status === 'received' || status === 'completed')) ||
        (statusFilter === 'DRAFT' && status === 'draft') ||
        (statusFilter === 'CANCELLED' && status === 'cancelled')

      return matchesSearch && matchesStatus
    })
  }, [purchaseOrders, searchQuery, statusFilter])

  return (
    <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchases</h1>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              {purchaseOrders.length} {purchaseOrders.length === 1 ? 'Order' : 'Orders'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 break-words">
            Create purchase orders, track incoming supplier shipments, and manage scheduled stock arrivals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen((open) => !open)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-xs transition w-full sm:w-auto shrink-0 max-w-full text-center ${
            isFormOpen
              ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
          }`}
        >
          {isFormOpen ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Close Form</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>+ Create Purchase Order</span>
            </>
          )}
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Total Purchase Orders">Total Purchase Orders</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs shrink-0">
              📋
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{purchaseOrders.length}</span>
            <span className="text-xs text-slate-400">POs</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Active / Inbound">Active / Inbound</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs shrink-0">
              🚚
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-blue-700 truncate">{activeOrdersCount}</span>
            <span className="text-xs text-blue-600">in transit</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Received / Completed">Received / Completed</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs shrink-0">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 truncate">{receivedOrdersCount}</span>
            <span className="text-xs text-emerald-600">fulfilled</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Units Scheduled">Units Scheduled</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-xs shrink-0">
              🔢
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{totalUnitsPlanned.toLocaleString('en-IN')}</span>
            <span className="text-xs text-slate-400">units</span>
          </div>
        </div>
      </div>

      {/* Create Purchase Order Form Drawer/Panel */}
      {isFormOpen && (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-indigo-100 bg-white p-4 sm:p-6 shadow-md transition-all">
          <div className="border-b border-slate-200 pb-4 mb-5">
            <h2 className="text-lg font-bold text-slate-900">New Purchase Order</h2>
            <p className="mt-1 text-xs text-slate-500">
              Creating a PO creates an approved purchasing commitment. Stock ledger updates occur when goods receipts are recorded at store receiving.
            </p>
          </div>
          <PurchaseOrderForm
            products={products}
            suppliers={suppliers}
            stores={stores}
            productSuppliers={productSuppliers}
            onCancel={cancelForm}
          />
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PO number, supplier, store, or notes..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-9 py-2 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
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

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 min-w-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-initial rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition min-w-[140px]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ORDERED">Ordered / Pending</option>
            <option value="RECEIVED">Received / Completed</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <span className="text-xs text-slate-500 whitespace-nowrap pl-1 shrink-0">
            Showing <strong>{filteredOrders.length}</strong> of {purchaseOrders.length}
          </span>
        </div>
      </div>

      {/* Main Table / Empty States */}
      {purchaseOrders.length === 0 ? (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 sm:p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            No Purchase Orders Created Yet
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Organize replenishment orders with your suppliers. Begin by creating your first purchase order using the button below.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition w-full sm:w-auto"
            >
              + Create First Purchase Order
            </button>
          </div>
        </section>
      ) : filteredOrders.length === 0 ? (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 sm:p-8 text-center shadow-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800">No matching purchase orders</h3>
          <p className="mt-1 text-xs text-slate-500">
            No purchase orders matched your search or status filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setStatusFilter('ALL')
            }}
            className="mt-3 inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs w-full sm:w-auto"
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
                  <th scope="col" className="px-4 sm:px-5 py-3.5 whitespace-nowrap">PO Number</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 whitespace-nowrap">Supplier</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 whitespace-nowrap">Destination Store</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 whitespace-nowrap">Status</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 whitespace-nowrap">Order Date</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 whitespace-nowrap">Expected Delivery</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 text-right whitespace-nowrap">Planned Units</th>
                  <th scope="col" className="px-4 sm:px-5 py-3.5 whitespace-nowrap">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((purchaseOrder) => (
                  <tr key={purchaseOrder.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="whitespace-nowrap px-4 sm:px-5 py-4">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                        {purchaseOrder.po_number ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-4 font-semibold text-slate-800 max-w-[180px] sm:max-w-xs truncate" title={purchaseOrder.suppliers?.[0]?.name ?? ''}>
                      {purchaseOrder.suppliers?.[0]?.name ?? '—'}
                    </td>
                    <td className="px-3 sm:px-4 py-4 text-slate-700 max-w-[160px] sm:max-w-xs truncate" title={`${purchaseOrder.stores?.[0]?.name ?? ''} ${purchaseOrder.stores?.[0]?.code ? `(${purchaseOrder.stores[0].code})` : ''}`}>
                      <span className="font-medium text-slate-800">{purchaseOrder.stores?.[0]?.name ?? '—'}</span>
                      {purchaseOrder.stores?.[0]?.code && (
                        <span className="ml-1 text-[11px] font-mono text-slate-400">
                          ({purchaseOrder.stores[0].code})
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap">
                      {getStatusBadge(purchaseOrder.status)}
                    </td>
                    <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-slate-600 text-xs">
                      {formatDate(purchaseOrder.order_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-slate-600 text-xs">
                      {formatDate(purchaseOrder.expected_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-right">
                      <span className="font-bold text-slate-900 font-mono">
                        {toNumber(itemCounts.get(purchaseOrder.id)).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">units</span>
                    </td>
                    <td className="max-w-[200px] px-4 sm:px-5 py-4 text-slate-600 text-xs truncate" title={purchaseOrder.notes ?? ''}>
                      {purchaseOrder.notes ? (
                        <span className="truncate block">{purchaseOrder.notes}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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
