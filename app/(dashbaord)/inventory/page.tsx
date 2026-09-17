import { createClient } from '@/lib/supabase/server'
import {
  movementDelta,
  stockStatus,
  toNumber,
  OUTBOUND_MOVEMENTS,
  INBOUND_MOVEMENTS,
} from '@/lib/inventory/stock'
import { INVENTORY_ROLES, type UserRole } from '@/lib/auth/context'
import { LowStockTrigger } from './low-stock-trigger'

type LedgerRow = {
  id: string
  product_id: string | null
  store_id: string | null
  movement_type: string | null
  quantity: number | string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string | null
}

type ProductRecord = {
  id: string
  name: string | null
  sku: string | null
  reorder_level: number | string | null
}

type StoreRecord = {
  id: string
  name: string | null
  code: string | null
}

type InventoryMovement = LedgerRow & {
  product: ProductRecord | null
  store: StoreRecord | null
}

type StockSummary = {
  key: string
  productName: string
  sku: string | null
  storeName: string
  storeCode: string | null
  currentStock: number
  reorderLevel: number
}

function formatNumber(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatMovementType(value: string | null) {
  if (!value) return 'Unknown'

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatReference(movement: InventoryMovement) {
  if (!movement.reference_type && !movement.reference_id) return '—'

  const type = movement.reference_type
    ? formatMovementType(movement.reference_type)
    : 'Reference'

  return movement.reference_id
    ? `${type} · ${movement.reference_id}`
    : type
}

function getMovementBadge(movementType: string | null) {
  const type = movementType?.toLowerCase().trim() ?? ''
  const isOutbound = OUTBOUND_MOVEMENTS.has(type)
  const isInbound = INBOUND_MOVEMENTS.has(type)
  const label = formatMovementType(movementType)

  if (isOutbound) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
        <span aria-hidden="true">&darr;</span>
        {label}
      </span>
    )
  }

  if (isInbound) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
        <span aria-hidden="true">&uarr;</span>
        {label}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
      {label}
    </span>
  )
}

function buildStockSummary(movements: InventoryMovement[]) {
  const summary = new Map<string, StockSummary>()

  for (const movement of movements) {
    const product = movement.product
    const store = movement.store
    const key = `${movement.product_id ?? movement.id}:${movement.store_id ?? 'no-store'}`
    const current = summary.get(key)

    if (current) {
      current.currentStock += movementDelta(movement)
      continue
    }

    summary.set(key, {
      key,
      productName: product?.name ?? 'Unknown product',
      sku: product?.sku ?? null,
      storeName: store?.name ?? 'Unknown store',
      storeCode: store?.code ?? null,
      currentStock: movementDelta(movement),
      reorderLevel: toNumber(product?.reorder_level),
    })
  }

  return Array.from(summary.values()).sort((a, b) =>
    a.productName.localeCompare(b.productName)
  )
}

