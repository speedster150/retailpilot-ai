'use client'

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { completeGoodsReceipt, createGoodsReceipt } from './actions'
import type {
  CompleteGoodsReceiptActionState,
  GoodsReceiptActionState,
} from './actions'

export type GoodsReceipt = {
  id: string
  organization_id: string
  receipt_number: string | null
  purchase_order_id: string | null
  store_id: string | null
  received_date: string | null
  status: string | null
  notes: string | null
  purchase_orders:
    | {
        po_number: string | null
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

export type GoodsReceiptItem = {
  goods_receipt_id: string | null
  quantity_received: number | string | null
}

export type PurchaseOrderOption = {
  id: string
  po_number: string | null
  store_id: string | null
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

export type PurchaseOrderItemOption = {
  id: string
  purchase_order_id: string | null
  product_id: string | null
  quantity: number | string | null
  unit_cost: number | string | null
  products:
    | {
        name: string | null
        sku: string | null
      }[]
    | null
    | undefined
}

type DraftReceiptLine = {
  purchaseOrderItemId: string
  productId: string
  quantityReceived: string
  unitCost: string
}

const initialState: GoodsReceiptActionState = {}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
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
    case 'draft':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
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
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-700 active:bg-sky-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition"
    >
      {pending ? (
        <>
          <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Saving Receipt...</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Create Goods Receipt</span>
        </>
      )}
    </button>
  )
}

function CompleteButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      title="Complete receipt and post verified stock to the immutable inventory ledger"
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100 hover:border-indigo-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 transition"
    >
      {pending ? (
        <>
          <svg className="h-3.5 w-3.5 animate-spin text-indigo-700" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Posting...</span>
        </>
      ) : (
        <>
          <span>Complete & Post</span>
          <span aria-hidden="true">&rarr;</span>
        </>
      )}
    </button>
  )
}

function CompleteReceiptForm({ receiptId }: { receiptId: string }) {
  const [state, formAction] = useActionState<
    CompleteGoodsReceiptActionState,
    FormData
  >(completeGoodsReceipt, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      router.refresh()
    }
  }, [router, state.success])

  return (
    <div className="space-y-1.5">
      <form action={formAction}>
        <input type="hidden" name="receipt_id" value={receiptId} />
        <CompleteButton />
      </form>
      {state.error && (
        <p role="alert" className="max-w-xs text-[11px] text-red-600 font-medium">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="max-w-xs text-[11px] text-emerald-600 font-medium">
          {state.success}
        </p>
      )}
    </div>
  )
}

