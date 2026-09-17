import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/inventory/stock'

export type StoreProfitabilityParams = {
  supabase: SupabaseClient
  organizationId: string
  storeId: string
  startDate: string
  endDate: string
}

export type StoreProfitabilityResult = {
  success: boolean
  organizationId: string
  storeId: string
  startDate: string
  endDate: string
  grossSales: number
  cogs: number
  operatingExpenses: number
  grossProfit: number
  netProfit: number
  profitMargin: number
  salesCount: number
  unitsSold: number
  error?: string
}

/**
 * Validates and normalizes start and end date strings into ISO timestamps.
 * If provided as YYYY-MM-DD, expands start to 00:00:00.000Z and end to 23:59:59.999Z.
 */
export function normalizeDateRange(
  startStr: string,
  endStr: string
): {
  valid: boolean
  startIso: string
  endIso: string
  error?: string
} {
  if (!startStr || !endStr) {
    return {
      valid: false,
      startIso: '',
      endIso: '',
      error: 'Both start_date and end_date are required.',
    }
  }

  const startDateObj = new Date(startStr)
  const endDateObj = new Date(endStr)

  if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
    return {
      valid: false,
      startIso: '',
      endIso: '',
      error: 'Invalid date format provided. Please use YYYY-MM-DD or valid ISO date strings.',
    }
  }

  const startIso =
    startStr.trim().length === 10 ? `${startStr.trim()}T00:00:00.000Z` : startDateObj.toISOString()
  const endIso =
    endStr.trim().length === 10 ? `${endStr.trim()}T23:59:59.999Z` : endDateObj.toISOString()

  if (new Date(startIso) > new Date(endIso)) {
    return {
      valid: false,
      startIso: '',
      endIso: '',
      error: 'start_date must be earlier than or equal to end_date.',
    }
  }

  return {
    valid: true,
    startIso,
    endIso,
  }
}

/**
 * Calculates store profitability according to the Capstone Requirement:
 * Gross Profit = Gross Sales - COGS
 * Net Profit   = Gross Sales - COGS - Store Operating Expenses
 * Profit Margin = (Net Profit / Gross Sales) * 100
 */
export async function calculateStoreProfitability({
  supabase,
  organizationId,
  storeId,
  startDate,
  endDate,
}: StoreProfitabilityParams): Promise<StoreProfitabilityResult> {
  const dateValidation = normalizeDateRange(startDate, endDate)

  if (!dateValidation.valid) {
    return {
      success: false,
      organizationId,
      storeId,
      startDate,
      endDate,
      grossSales: 0,
      cogs: 0,
      operatingExpenses: 0,
      grossProfit: 0,
      netProfit: 0,
      profitMargin: 0,
      salesCount: 0,
      unitsSold: 0,
      error: dateValidation.error,
    }
  }

  const { startIso, endIso } = dateValidation

  // 1. Fetch completed sales for this store and date range
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, total_amount, status, sale_date')
    .eq('organization_id', organizationId)
    .eq('store_id', storeId)
    .gte('sale_date', startIso)
    .lte('sale_date', endIso)

  if (salesError) {
    return {
      success: false,
      organizationId,
      storeId,
      startDate,
      endDate,
      grossSales: 0,
      cogs: 0,
      operatingExpenses: 0,
      grossProfit: 0,
      netProfit: 0,
      profitMargin: 0,
      salesCount: 0,
      unitsSold: 0,
      error: `Failed to retrieve sales: ${salesError.message}`,
    }
  }

  // Exclude cancelled/void transactions
  const validSales = (sales ?? []).filter((s) => {
    const status = (s.status ?? '').toLowerCase()
    return status !== 'cancelled' && status !== 'void' && status !== 'refunded'
  })

  const rawGrossSales = validSales.reduce(
    (sum, s) => sum + toNumber(s.total_amount),
    0
  )
  const salesCount = validSales.length

  // 2. Fetch sale items and product cost prices to calculate COGS
  let totalCogs = 0
  let totalUnitsSold = 0

  if (validSales.length > 0) {
    const saleIds = validSales.map((s) => s.id)

    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('sale_id, product_id, quantity')
      .in('sale_id', saleIds)

    if (itemsError) {
      return {
        success: false,
        organizationId,
        storeId,
        startDate,
        endDate,
        grossSales: 0,
        cogs: 0,
        operatingExpenses: 0,
        grossProfit: 0,
        netProfit: 0,
        profitMargin: 0,
        salesCount,
        unitsSold: 0,
        error: `Failed to retrieve sale items: ${itemsError.message}`,
      }
    }

    const items = saleItems ?? []
    totalUnitsSold = items.reduce((sum, i) => sum + toNumber(i.quantity), 0)

    const productIds = Array.from(
      new Set(items.map((i) => i.product_id).filter(Boolean))
    )

    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, cost_price')
        .eq('organization_id', organizationId)
        .in('id', productIds)

      if (productsError) {
        return {
          success: false,
          organizationId,
          storeId,
          startDate,
          endDate,
          grossSales: 0,
          cogs: 0,
          operatingExpenses: 0,
          grossProfit: 0,
          netProfit: 0,
          profitMargin: 0,
          salesCount,
          unitsSold: totalUnitsSold,
          error: `Failed to retrieve product cost prices: ${productsError.message}`,
        }
      }

      const costByProduct = new Map<string, number>()
      for (const p of products ?? []) {
        costByProduct.set(p.id, toNumber(p.cost_price))
      }

      for (const item of items) {
        const qty = toNumber(item.quantity)
        const costPrice = costByProduct.get(item.product_id) ?? 0
        totalCogs += qty * costPrice
      }
    }
  }

  // 3. Fetch Store Operating Expenses for this store and date range
  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select('id, amount, status, expense_date')
    .eq('organization_id', organizationId)
    .eq('store_id', storeId)
    .gte('expense_date', startIso)
    .lte('expense_date', endIso)

  if (expensesError) {
    return {
      success: false,
      organizationId,
      storeId,
      startDate,
      endDate,
      grossSales: 0,
      cogs: 0,
      operatingExpenses: 0,
      grossProfit: 0,
      netProfit: 0,
      profitMargin: 0,
      salesCount,
      unitsSold: totalUnitsSold,
      error: `Failed to retrieve operating expenses: ${expensesError.message}`,
    }
  }

  // Exclude cancelled/rejected expenses
  const validExpenses = (expenses ?? []).filter((e) => {
    const status = (e.status ?? '').toLowerCase()
    return status !== 'cancelled' && status !== 'rejected'
  })

  const rawOperatingExpenses = validExpenses.reduce(
    (sum, e) => sum + toNumber(e.amount),
    0
  )

  // 4. Calculate Final Financial Metrics
  const grossSales = Math.round(rawGrossSales * 100) / 100
  const cogs = Math.round(totalCogs * 100) / 100
  const operatingExpenses = Math.round(rawOperatingExpenses * 100) / 100
  const grossProfit = Math.round((grossSales - cogs) * 100) / 100
  const netProfit = Math.round((grossProfit - operatingExpenses) * 100) / 100
  const profitMargin =
    grossSales > 0 ? Math.round((netProfit / grossSales) * 10000) / 100 : 0

  return {
    success: true,
    organizationId,
    storeId,
    startDate,
    endDate,
    grossSales,
    cogs,
    operatingExpenses,
    grossProfit,
    netProfit,
    profitMargin,
    salesCount,
    unitsSold: totalUnitsSold,
  }
}
