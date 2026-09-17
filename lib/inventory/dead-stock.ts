import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateInventoryStock,
  toNumber,
  type ProductStockItem,
} from '@/lib/inventory/stock'

export type DeadStockItem = {
  productId: string
  productName: string
  sku: string | null
  storeId: string
  storeName: string
  storeCode: string | null
  currentStock: number
  costPrice: number
  inventoryValue: number
  lastSaleDate: string | null
  daysSinceLastSale: number | null
  deadStockStatus: 'dead_stock' | 'never_sold'
}

export type DeadStockQueryParams = {
  supabase: SupabaseClient
  organizationId: string
  storeId?: string | null
  categoryId?: string | null
  minDays?: number
}

export type DeadStockResult = {
  success: boolean
  organizationId: string
  storeFilter: string
  minDays: number
  totalDeadStockItems: number
  totalDeadStockValue: number
  items: DeadStockItem[]
  error?: string
}

/**
 * Service to identify dead stock for an organization.
 * Reuses the single source of truth for stock calculation (inventory_ledger).
 * Dead stock is defined as items currently in stock (currentStock > 0) with zero sales for minDays+ (default: 60).
 */
export async function getDeadStockProducts({
  supabase,
  organizationId,
  storeId,
  categoryId,
  minDays = 60,
}: DeadStockQueryParams): Promise<DeadStockResult> {
  const effectiveMinDays = Math.max(1, Math.floor(toNumber(minDays) || 60))

  // 1. Authoritatively compute current stock for active products across the organization/store
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
      organizationId,
      storeFilter: storeId ?? 'all_stores',
      minDays: effectiveMinDays,
      totalDeadStockItems: 0,
      totalDeadStockValue: 0,
      items: [],
      error: stockResult.error ?? 'Failed to calculate inventory stock.',
    }
  }

  // Only consider items with positive stock (dead stock represents idle tied-up inventory)
  const positiveStockItems = stockResult.items.filter(
    (item: ProductStockItem) => item.currentStock > 0
  )

  if (positiveStockItems.length === 0) {
    return {
      success: true,
      organizationId,
      storeFilter: storeId ?? 'all_stores',
      minDays: effectiveMinDays,
      totalDeadStockItems: 0,
      totalDeadStockValue: 0,
      items: [],
    }
  }

  const productIds = Array.from(
    new Set(positiveStockItems.map((item: ProductStockItem) => item.productId))
  )

  // 2. Fetch sales activity for these products to determine the last sale date.
  // We check two authoritative sources:
  // Source A: Outbound sales movements in inventory_ledger
  // Source B: Recorded sales in sales / sale_items tables (if present)
  const latestSaleDateByProduct = new Map<string, string>()

  // Query A: inventory_ledger for sale movements
  let ledgerQuery = supabase
    .from('inventory_ledger')
    .select('product_id, store_id, created_at, movement_type, reference_type')
    .eq('organization_id', organizationId)
    .in('product_id', productIds)

  if (storeId) {
    ledgerQuery = ledgerQuery.eq('store_id', storeId)
  }

  const { data: ledgerSales, error: ledgerError } = await ledgerQuery

  if (!ledgerError && ledgerSales) {
    for (const row of ledgerSales) {
      const type = (row.movement_type ?? '').toLowerCase()
      const ref = (row.reference_type ?? '').toLowerCase()
      const isSale =
        type.includes('sale') ||
        type.includes('sold') ||
        ref.includes('sale') ||
        ref.includes('pos')

      if (isSale && row.created_at && row.product_id) {
        const existing = latestSaleDateByProduct.get(row.product_id)
        if (!existing || new Date(row.created_at) > new Date(existing)) {
          latestSaleDateByProduct.set(row.product_id, row.created_at)
        }
      }
    }
  }

  // Query B: sale_items joined with sales (best effort)
  try {
    let salesQuery = supabase
      .from('sales')
      .select('id, sale_date, store_id, status, sale_items!inner(product_id)')
      .eq('organization_id', organizationId)
      .in('sale_items.product_id', productIds)

    if (storeId) {
      salesQuery = salesQuery.eq('store_id', storeId)
    }

    const { data: salesRecords, error: salesError } = await salesQuery

    if (!salesError && salesRecords) {
      for (const sale of salesRecords) {
        const saleDate = sale.sale_date
        const items = sale.sale_items as Array<{ product_id: string }> | undefined
        if (saleDate && Array.isArray(items)) {
          for (const item of items) {
            if (item?.product_id) {
              const existing = latestSaleDateByProduct.get(item.product_id)
              if (!existing || new Date(saleDate) > new Date(existing)) {
                latestSaleDateByProduct.set(item.product_id, saleDate)
              }
            }
          }
        }
      }
    }
  } catch {
    // If sale_items relational join is not available, inventory_ledger remains the fallback
  }

  const now = new Date()
  const deadStockItems: DeadStockItem[] = []

  for (const stockItem of positiveStockItems) {
    const costPrice = toNumber(stockItem.costPrice)
    const inventoryValue = Math.round(stockItem.currentStock * costPrice * 100) / 100
    const lastSaleDate = latestSaleDateByProduct.get(stockItem.productId) ?? null

    if (lastSaleDate) {
      const saleDateObj = new Date(lastSaleDate)
      const diffMs = now.getTime() - saleDateObj.getTime()
      const daysSinceLastSale = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

      if (daysSinceLastSale >= effectiveMinDays) {
        deadStockItems.push({
          productId: stockItem.productId,
          productName: stockItem.productName,
          sku: stockItem.sku,
          storeId: stockItem.storeId,
          storeName: stockItem.storeName,
          storeCode: stockItem.storeCode,
          currentStock: stockItem.currentStock,
          costPrice,
          inventoryValue,
          lastSaleDate,
          daysSinceLastSale,
          deadStockStatus: 'dead_stock',
        })
      }
    } else {
      // Product has NEVER had a sale recorded.
      // Check if product was created at least minDays ago to avoid flagging newly added products.
      const createdAt = stockItem.createdAt ? new Date(stockItem.createdAt) : null
      const daysSinceCreated = createdAt
        ? Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))
        : effectiveMinDays

      if (daysSinceCreated >= effectiveMinDays) {
        deadStockItems.push({
          productId: stockItem.productId,
          productName: stockItem.productName,
          sku: stockItem.sku,
          storeId: stockItem.storeId,
          storeName: stockItem.storeName,
          storeCode: stockItem.storeCode,
          currentStock: stockItem.currentStock,
          costPrice,
          inventoryValue,
          lastSaleDate: null,
          daysSinceLastSale: null,
          deadStockStatus: 'never_sold',
        })
      }
    }
  }

  // Sort primarily by highest inventory value (dead capital) descending, then product name
  deadStockItems.sort((a, b) => {
    if (b.inventoryValue !== a.inventoryValue) {
      return b.inventoryValue - a.inventoryValue
    }
    return a.productName.localeCompare(b.productName)
  })

  const totalDeadStockValue = Math.round(
    deadStockItems.reduce((sum, item) => sum + item.inventoryValue, 0) * 100
  ) / 100

  return {
    success: true,
    organizationId,
    storeFilter: storeId ?? 'all_stores',
    minDays: effectiveMinDays,
    totalDeadStockItems: deadStockItems.length,
    totalDeadStockValue,
    items: deadStockItems,
  }
}