function GoodsReceiptForm({
  purchaseOrders,
  purchaseOrderItems,
  onCancel,
}: {
  purchaseOrders: PurchaseOrderOption[]
  purchaseOrderItems: PurchaseOrderItemOption[]
  onCancel: () => void
}) {
  const [state, formAction] = useActionState(
    createGoodsReceipt,
    initialState
  )
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [lines, setLines] = useState<DraftReceiptLine[]>([])
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      onCancel()
      router.refresh()
    }
  }, [onCancel, router, state.success])

  const selectPurchaseOrder = useCallback(
    (nextPurchaseOrderId: string) => {
      setPurchaseOrderId(nextPurchaseOrderId)
      setLines(
        purchaseOrderItems
          .filter((item) => item.purchase_order_id === nextPurchaseOrderId)
          .map((item) => ({
            purchaseOrderItemId: item.id,
            productId: item.product_id ?? '',
            quantityReceived: '0',
            unitCost: String(item.unit_cost ?? ''),
          }))
      )
    },
    [purchaseOrderItems]
  )

  const updateLine = useCallback(
    (purchaseOrderItemId: string, changes: Partial<DraftReceiptLine>) => {
      setLines((currentLines) =>
        currentLines.map((line) =>
          line.purchaseOrderItemId === purchaseOrderItemId
            ? { ...line, ...changes }
            : line
        )
      )
    },
    []
  )

  const selectedPurchaseOrder = purchaseOrders.find(
    (purchaseOrder) => purchaseOrder.id === purchaseOrderId
  )
  const receivedLines = lines.filter(
    (line) => Number(line.quantityReceived) > 0
  )
  const canSubmit = Boolean(selectedPurchaseOrder && receivedLines.length > 0)
  const totalUnits = receivedLines.reduce(
    (sum, line) => sum + toNumber(line.quantityReceived),
    0
  )

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(receivedLines)} />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">GRN Reference Number</span>
          <input
            required
            name="receipt_number"
            placeholder="e.g. GRN-2026-0001"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Source Purchase Order</span>
          <select
            required
            name="purchase_order_id"
            value={purchaseOrderId}
            onChange={(event) => selectPurchaseOrder(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          >
            <option value="">Select an approved PO</option>
            {purchaseOrders.map((purchaseOrder) => (
              <option key={purchaseOrder.id} value={purchaseOrder.id}>
                {purchaseOrder.po_number ?? purchaseOrder.id}
                {purchaseOrder.stores?.[0]?.name ? ` — ${purchaseOrder.stores[0].name}` : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Receiving Store</span>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 font-medium">
            {selectedPurchaseOrder?.stores?.[0]?.name ?? (
              <span className="text-slate-400 italic">Select a PO first</span>
            )}
            {selectedPurchaseOrder?.stores?.[0]?.code
              ? ` (${selectedPurchaseOrder.stores[0].code})`
              : ''}
          </div>
          <input
            type="hidden"
            name="store_id"
            value={selectedPurchaseOrder?.store_id ?? ''}
            readOnly
          />
        </div>

        <div className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Vendor / Supplier</span>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 font-medium">
            {selectedPurchaseOrder?.suppliers?.[0]?.name ?? (
              <span className="text-slate-400 italic">—</span>
            )}
          </div>
        </div>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Received Date</span>
          <input
            required
            type="date"
            name="received_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-slate-700">Receiving Status</span>
          <select
            name="status"
            defaultValue="draft"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          >
            <option value="draft">Draft (Inspect items before posting)</option>
            <option value="received">Received (Post immediately to Ledger)</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3">
          <span className="font-semibold text-slate-700">Receiving & Condition Notes</span>
          <textarea
            name="notes"
            rows={2}
            placeholder="e.g. Received in good order, airway bill #, temperature check verified..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </label>
      </div>

      {/* Line Items Receiving Section */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-bold text-slate-900">Purchase Order Line Verification</h3>
            <p className="text-xs text-slate-500">
              Verify physical counts against order commitments and enter accepted quantities.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Total Units Received:</span>
            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700 border border-indigo-200 font-mono">
              {totalUnits.toLocaleString('en-IN')} units
            </span>
          </div>
        </div>

        {!purchaseOrderId ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
            Select a purchase order above to load its ordered products and schedule receipt.
          </div>
        ) : lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-6 text-center text-sm text-amber-800 font-medium">
            The selected purchase order does not have any product lines attached.
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => {
              const purchaseOrderItem = purchaseOrderItems.find(
                (item) => item.id === line.purchaseOrderItemId
              )
              const product = purchaseOrderItem?.products?.[0]

              return (
                <div
                  key={line.purchaseOrderItemId}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all"
                >
                  <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
                    <div className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-semibold text-slate-700">Product</span>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                        <span className="font-semibold text-slate-900">{product?.name ?? line.productId}</span>
                        {product?.sku && (
                          <span className="ml-1.5 text-xs text-slate-500 font-mono">
                            ({product.sku})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">Ordered Qty</span>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 font-mono font-medium">
                        {toNumber(purchaseOrderItem?.quantity).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">Qty Received</span>
                      <input
                        required
                        min="0"
                        step="1"
                        type="number"
                        value={line.quantityReceived}
                        onChange={(event) =>
                          updateLine(line.purchaseOrderItemId, {
                            quantityReceived: event.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-bold shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
                      />
                    </label>

                    <label className="space-y-1 text-sm sm:col-span-4">
                      <span className="font-semibold text-slate-700">Accepted Unit Cost (₹)</span>
                      <input
                        required
                        min="0"
                        step="0.01"
                        type="number"
                        value={line.unitCost}
                        onChange={(event) =>
                          updateLine(line.purchaseOrderItemId, {
                            unitCost: event.target.value,
                          })
                        }
                        className="w-full sm:max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Form Action Summary & Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <p className="text-xs text-slate-500 max-w-sm">
          💡 Receipts marked as Received automatically update current stock quantities and post immutable entries to the inventory ledger.
        </p>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-300 transition"
          >
            Cancel
          </button>
          <SubmitButton disabled={!canSubmit} />
        </div>
      </div>

      {!canSubmit && purchaseOrderId && lines.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 font-medium">
          ⚠️ Please specify a received quantity greater than 0 for at least one item before saving.
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

export default function GoodsReceiptManagement({
  receipts,
  receiptItems,
  purchaseOrders,
  purchaseOrderItems,
}: {
  receipts: GoodsReceipt[]
  receiptItems: GoodsReceiptItem[]
  purchaseOrders: PurchaseOrderOption[]
  purchaseOrderItems: PurchaseOrderItemOption[]
}) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const cancelForm = useCallback(() => setIsFormOpen(false), [])

  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of receiptItems) {
      if (item.goods_receipt_id) {
        counts.set(
          item.goods_receipt_id,
          (counts.get(item.goods_receipt_id) ?? 0) + toNumber(item.quantity_received)
        )
      }
    }
    return counts
  }, [receiptItems])

  // Aggregate metrics
  const receivedCount = useMemo(
    () =>
      receipts.filter((r) => {
        const s = (r.status ?? '').toLowerCase()
        return s === 'received' || s === 'completed'
      }).length,
    [receipts]
  )

  const draftCount = useMemo(
    () =>
      receipts.filter((r) => (r.status ?? '').toLowerCase() === 'draft').length,
    [receipts]
  )

  const totalUnitsReceived = useMemo(
    () =>
      receiptItems.reduce(
        (sum, item) => sum + toNumber(item.quantity_received),
        0
      ),
    [receiptItems]
  )

  // Filtered receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (receipt.receipt_number && receipt.receipt_number.toLowerCase().includes(q)) ||
        (receipt.purchase_orders?.[0]?.po_number && receipt.purchase_orders[0].po_number.toLowerCase().includes(q)) ||
        (receipt.stores?.[0]?.name && receipt.stores[0].name.toLowerCase().includes(q)) ||
        (receipt.stores?.[0]?.code && receipt.stores[0].code.toLowerCase().includes(q)) ||
        (receipt.notes && receipt.notes.toLowerCase().includes(q))

      const status = (receipt.status ?? '').toLowerCase()
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'RECEIVED' && (status === 'received' || status === 'completed')) ||
        (statusFilter === 'DRAFT' && status === 'draft')

      return matchesSearch && matchesStatus
    })
  }, [receipts, searchQuery, statusFilter])

  return (
    <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white shadow-2xs shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goods Receipts</h1>
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-200">
              {receipts.length} {receipts.length === 1 ? 'Receipt' : 'Receipts'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 break-words">
            Record physical stock arrivals against purchase orders and post verified ledger movements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen((open) => !open)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-xs transition w-full sm:w-auto shrink-0 max-w-full text-center ${
            isFormOpen
              ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              : 'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:ring-offset-2'
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
              <svg className="h-4 w-4 text-sky-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>+ Create Goods Receipt</span>
            </>
          )}
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Total Receipts">Total Receipts</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100 text-xs shrink-0">
              📥
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{receipts.length}</span>
            <span className="text-xs text-slate-400">records</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Ledger Posted">Ledger Posted</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs shrink-0">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 truncate">{receivedCount}</span>
            <span className="text-xs text-emerald-600">received</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Draft Receipts">Draft Receipts</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-xs shrink-0">
              ⏳
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-amber-700 truncate">{draftCount}</span>
            <span className="text-xs text-amber-600">unposted</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Units Received">Units Received</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-xs shrink-0">
              🔢
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{totalUnitsReceived.toLocaleString('en-IN')}</span>
            <span className="text-xs text-slate-400">units</span>
          </div>
        </div>
      </div>

      {/* Create Goods Receipt Form Drawer/Panel */}
      {isFormOpen && (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-indigo-100 bg-white p-4 sm:p-6 shadow-md transition-all">
          <div className="border-b border-slate-200 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">New Goods Receipt</h2>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                🔒 Inventory Ledger Integration
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Receipts marked as &quot;Received&quot; post permanent purchase movements to the immutable inventory ledger. &quot;Draft&quot; receipts allow physical inspection prior to posting.
            </p>
          </div>
          <GoodsReceiptForm
            purchaseOrders={purchaseOrders}
            purchaseOrderItems={purchaseOrderItems}
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
            placeholder="Search by receipt number, PO number, store, or notes..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-9 py-2 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 transition"
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
            <option value="RECEIVED">Received (Ledger Posted)</option>
            <option value="DRAFT">Draft (Unposted)</option>
          </select>

          <span className="text-xs text-slate-500 whitespace-nowrap pl-1 shrink-0">
            Showing <strong>{filteredReceipts.length}</strong> of {receipts.length}
          </span>
        </div>
      </div>

      {/* Main Table / Empty States */}
      {receipts.length === 0 ? (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 sm:p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            No Goods Receipts Recorded Yet
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Log incoming deliveries against your approved purchase orders to verify counts and post stock changes to the inventory ledger.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition w-full sm:w-auto"
            >
              + Create First Goods Receipt
            </button>
          </div>
        </section>
      ) : filteredReceipts.length === 0 ? (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 sm:p-8 text-center shadow-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800">No matching goods receipts</h3>
          <p className="mt-1 text-xs text-slate-500">
            No goods receipts matched your query or status filter.
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
            <table className="min-w-[950px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-4 sm:px-5 py-3.5 whitespace-nowrap">GRN Number</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 whitespace-nowrap">Purchase Order</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 whitespace-nowrap">Receiving Store</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 whitespace-nowrap">Received Date</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 whitespace-nowrap">Status</th>
                  <th scope="col" className="px-3 sm:px-4 py-3.5 text-right whitespace-nowrap">Units Received</th>
                  <th scope="col" className="px-4 sm:px-5 py-3.5 whitespace-nowrap">Notes</th>
                  <th scope="col" className="px-4 sm:px-5 py-3.5 text-right whitespace-nowrap">Ledger Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="whitespace-nowrap px-4 sm:px-5 py-4">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                        {receipt.receipt_number ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap">
                      <span className="font-mono font-medium text-slate-800 text-xs">
                        {receipt.purchase_orders?.[0]?.po_number ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-4 text-slate-700 max-w-[160px] sm:max-w-xs truncate" title={`${receipt.stores?.[0]?.name ?? ''} ${receipt.stores?.[0]?.code ? `(${receipt.stores[0].code})` : ''}`}>
                      <span className="font-medium text-slate-800">{receipt.stores?.[0]?.name ?? '—'}</span>
                      {receipt.stores?.[0]?.code && (
                        <span className="ml-1 text-[11px] font-mono text-slate-400">
                          ({receipt.stores[0].code})
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-slate-600 text-xs">
                      {formatDate(receipt.received_date)}
                    </td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap">
                      {getStatusBadge(receipt.status)}
                    </td>
                    <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-right">
                      <span className="font-bold text-slate-900 font-mono">
                        {toNumber(itemCounts.get(receipt.id)).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">units</span>
                    </td>
                    <td className="max-w-[200px] px-4 sm:px-5 py-4 text-slate-600 text-xs truncate" title={receipt.notes ?? ''}>
                      {receipt.notes ? (
                        <span className="truncate block">{receipt.notes}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 sm:px-5 py-4 text-right">
                      {receipt.status === 'draft' ? (
                        <CompleteReceiptForm receiptId={receipt.id} />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                          <span>✓</span>
                          <span>Posted to Ledger</span>
                        </span>
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

