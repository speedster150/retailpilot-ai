import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateInventoryStock,
  getLowStockProducts,
  toNumber,
  type ProductStockItem,
} from '@/lib/inventory/stock'
import { getDeadStockProducts } from '@/lib/inventory/dead-stock'
import { getSupplierOutstandingBalances } from '@/lib/finance/supplier-outstanding'

export type TopSellingProductItem = {
  productId: string
  productName: string
  sku: string | null
  unitsSold: number
  totalRevenue: number
}

export type ExecutiveReportResult = {
  success: boolean
  organizationId: string
  period: {
    month: string
    startDate: string
    endDate: string
  }
  executiveSummary: {
    grossSales: number
    netSales: number
    cogs: number
    operatingExpenses: number
    grossProfit: number
    netProfit: number
    profitMargin: number
    totalInventoryValue: number
    totalSupplierLiabilities: number
    totalOverdueLiabilities: number
  }
  salesPerformance: {
    grossSales: number
    salesCount: number
    refundAmount: number
    refundsCount: number
    netSales: number
    totalUnitsSold: number
    topSellingProducts: TopSellingProductItem[]
  }
  profitability: {
    grossSales: number
    cogs: number
    operatingExpenses: number
    grossProfit: number
    netProfit: number
    profitMargin: number
  }
  inventoryHealth: {
    totalCatalogItems: number
    totalUnitsOnHand: number
    totalInventoryValue: number
    lowStockItemsCount: number
    deadStockItemsCount: number
    deadStockValue: number
  }
  supplierLiabilities: {
    totalSuppliersCount: number
    totalOutstandingAmount: number
    totalOverdueAmount: number
    overdueSuppliersCount: number
  }
  keyRisks: string[]
  recommendedFocusAreas: string[]
  error?: string
}

export type BusinessReportParams = {
  supabase: SupabaseClient
  organizationId: string
  periodMonth: string
}

/**
 * Validates and calculates calendar month date boundaries for YYYY-MM.
 */
export function getMonthDateBoundaries(periodMonth: string): {
  valid: boolean
  startDate: string
  endDate: string
  error?: string
} {
  if (!periodMonth || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(periodMonth.trim())) {
    return {
      valid: false,
      startDate: '',
      endDate: '',
      error: 'Invalid period_month format. Expected YYYY-MM (e.g. 2026-08).',
    }
  }

  const [yearStr, monthStr] = periodMonth.trim().split('-')
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const startDate = `${yearStr}-${monthStr.padStart(2, '0')}-01T00:00:00.000Z`
  const endDate = `${yearStr}-${monthStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`

  return {
    valid: true,
    startDate,
    endDate,
  }
}

/**
 * Generates an executive AI business report for the organization for a calendar month.
 * Reuses verified stock, dead-stock, and supplier-outstanding calculation services.
 */
