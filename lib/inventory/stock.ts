import type { SupabaseClient } from '@supabase/supabase-js'

export type MovementTypeSign =
  | 'sale'
  | 'damage'
  | 'shrinkage'
  | 'transfer_out'
  | 'adjustment_out'
  | 'purchase'
  | 'opening'
  | 'return'
  | 'transfer_in'
  | 'adjustment_in'

export const OUTBOUND_MOVEMENTS = new Set([
  'sale',
  'damage',
  'shrinkage',
  'transfer_out',
  'adjustment_out',
])

export const INBOUND_MOVEMENTS = new Set([
  'purchase',
  'opening',
  'return',
  'customer_return',
  'customer return',
  'transfer_in',
  'adjustment_in',
])

export type StockStatusType = 'out_of_stock' | 'low_stock' | 'in_stock'

export type StockStatusInfo = {
  status: StockStatusType
  label: 'Out of Stock' | 'Low Stock' | 'In Stock'
  className: string
}

export type ProductStockItem = {
  key: string
  productId: string
  productName: string
  sku: string | null
  barcode: string | null
  categoryId: string | null
  storeId: string
  storeName: string
  storeCode: string | null
  currentStock: number
  reorderLevel: number
  costPrice?: number
  createdAt?: string | null
  status: StockStatusType
  statusLabel: 'Out of Stock' | 'Low Stock' | 'In Stock'
  deficit: number
}

export type LedgerMovementLike = {
  movement_type: string | null
  quantity: number | string | null | undefined
}

/**
 * Safe conversion to finite number, defaulting to 0.
 */
export function toNumber(value: number | string | null | undefined): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

/**
 * Authoritative movement sign calculation.
 * Preserves the exact formula established in the project.
 *
 * Outbound: 'sale', 'damage', 'shrinkage', 'transfer_out', 'adjustment_out' -> -|quantity|
 * Inbound:  'purchase', 'opening', 'return', 'transfer_in', 'adjustment_in' -> +|quantity|
 */
export function movementDelta(movement: LedgerMovementLike): number {
  const quantity = toNumber(movement.quantity)
  const type = movement.movement_type?.toLowerCase().trim() ?? ''

  if (OUTBOUND_MOVEMENTS.has(type)) {
    return -Math.abs(quantity)
  }

  if (INBOUND_MOVEMENTS.has(type)) {
    return Math.abs(quantity)
  }

  return quantity
}

/**
 * Authoritative stock status evaluator based on current stock and reorder level.
 */
export function stockStatus(
  currentStock: number,
  reorderLevel: number
): StockStatusInfo {
  if (currentStock <= 0) {
    return {
      status: 'out_of_stock',
      label: 'Out of Stock',
      className: 'bg-red-100 text-red-800',
    }
  }

  if (currentStock <= reorderLevel) {
    return {
      status: 'low_stock',
      label: 'Low Stock',
      className: 'bg-amber-100 text-amber-800',
    }
  }

  return {
    status: 'in_stock',
    label: 'In Stock',
    className: 'bg-green-100 text-green-800',
  }
}

export type StockCalculationFilters = {
  supabase: SupabaseClient
  organizationId: string
  storeId?: string | null
  categoryId?: string | null
  activeOnly?: boolean
}

/**
 * Single source of truth for calculating current stock across an organization.
 * Crucially: Evaluates all matching products, including those with zero ledger movements,
 * so items with 0 stock are accurately captured.
 */