export default async function InventoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userRole: UserRole | null = null
  if (user) {
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    userRole = (member?.role as UserRole) ?? null
  }

  const isAuthorized = userRole ? INVENTORY_ROLES.has(userRole) : false

  const { data, error } = await supabase
    .from('inventory_ledger')
    .select(`
      id,
      product_id,
      store_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time stock tracking and audit-verified movement history.
          </p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-900 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Unable to load inventory ledger</h2>
              <p className="mt-1 text-sm text-red-700">
                There was an error communicating with the database. Please verify network connectivity and reload the page.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const ledgerRows = (data ?? []) as LedgerRow[]

  const productIds = Array.from(
    new Set(
      ledgerRows
        .map((movement) => movement.product_id)
        .filter((productId): productId is string => Boolean(productId))
    )
  )
  const storeIds = Array.from(
    new Set(
      ledgerRows
        .map((movement) => movement.store_id)
        .filter((storeId): storeId is string => Boolean(storeId))
    )
  )

  const [productsResult, storesResult] = await Promise.all([
    productIds.length > 0
      ? supabase
          .from('products')
          .select('id, name, sku, reorder_level')
          .in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    storeIds.length > 0
      ? supabase.from('stores').select('id, name, code').in('id', storeIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const lookupError = productsResult.error ?? storesResult.error

  if (lookupError) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time stock tracking and audit-verified movement history.
          </p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-900 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Unable to resolve inventory details</h2>
              <p className="mt-1 text-sm text-red-700">
                There was a problem retrieving linked product or store information.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const products = (productsResult.data ?? []) as ProductRecord[]
  const stores = (storesResult.data ?? []) as StoreRecord[]
  const productById = new Map(products.map((product) => [product.id, product]))
  const storeById = new Map(stores.map((store) => [store.id, store]))
  const movements = ledgerRows.map((movement) => ({
    ...movement,
    product: movement.product_id
      ? productById.get(movement.product_id) ?? null
      : null,
    store: movement.store_id
      ? storeById.get(movement.store_id) ?? null
      : null,
  }))
  const stockSummary = buildStockSummary(movements)

  // Calculate high-level summary KPIs
  const inStockCount = stockSummary.filter((s) => s.currentStock > s.reorderLevel).length
  const lowStockCount = stockSummary.filter((s) => s.currentStock > 0 && s.currentStock <= s.reorderLevel).length
  const outOfStockCount = stockSummary.filter((s) => s.currentStock <= 0).length

  return (
    <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 min-w-0">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs mt-0.5 sm:mt-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
              <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-200">
                Immutable Ledger
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 break-words">
              Real-time stock calculations derived directly from the tamper-proof ledger.
            </p>
          </div>
        </div>
        <LowStockTrigger isAuthorized={isAuthorized} userRole={userRole} />
      </div>

      {/* High-Level Stock Health KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Tracked Items">Tracked Items</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700 border border-teal-100 text-xs shrink-0">
              📦
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{stockSummary.length}</span>
            <span className="text-xs text-slate-400">skus</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Healthy Stock">Healthy Stock</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs shrink-0">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 truncate">{inStockCount}</span>
            <span className="text-xs text-emerald-600">optimal</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Low Stock">Low Stock</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-xs shrink-0">
              ⚠️
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-amber-700 truncate">{lowStockCount}</span>
            <span className="text-xs text-amber-600">reorder</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title="Out of Stock">Out of Stock</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-xs shrink-0">
              ✕
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-rose-700 truncate">{outOfStockCount}</span>
            <span className="text-xs text-rose-600">depleted</span>
          </div>
        </div>
      </div>

      {/* Current Stock Section */}
      <section className="w-full min-w-0 max-w-full space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Current Stock</h2>
            <p className="text-xs text-slate-500">
              Aggregated quantities by product and store location.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {stockSummary.length} product-store {stockSummary.length === 1 ? 'pairing' : 'pairings'}
          </span>
        </div>

        {stockSummary.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 sm:p-8 text-center shadow-xs">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No Current Stock Available</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Stock totals are computed automatically once purchase orders, customer returns, or opening balances are recorded in the ledger.
            </p>
          </div>
        ) : (
          <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="w-full overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Product</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">SKU</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Store Location</th>
                    <th scope="col" className="px-4 py-3.5 text-right whitespace-nowrap">Current Stock</th>
                    <th scope="col" className="px-4 py-3.5 text-right whitespace-nowrap">Reorder Threshold</th>
                    <th scope="col" className="px-5 py-3.5 text-center whitespace-nowrap">Stock Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockSummary.map((stock) => {
                    const status = stockStatus(stock.currentStock, stock.reorderLevel)

                    return (
                      <tr key={stock.key} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-900 max-w-[200px] sm:max-w-xs truncate" title={stock.productName}>
                          {stock.productName}
                        </td>
                        <td className="px-4 py-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                          {stock.sku ? (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 border border-slate-200">
                              {stock.sku}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-700 max-w-[160px] sm:max-w-xs truncate" title={stock.storeName}>
                          <div className="font-medium truncate">{stock.storeName}</div>
                          {stock.storeCode && (
                            <div className="text-[11px] text-slate-400 font-mono">Code: {stock.storeCode}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <span
                            className={`text-base font-bold ${
                              stock.currentStock <= 0
                                ? 'text-rose-600'
                                : stock.currentStock <= stock.reorderLevel
                                ? 'text-amber-600'
                                : 'text-slate-900'
                            }`}
                          >
                            {formatNumber(stock.currentStock)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-slate-600 text-xs whitespace-nowrap">
                          <span className="rounded-md bg-slate-50 px-2 py-1 border border-slate-200 font-medium">
                            Min: {formatNumber(stock.reorderLevel)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          {status.status === 'in_stock' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              In Stock
                            </span>
                          )}
                          {status.status === 'low_stock' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Low Stock
                            </span>
                          )}
                          {status.status === 'out_of_stock' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              Out of Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Movement History Section */}
      <section className="w-full min-w-0 max-w-full space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Movement History</h2>
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                🔒 Append-Only
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Audit log of all inventory transitions. Past entries cannot be edited or deleted.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {movements.length} {movements.length === 1 ? 'record' : 'records'} logged
          </span>
        </div>

        {movements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 sm:p-8 text-center shadow-xs">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No Movement Records</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Inventory movements are immutably logged whenever products are received, sold, returned, or adjusted.
            </p>
          </div>
        ) : (
          <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="w-full overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Product & SKU</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Movement Type</th>
                    <th scope="col" className="px-4 py-3.5 text-right whitespace-nowrap">Ledger Impact</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Store Location</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Reference Source</th>
                    <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((movement) => {
                    const product = movement.product
                    const store = movement.store
                    const delta = movementDelta(movement)

                    return (
                      <tr key={movement.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 max-w-[220px] truncate" title={product?.name ?? 'Unknown product'}>
                          <p className="font-semibold text-slate-900 truncate">
                            {product?.name ?? 'Unknown product'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 font-mono truncate">
                            SKU: {product?.sku ? (
                              <span className="text-slate-700 font-medium">{product.sku}</span>
                            ) : (
                              '—'
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {getMovementBadge(movement.movement_type)}
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <span
                            className={`text-sm font-bold font-mono ${
                              delta > 0
                                ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200'
                                : delta < 0
                                ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200'
                                : 'text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200'
                            }`}
                          >
                            {delta > 0 ? `+${formatNumber(delta)}` : formatNumber(delta)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-700 max-w-[160px] sm:max-w-xs truncate" title={store?.name ?? 'Unknown store'}>
                          <div className="font-medium text-slate-800 truncate">{store?.name ?? 'Unknown store'}</div>
                          {store?.code && (
                            <div className="text-[11px] text-slate-400 font-mono">Code: {store.code}</div>
                          )}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-4 text-slate-700 text-xs" title={formatReference(movement)}>
                          <span className="font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 truncate inline-block max-w-full">
                            {formatReference(movement)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 text-xs">
                          {formatDate(movement.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