export async function generateExecutiveBusinessReport({
  supabase,
  organizationId,
  periodMonth,
}: BusinessReportParams): Promise<ExecutiveReportResult> {
  const boundaries = getMonthDateBoundaries(periodMonth)

  if (!boundaries.valid) {
    return {
      success: false,
      organizationId,
      period: {
        month: periodMonth,
        startDate: '',
        endDate: '',
      },
      executiveSummary: {
        grossSales: 0,
        netSales: 0,
        cogs: 0,
        operatingExpenses: 0,
        grossProfit: 0,
        netProfit: 0,
        profitMargin: 0,
        totalInventoryValue: 0,
        totalSupplierLiabilities: 0,
        totalOverdueLiabilities: 0,
      },
      salesPerformance: {
        grossSales: 0,
        salesCount: 0,
        refundAmount: 0,
        refundsCount: 0,
        netSales: 0,
        totalUnitsSold: 0,
        topSellingProducts: [],
      },
      profitability: {
        grossSales: 0,
        cogs: 0,
        operatingExpenses: 0,
        grossProfit: 0,
        netProfit: 0,
        profitMargin: 0,
      },
      inventoryHealth: {
        totalCatalogItems: 0,
        totalUnitsOnHand: 0,
        totalInventoryValue: 0,
        lowStockItemsCount: 0,
        deadStockItemsCount: 0,
        deadStockValue: 0,
      },
      supplierLiabilities: {
        totalSuppliersCount: 0,
        totalOutstandingAmount: 0,
        totalOverdueAmount: 0,
        overdueSuppliersCount: 0,
      },
      keyRisks: [],
      recommendedFocusAreas: [],
      error: boundaries.error,
    }
  }

  const { startDate, endDate } = boundaries

  // 1. Parallel queries for core monthly transactions and status
  const [
    salesResult,
    returnsResult,
    expensesResult,
    inventoryStockResult,
    lowStockResult,
    deadStockResult,
    supplierResult,
  ] = await Promise.all([
    // Sales in month
    supabase
      .from('sales')
      .select('id, total_amount, status, sale_date')
      .eq('organization_id', organizationId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate),

    // Returns/refunds in month
    supabase
      .from('returns')
      .select('id, refund_amount, status, returned_at')
      .eq('organization_id', organizationId)
      .gte('returned_at', startDate)
      .lte('returned_at', endDate),

    // Operating expenses in month
    supabase
      .from('expenses')
      .select('id, amount, status, expense_date')
      .eq('organization_id', organizationId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate),

    // Authoritative current stock across organization
    calculateInventoryStock({
      supabase,
      organizationId,
      activeOnly: true,
    }),

    // Low stock items
    getLowStockProducts({
      supabase,
      organizationId,
      includeOutOfStock: true,
    }),

    // Dead stock items (60+ days)
    getDeadStockProducts({
      supabase,
      organizationId,
      minDays: 60,
    }),

    // Supplier outstanding balances
    getSupplierOutstandingBalances({
      supabase,
      organizationId,
      minDue: 0,
      overdueOnly: false,
    }),
  ])

  // Process Sales
  const validSales = (salesResult.data ?? []).filter((s) => {
    const st = (s.status ?? '').toLowerCase()
    return st !== 'cancelled' && st !== 'void' && st !== 'refunded'
  })
  const grossSales =
    Math.round(
      validSales.reduce((sum, s) => sum + toNumber(s.total_amount), 0) * 100
    ) / 100
  const salesCount = validSales.length

  // Process Returns / Refunds
  const validReturns = (returnsResult.data ?? []).filter((r) => {
    const st = (r.status ?? '').toLowerCase()
    return st !== 'rejected' && st !== 'cancelled'
  })
  const refundAmount =
    Math.round(
      validReturns.reduce((sum, r) => sum + toNumber(r.refund_amount), 0) * 100
    ) / 100
  const refundsCount = validReturns.length
  const netSales = Math.max(0, Math.round((grossSales - refundAmount) * 100) / 100)

  // Process COGS & Top-Selling Products
  let totalCogs = 0
  let totalUnitsSold = 0
  const topSellingProducts: TopSellingProductItem[] = []

  if (validSales.length > 0) {
    const saleIds = validSales.map((s) => s.id)
    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('sale_id, product_id, quantity')
      .in('sale_id', saleIds)

    const items = saleItems ?? []
    totalUnitsSold = items.reduce((sum, i) => sum + toNumber(i.quantity), 0)

    const productIds = Array.from(
      new Set(items.map((i) => i.product_id).filter(Boolean))
    )

    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, cost_price, selling_price')
        .eq('organization_id', organizationId)
        .in('id', productIds)

      const productMap = new Map<
        string,
        { name: string; sku: string | null; costPrice: number; sellingPrice: number }
      >()
      for (const p of products ?? []) {
        productMap.set(p.id, {
          name: p.name,
          sku: p.sku ?? null,
          costPrice: toNumber(p.cost_price),
          sellingPrice: toNumber(p.selling_price),
        })
      }

      // Aggregate units and revenue per product
      const productSalesAgg = new Map<
        string,
        { units: number; revenue: number }
      >()
      for (const item of items) {
        const qty = toNumber(item.quantity)
        const pInfo = productMap.get(item.product_id)
        const costPrice = pInfo?.costPrice ?? 0
        const sellingPrice = pInfo?.sellingPrice ?? 0

        totalCogs += qty * costPrice

        const prev = productSalesAgg.get(item.product_id) ?? {
          units: 0,
          revenue: 0,
        }
        productSalesAgg.set(item.product_id, {
          units: prev.units + qty,
          revenue: prev.revenue + qty * sellingPrice,
        })
      }

      for (const [pId, agg] of productSalesAgg.entries()) {
        const pInfo = productMap.get(pId)
        topSellingProducts.push({
          productId: pId,
          productName: pInfo?.name ?? 'Product',
          sku: pInfo?.sku ?? null,
          unitsSold: agg.units,
          totalRevenue: Math.round(agg.revenue * 100) / 100,
        })
      }

      topSellingProducts.sort((a, b) => b.unitsSold - a.unitsSold)
    }
  }

  // Process Operating Expenses
  const validExpenses = (expensesResult.data ?? []).filter((e) => {
    const st = (e.status ?? '').toLowerCase()
    return st !== 'cancelled' && st !== 'rejected'
  })
  const operatingExpenses =
    Math.round(
      validExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0) * 100
    ) / 100

  // Profitability calculations
  const cogs = Math.round(totalCogs * 100) / 100
  const grossProfit = Math.round((grossSales - cogs) * 100) / 100
  const netProfit = Math.round((grossProfit - operatingExpenses) * 100) / 100
  const profitMargin =
    grossSales > 0 ? Math.round((netProfit / grossSales) * 10000) / 100 : 0

  // Process Inventory Health
  const stockItems = inventoryStockResult.items ?? []
  const totalCatalogItems = stockItems.length
  const totalUnitsOnHand = stockItems.reduce(
    (sum: number, item: ProductStockItem) => sum + Math.max(0, item.currentStock),
    0
  )
  const totalInventoryValue =
    Math.round(
      stockItems.reduce(
        (sum: number, item: ProductStockItem) =>
          sum + Math.max(0, item.currentStock) * toNumber(item.costPrice),
        0
      ) * 100
    ) / 100

  const lowStockItemsCount = (lowStockResult.products ?? []).length

  const deadStockItemsCount = deadStockResult.totalDeadStockItems ?? 0
  const deadStockValue = deadStockResult.totalDeadStockValue ?? 0

  // Process Supplier Liabilities
  const totalSupplierLiabilities =
    supplierResult.totalOutstandingAmount ?? 0
  const totalOverdueLiabilities = supplierResult.totalOverdueAmount ?? 0
  const totalSuppliersCount = supplierResult.totalSuppliersCount ?? 0
  const overdueSuppliersCount = (supplierResult.suppliers ?? []).filter(
    (s) => s.isOverdue
  ).length

  // Generate Data-Driven Key Risks
  const keyRisks: string[] = []

  if (lowStockItemsCount > 0) {
    keyRisks.push(
      `${lowStockItemsCount} product${lowStockItemsCount > 1 ? 's are' : ' is'} currently below reorder levels or out of stock, risking customer lost sales.`
    )
  }

  if (totalOverdueLiabilities > 0) {
    keyRisks.push(
      `Overdue supplier liabilities stand at ₹${totalOverdueLiabilities.toLocaleString('en-IN')} across ${overdueSuppliersCount} supplier${overdueSuppliersCount > 1 ? 's' : ''}, which may impact supplier credit terms.`
    )
  }

  if (deadStockItemsCount > 0) {
    keyRisks.push(
      `${deadStockItemsCount} dormant inventory item${deadStockItemsCount > 1 ? 's have' : ' has'} zero sales for 60+ days, tying up ₹${deadStockValue.toLocaleString('en-IN')} in working capital.`
    )
  }

  if (netProfit < 0) {
    keyRisks.push(
      `Net profit for ${periodMonth} is negative (loss of ₹${Math.abs(netProfit).toLocaleString('en-IN')}) due to operating expenses exceeding gross profit.`
    )
  }

  if (keyRisks.length === 0) {
    keyRisks.push('No immediate critical risks detected for this operational period.')
  }

  // Generate Data-Driven Recommended Focus Areas
  const recommendedFocusAreas: string[] = []

  if (lowStockItemsCount > 0) {
    recommendedFocusAreas.push(
      `Procurement: Expedite purchase orders for the ${lowStockItemsCount} low-stock inventory item${lowStockItemsCount > 1 ? 's' : ''}.`
    )
  }

  if (overdueSuppliersCount > 0) {
    recommendedFocusAreas.push(
      `Payables: Settle outstanding overdue balance of ₹${totalOverdueLiabilities.toLocaleString('en-IN')} with prioritized suppliers.`
    )
  }

  if (deadStockItemsCount > 0) {
    recommendedFocusAreas.push(
      `Inventory Optimization: Implement promotional bundles or clearance discounts to liquidate ₹${deadStockValue.toLocaleString('en-IN')} of dead stock.`
    )
  }

  if (topSellingProducts.length > 0) {
    recommendedFocusAreas.push(
      `Merchandising: Maintain robust safety stock for top revenue generator "${topSellingProducts[0].productName}".`
    )
  }

  if (recommendedFocusAreas.length === 0) {
    recommendedFocusAreas.push('Maintain standard operational replenishment and billing schedules.')
  }

  return {
    success: true,
    organizationId,
    period: {
      month: periodMonth,
      startDate,
      endDate,
    },
    executiveSummary: {
      grossSales,
      netSales,
      cogs,
      operatingExpenses,
      grossProfit,
      netProfit,
      profitMargin,
      totalInventoryValue,
      totalSupplierLiabilities,
      totalOverdueLiabilities,
    },
    salesPerformance: {
      grossSales,
      salesCount,
      refundAmount,
      refundsCount,
      netSales,
      totalUnitsSold,
      topSellingProducts: topSellingProducts.slice(0, 5),
    },
    profitability: {
      grossSales,
      cogs,
      operatingExpenses,
      grossProfit,
      netProfit,
      profitMargin,
    },
    inventoryHealth: {
      totalCatalogItems,
      totalUnitsOnHand,
      totalInventoryValue,
      lowStockItemsCount,
      deadStockItemsCount,
      deadStockValue,
    },
    supplierLiabilities: {
      totalSuppliersCount,
      totalOutstandingAmount: totalSupplierLiabilities,
      totalOverdueAmount: totalOverdueLiabilities,
      overdueSuppliersCount,
    },
    keyRisks,
    recommendedFocusAreas,
  }
}