export async function calculateInventoryStock({
  supabase,
  organizationId,
  storeId,
  categoryId,
  activeOnly = true,
}: StockCalculationFilters): Promise<{
  success: boolean
  items?: ProductStockItem[]
  error?: string
}> {
  // 1. Fetch products belonging to the organization
  let productsQuery = supabase
    .from('products')
    .select(
      'id, name, sku, barcode, category_id, reorder_level, is_active, cost_price, created_at'
    )
    .eq('organization_id', organizationId)

  if (activeOnly) {
    productsQuery = productsQuery.eq('is_active', true)
  }

  if (categoryId) {
    productsQuery = productsQuery.eq('category_id', categoryId)
  }

  // 2. Fetch stores belonging to the organization
  let storesQuery = supabase
    .from('stores')
    .select('id, name, code, is_active')
    .eq('organization_id', organizationId)

  if (storeId) {
    storesQuery = storesQuery.eq('id', storeId)
  }

  // 3. Fetch inventory ledger movements belonging to the organization
  let ledgerQuery = supabase
    .from('inventory_ledger')
    .select('id, product_id, store_id, movement_type, quantity')
    .eq('organization_id', organizationId)

  if (storeId) {
    ledgerQuery = ledgerQuery.eq('store_id', storeId)
  }

  const [productsResult, storesResult, ledgerResult] = await Promise.all([
    productsQuery,
    storesQuery,
    ledgerQuery,
  ])

  if (productsResult.error) {
    return {
      success: false,
      error: `Failed to retrieve products: ${productsResult.error.message}`,
    }
  }

  if (storesResult.error) {
    return {
      success: false,
      error: `Failed to retrieve stores: ${storesResult.error.message}`,
    }
  }

  if (ledgerResult.error) {
    return {
      success: false,
      error: `Failed to retrieve inventory ledger: ${ledgerResult.error.message}`,
    }
  }

  const products = productsResult.data ?? []
  const stores = storesResult.data ?? []
  const ledgerRows = ledgerResult.data ?? []

  // Aggregate movements by composite key: `${product_id}:${store_id}`
  const stockByProductStore = new Map<string, number>()

  for (const row of ledgerRows) {
    if (!row.product_id) continue
    const rowStoreId = row.store_id ?? 'no_store'
    const key = `${row.product_id}:${rowStoreId}`
    const delta = movementDelta(row)
    stockByProductStore.set(key, (stockByProductStore.get(key) ?? 0) + delta)
  }

  const stockItems: ProductStockItem[] = []

  // If specific store requested, pair each product with that store
  // If no store requested, pair products with every active store (or default store)
  const targetStores = stores.length > 0 ? stores : [{ id: 'no_store', name: 'Primary Store', code: null }]

  for (const product of products) {
    const reorderLevel = toNumber(product.reorder_level)

    for (const store of targetStores) {
      const key = `${product.id}:${store.id}`
      const currentStock = stockByProductStore.get(key) ?? 0
      const statusInfo = stockStatus(currentStock, reorderLevel)
      const deficit = Math.max(0, reorderLevel - currentStock)

      stockItems.push({
        key,
        productId: product.id,
        productName: product.name ?? 'Unnamed Product',
        sku: product.sku ?? null,
        barcode: product.barcode ?? null,
        categoryId: product.category_id ?? null,
        storeId: store.id,
        storeName: store.name ?? 'Store',
        storeCode: store.code ?? null,
        currentStock,
        reorderLevel,
        costPrice: toNumber(product.cost_price),
        createdAt: product.created_at ?? null,
        status: statusInfo.status,
        statusLabel: statusInfo.label,
        deficit,
      })
    }
  }

  return {
    success: true,
    items: stockItems,
  }
}

export type LowStockProductsQuery = {
  supabase: SupabaseClient
  organizationId: string
  storeId?: string | null
  categoryId?: string | null
  includeOutOfStock?: boolean
}

/**
 * Retrieves low-stock and out-of-stock products for the authenticated organization.
 * Used by UI dashboards and the MCP get_low_stock_products tool.
 */
export async function getLowStockProducts({
  supabase,
  organizationId,
  storeId,
  categoryId,
  includeOutOfStock = true,
}: LowStockProductsQuery): Promise<{
  success: boolean
  products?: ProductStockItem[]
  error?: string
}> {
  const stockResult = await calculateInventoryStock({
    supabase,
    organizationId,
    storeId,
    categoryId,
    activeOnly: true,
  })

  if (!stockResult.success || !stockResult.items) {
    return {
      success: false,
      error: stockResult.error ?? 'Unable to calculate inventory stock.',
    }
  }

  const lowStockItems = stockResult.items.filter((item) => {
    if (!includeOutOfStock && item.status === 'out_of_stock') {
      return false
    }
    return item.status === 'out_of_stock' || item.status === 'low_stock'
  })

  // Sort by highest deficit first, then product name
  lowStockItems.sort((a, b) => {
    if (b.deficit !== a.deficit) {
      return b.deficit - a.deficit
    }
    return a.productName.localeCompare(b.productName)
  })

  return {
    success: true,
    products: lowStockItems,
  }
}
