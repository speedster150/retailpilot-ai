import type { AuthenticatedTenantContext } from '@/lib/auth/context'
import { executeMCPTool } from '@/lib/mcp/registry'
import type { ProductStockItem } from '@/lib/inventory/stock'
import type { DeadStockItem } from '@/lib/inventory/dead-stock'
import type { StoreProfitabilityResult } from '@/lib/finance/profitability'
import type { SupplierOutstandingResult } from '@/lib/finance/supplier-outstanding'
import type { ExecutiveReportResult } from '@/lib/reports/business-report'

export type AIAssistantMessageResult = {
  success: boolean
  toolUsed?: string
  toolParams?: Record<string, unknown>
  content: string
  error?: string
}

/**
 * Month names to 2-digit month mapping
 */
const MONTH_MAP: Record<string, string> = {
  january: '01',
  jan: '01',
  february: '02',
  feb: '02',
  march: '03',
  mar: '03',
  april: '04',
  apr: '04',
  may: '05',
  june: '06',
  jun: '06',
  july: '07',
  jul: '07',
  august: '08',
  aug: '08',
  september: '09',
  sep: '09',
  sept: '09',
  october: '10',
  oct: '10',
  november: '11',
  nov: '11',
  december: '12',
  dec: '12',
}

/**
 * Extracts a YYYY-MM month string from user query.
 */
function extractPeriodMonth(query: string): string {
  // Check for direct YYYY-MM
  const directMatch = query.match(/\b(20\d\d)-(0[1-9]|1[0-2])\b/)
  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}`
  }

  // Check for Month Name + Year (e.g. "August 2026", "aug 2026")
  const namedMatch = query.match(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(20\d\d)\b/i
  )
  if (namedMatch) {
    const monthName = namedMatch[1].toLowerCase()
    const year = namedMatch[2]
    const mm = MONTH_MAP[monthName]
    if (mm) {
      return `${year}-${mm}`
    }
  }

  // Default to August 2026 (primary capstone period) or fallback
  return '2026-08'
}

/**
 * Extracts day threshold for dead stock (default: 60)
 */
function extractMinDays(query: string): number {
  const match = query.match(/\b(\d+)\s*(?:days?|d)\b/i)
  if (match) {
    const parsed = parseInt(match[1], 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return 60
}

/**
 * Resolves a store ID for the tenant.
 * If user mentions a store name, matches case-insensitively against tenant stores.
 * If none specified, selects the primary active store of the organization.
 */
async function resolveStoreId(
  query: string,
  context: AuthenticatedTenantContext
): Promise<{ storeId: string; storeName: string } | null> {
  const { data: stores, error } = await context.supabase
    .from('stores')
    .select('id, name')
    .eq('organization_id', context.organizationId)
    .eq('is_active', true)

  if (error || !stores || stores.length === 0) {
    return null
  }

  // Check if any store name is mentioned in the query
  const lowerQuery = query.toLowerCase()
  for (const store of stores) {
    if (store.name && lowerQuery.includes(store.name.toLowerCase())) {
      return { storeId: store.id, storeName: store.name }
    }
  }

  // Fallback to the first store
  return { storeId: stores[0].id, storeName: stores[0].name }
}

/**
 * Resolves start and end dates for profitability analysis.
 */
function resolveProfitabilityDates(query: string): {
  startDate: string
  endDate: string
} {
  // Check for ISO or YYYY-MM-DD date range (e.g. 2026-08-01 to 2026-08-31)
  const rangeMatch = query.match(
    /\b(20\d\d-\d{2}-\d{2})\s*(?:to|through|until|-)\s*(20\d\d-\d{2}-\d{2})\b/i
  )
  if (rangeMatch) {
    return { startDate: rangeMatch[1], endDate: rangeMatch[2] }
  }

  // Check for month reference
  const periodMonth = extractPeriodMonth(query)
  const [yearStr, monthStr] = periodMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const lastDay = new Date(year, month, 0).getDate()
  const padLastDay = String(lastDay).padStart(2, '0')

  return {
    startDate: `${periodMonth}-01`,
    endDate: `${periodMonth}-${padLastDay}`,
  }
}

/**
 * Classifies natural language intent into one of the 5 official MCP tools.
 */
function detectToolIntent(query: string): {
  toolName: string
  confidence: number
} | null {
  const q = query.toLowerCase()

  // 1. Executive / Business Report
  if (
    q.includes('executive report') ||
    q.includes('business report') ||
    q.includes('monthly report') ||
    q.includes('executive summary') ||
    (q.includes('report') && (q.includes('august') || q.includes('2026') || q.includes('month')))
  ) {
    return { toolName: 'generate_business_report', confidence: 0.95 }
  }

  // 2. Dead stock / dormant inventory
  if (
    q.includes('dead stock') ||
    q.includes('dormant') ||
    q.includes('idle stock') ||
    q.includes('no sales') ||
    q.includes('stagnant') ||
    q.includes('slow moving') ||
    q.includes('unsold')
  ) {
    return { toolName: 'get_dead_stock', confidence: 0.95 }
  }

  // 3. Low stock / reorder
  if (
    q.includes('low stock') ||
    q.includes('below reorder') ||
    q.includes('reorder level') ||
    q.includes('out of stock') ||
    q.includes('stockout') ||
    q.includes('replenish') ||
    (q.includes('stock') && (q.includes('low') || q.includes('shortage') || q.includes('items')))
  ) {
    return { toolName: 'get_low_stock_products', confidence: 0.95 }
  }

  // 4. Supplier outstanding / debts / overdue
  if (
    q.includes('overdue') ||
    q.includes('outstanding') ||
    q.includes('unpaid') ||
    q.includes('payable') ||
    (q.includes('owe') && q.includes('money')) ||
    ((q.includes('supplier') || q.includes('vendor')) &&
      (q.includes('debt') ||
        q.includes('balance') ||
        q.includes('due') ||
        q.includes('bill') ||
        q.includes('invoice') ||
        q.includes('liability') ||
        q.includes('liabilities') ||
        q.includes('pay') ||
        q.includes('owe')))
  ) {
    return { toolName: 'get_supplier_outstanding', confidence: 0.95 }
  }

  // 5. Profitability / margins / P&L
  if (
    q.includes('profitability') ||
    q.includes('profit') ||
    q.includes('margin') ||
    q.includes('cogs') ||
    q.includes('net income') ||
    q.includes('gross sales') ||
    q.includes('operating expense')
  ) {
    return { toolName: 'get_profitability', confidence: 0.9 }
  }

  return null
}

/**
 * Currency formatter
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formats response for get_low_stock_products
 */
function formatLowStockResponse(
  data: { totalCount: number; items: ProductStockItem[]; storeFilter?: string }
): string {
  const items = data.items || []

  if (items.length === 0) {
    return `### 📊 Live Database Facts
* **Status:** Healthy inventory levels.
* **Low Stock Count:** 0 items below reorder threshold.
* **Out of Stock Count:** 0 items.

All catalog products are currently operating at or above target safety stock levels.

### 💡 Actionable Insights & Recommendations
* **AI-generated recommendation:** Maintain current supplier replenishment schedules and review seasonal lead times weekly to avoid sudden stockouts.

> ⚠️ **AI-generated recommendation:** Operational recommendations are generated algorithmically to assist store decision-making and must be reviewed by authorized staff before placing purchase orders.`
  }

  const outOfStockCount = items.filter((i) => i.currentStock <= 0).length
  const lowStockCount = items.length - outOfStockCount

  const itemsList = items
    .slice(0, 10)
    .map(
      (item) =>
        `* **${item.productName}** (SKU: \`${item.sku}\`): **${item.currentStock}** in stock (Reorder: ${item.reorderLevel}, Deficit: **${item.deficit}** units) — *[${item.statusLabel}]*`
    )
    .join('\n')

  const truncatedNotice =
    items.length > 10
      ? `\n*... and ${items.length - 10} additional item(s) requiring reorder.*`
      : ''

  return `### 📊 Live Database Facts
* **Total Action Items:** ${data.totalCount} product(s) below reorder threshold.
* **Critically Out of Stock:** ${outOfStockCount} item(s).
* **Low Stock (Below Threshold):** ${lowStockCount} item(s).

#### Affected Inventory:
${itemsList}${truncatedNotice}

### 💡 Actionable Insights & Recommendations
* **AI-generated recommendation:** Prioritize generating draft Purchase Orders immediately for critical items with zero stock to restore safety buffers.
* **AI-generated recommendation:** Consolidate procurement quantities with shared primary vendors to negotiate volume discounts and reduce incoming freight overhead.

> ⚠️ **AI-generated recommendation:** Operational recommendations are generated algorithmically to assist store decision-making and must be reviewed by authorized staff before placing purchase orders.`
}

/**
 * Formats response for get_dead_stock
 */
function formatDeadStockResponse(
  data: {
    totalDeadStockItems: number
    totalDeadStockValue: number
    minDays: number
    items: DeadStockItem[]
  }
): string {
  const items = data.items || []

  if (items.length === 0) {
    return `### 📊 Live Database Facts
* **Dead Stock Items (>${data.minDays} days):** 0 items found.
* **Tied-up Idle Capital:** $0.00.

All active inventory products have recorded sales within the last ${data.minDays} days.

### 💡 Actionable Insights & Recommendations
* **AI-generated recommendation:** Inventory turnover is healthy across categories. Continue monitoring monthly velocity to ensure no products enter dormant status.

> ⚠️ **AI-generated recommendation:** Operational recommendations are generated algorithmically to assist store decision-making and must be reviewed by authorized staff before executing markdown or clearance promotions.`
  }

  const itemsList = items
    .slice(0, 10)
    .map((item) => {
      const daysText =
        item.daysSinceLastSale !== null
          ? `${item.daysSinceLastSale} days since last sale`
          : 'Never sold'
      return `* **${item.productName}** (SKU: \`${item.sku ?? 'N/A'}\`): **${item.currentStock} units** in stock | Unit Cost: ${formatCurrency(item.costPrice)} | Tied-up Capital: **${formatCurrency(item.inventoryValue)}** (${daysText})`
    })
    .join('\n')

  const truncatedNotice =
    items.length > 10
      ? `\n*... and ${items.length - 10} additional dormant product(s).*`
      : ''

  return `### 📊 Live Database Facts
* **Dead Stock Items (>${data.minDays} days with 0 sales):** ${data.totalDeadStockItems} item(s).
* **Total Tied-up Idle Capital:** **${formatCurrency(data.totalDeadStockValue)}**.

#### Dormant Inventory Items:
${itemsList}${truncatedNotice}

### 💡 Actionable Insights & Recommendations
* **AI-generated recommendation:** Launch a targeted clearance campaign or bundle dormant SKUs with complementary top-sellers to recover ${formatCurrency(data.totalDeadStockValue)} in idle working capital.
* **AI-generated recommendation:** Temporarily suspend new purchase orders for these zero-velocity items and review vendor return agreements for eligible buybacks.

> ⚠️ **AI-generated recommendation:** Operational recommendations are generated algorithmically to assist store decision-making and must be reviewed by authorized staff before executing markdown or clearance promotions.`
}

/**
 * Formats response for get_profitability
 */
function formatProfitabilityResponse(
  data: StoreProfitabilityResult,
  storeName?: string
): string {
  const storeLabel = storeName ? ` for **${storeName}**` : ''

  return `### 📊 Live Database Facts
Financial performance${storeLabel} from **${data.startDate}** to **${data.endDate}**:

* **Gross Sales:** **${formatCurrency(data.grossSales)}** (${data.salesCount} transactions, ${data.unitsSold} units sold)
* **Cost of Goods Sold (COGS):** **${formatCurrency(data.cogs)}**
* **Gross Profit:** **${formatCurrency(data.grossProfit)}**
* **Store Operating Expenses:** **${formatCurrency(data.operatingExpenses)}**
* **Net Profit:** **${formatCurrency(data.netProfit)}**
* **Net Profit Margin:** **${data.profitMargin.toFixed(2)}%**

### 💡 Actionable Insights & Recommendations
${
  data.netProfit >= 0
    ? `* **AI-generated recommendation:** Store is operating profitably with a ${data.profitMargin.toFixed(2)}% margin. Reinvest operational cash flow into fast-turning, high-margin inventory categories.`
    : `* **AI-generated recommendation:** Net profit is negative (${formatCurrency(data.netProfit)}). Review store operating expenses and audit product cost-price margins to return to positive cash flow.`
}
* **AI-generated recommendation:** Continuously monitor cost of goods sold variance against supplier price lists to protect product margins against wholesale inflation.

> ⚠️ **AI-generated recommendation:** Operational recommendations are generated algorithmically to assist store decision-making and must be reviewed by authorized store management prior to financial execution.`
}

/**
 * Formats response for get_supplier_outstanding
 */
function formatSupplierOutstandingResponse(
  data: SupplierOutstandingResult
): string {
  const suppliers = data.suppliers || []

  if (suppliers.length === 0) {
    return `### 📊 Live Database Facts
* **Active Suppliers with Outstanding Balance:** 0
* **Total Outstanding Liabilities:** $0.00
* **Overdue Liabilities:** $0.00

All supplier invoices and purchase receipts are fully settled.

### 💡 Actionable Insights & Recommendations
* **AI-generated recommendation:** Excellent accounts payable posture. Maintaining on-time supplier payments positions the business well for negotiating improved commercial terms.

> ⚠️ **AI-generated recommendation:** Operational recommendations are generated algorithmically to assist store decision-making and must be reviewed by authorized staff prior to scheduling disbursements.`
  }

  const suppliersList = suppliers
    .map((s) => {
      const overdueBadge =
        s.totalOverdueAmount > 0
          ? `⚠️ **${formatCurrency(s.totalOverdueAmount)} OVERDUE** (${s.ordersCount} orders)`
          : '✅ Current'
      return `* **${s.supplierName}**: Total Balance: **${formatCurrency(s.totalOutstandingAmount)}** | Status: ${overdueBadge} | Terms: *${s.paymentTerms ?? 'Net 30'}*`
    })
    .join('\n')

  return `### 📊 Live Database Facts
* **Suppliers with Outstanding Balances:** ${data.totalSuppliersCount}
* **Total Outstanding Liabilities:** **${formatCurrency(data.totalOutstandingAmount)}**
* **Total Overdue Liabilities:** **${formatCurrency(data.totalOverdueAmount)}**

#### Supplier Breakdown:
${suppliersList}

### 💡 Actionable Insights & Recommendations
* **AI-generated recommendation:** Settle the **${formatCurrency(data.totalOverdueAmount)}** in overdue supplier balances immediately to avoid delivery holds or vendor credit rating penalties.
* **AI-generated recommendation:** Negotiate Net 45 or Net 60 payment terms with high-volume suppliers to better align payables with inventory cash conversion cycles.

> ⚠️ **AI-generated recommendation:** Operational recommendations are generated algorithmically to assist store decision-making and must be reviewed by authorized staff prior to scheduling disbursements.`
}

/**
 * Formats response for generate_business_report
 */
function formatBusinessReportResponse(data: ExecutiveReportResult): string {
  const perf = data.salesPerformance
  const prof = data.profitability
  const inv = data.inventoryHealth
  const supp = data.supplierLiabilities

  const risksList = (data.keyRisks || [])
    .map((r) => `* ⚠️ **Risk:** ${r}`)
    .join('\n')

  const actionsList = (data.recommendedFocusAreas || [])
    .map((a) => `* **AI-generated recommendation:** ${a}`)
    .join('\n')

  return `### 📊 Live Database Facts: Executive Business Report (${data.period.month})

#### 1. Financial Performance
* **Gross Sales:** **${formatCurrency(perf.grossSales)}** (${perf.salesCount} transactions, ${perf.totalUnitsSold} units sold)
* **COGS:** ${formatCurrency(prof.cogs)} | **Operating Expenses:** ${formatCurrency(prof.operatingExpenses)}
* **Gross Profit:** **${formatCurrency(prof.grossProfit)}**
* **Net Profit:** **${formatCurrency(prof.netProfit)}** (${prof.profitMargin.toFixed(1)}% net margin)

#### 2. Inventory & Supply Chain Health
* **Active Products:** ${inv.totalCatalogItems} | **Total Stock Valuation:** ${formatCurrency(inv.totalInventoryValue)}
* **Low Stock SKUs:** ${inv.lowStockItemsCount} requiring replenishment.
* **Dead Stock Capital:** ${formatCurrency(inv.deadStockValue)} tied up across ${inv.deadStockItemsCount} dormant SKUs.
* **Supplier Liabilities:** ${formatCurrency(supp.totalOutstandingAmount)} (${formatCurrency(supp.totalOverdueAmount)} overdue across ${supp.overdueSuppliersCount} suppliers).

#### 3. Identified Operational Risks:
${risksList || '* No critical risks identified for this period.'}

### 💡 Actionable Insights & Recommendations
${actionsList || '* **AI-generated recommendation:** Continue monitoring daily sales velocity and accounts payable to sustain profitable operations.'}

> ⚠️ **AI-generated recommendation:** The metrics above are calculated directly from immutable store ledger and sales records. Operational recommendations are generated algorithmically to assist leadership decision-making and require store manager sign-off prior to execution.`
}

/**
 * Processes an incoming natural language message from the user,
 * identifies the appropriate MCP tool, executes it using the authenticated
 * server session context, and returns a verified, formatted natural-language response.
 */
export async function processAIAssistantMessage(
  userQuery: string,
  context: AuthenticatedTenantContext
): Promise<AIAssistantMessageResult> {
  const trimmed = userQuery?.trim()
  if (!trimmed) {
    return {
      success: false,
      error: 'Please enter an operational question.',
      content: 'Please enter a valid question or select one of the sample prompts.',
    }
  }

  // 1. Detect Intent
  const intent = detectToolIntent(trimmed)

  if (!intent) {
    return {
      success: true,
      content: `I am your RetailPilot AI Business Assistant connected directly to your store's live MCP data layer.

I can assist you with:
1. **Low Stock Alerts:** *"What products are low in stock?"* or *"Which items are below reorder level?"*
2. **Dead Stock Analysis:** *"Show me dead stock."* or *"Which products have zero sales in 60 days?"*
3. **Store Profitability:** *"What is my profitability?"* or *"Show gross profit and COGS for August 2026."*
4. **Supplier Liabilities:** *"Which suppliers have overdue payments?"* or *"What do we owe vendors?"*
5. **Executive Reports:** *"Generate my executive report for August 2026."*

*Please ask a question relating to your store's inventory, profitability, payables, or executive reports.*`,
    }
  }

  // 2. Prepare Tool Arguments strictly validating against schemas
  let toolParams: Record<string, unknown> = {}
  let storeContextName: string | undefined

  try {
    switch (intent.toolName) {
      case 'get_low_stock_products': {
        toolParams = {
          include_out_of_stock: true,
        }
        break
      }

      case 'get_dead_stock': {
        const minDays = extractMinDays(trimmed)
        toolParams = {
          min_days: minDays,
        }
        break
      }

      case 'get_profitability': {
        const storeInfo = await resolveStoreId(trimmed, context)
        if (!storeInfo) {
          return {
            success: false,
            error: 'No active stores found for your organization.',
            content:
              'No active store locations were found for your organization. Please ensure a store is configured before calculating profitability.',
          }
        }
        storeContextName = storeInfo.storeName
        const dates = resolveProfitabilityDates(trimmed)
        toolParams = {
          store_id: storeInfo.storeId,
          start_date: dates.startDate,
          end_date: dates.endDate,
        }
        break
      }

      case 'get_supplier_outstanding': {
        const isOverdue =
          trimmed.toLowerCase().includes('overdue') ||
          trimmed.toLowerCase().includes('late') ||
          trimmed.toLowerCase().includes('past due')
        toolParams = {
          min_due: 0,
          overdue_only: isOverdue,
        }
        break
      }

      case 'generate_business_report': {
        const periodMonth = extractPeriodMonth(trimmed)
        toolParams = {
          period_month: periodMonth,
        }
        break
      }
    }

    // 3. Execute MCP Tool through official registry layer
    const result = await executeMCPTool(intent.toolName, toolParams, context)

    if (!result.success) {
      return {
        success: false,
        toolUsed: intent.toolName,
        toolParams,
        error: result.error,
        content: `### ⚠️ Data Retrieval Notice\nUnable to retrieve business data using \`${intent.toolName}\`.\n\n*Error details:* ${result.error ?? 'An unexpected operational error occurred.'}`,
      }
    }

    // 4. Synthesize Natural Language Response with Facts and AI-generated recommendation disclaimers
    let content = ''
    switch (intent.toolName) {
      case 'get_low_stock_products':
        content = formatLowStockResponse(
          result.data as {
            totalCount: number
            items: ProductStockItem[]
            storeFilter?: string
          }
        )
        break

      case 'get_dead_stock':
        content = formatDeadStockResponse(
          result.data as {
            totalDeadStockItems: number
            totalDeadStockValue: number
            minDays: number
            items: DeadStockItem[]
          }
        )
        break

      case 'get_profitability':
        content = formatProfitabilityResponse(
          result.data as StoreProfitabilityResult,
          storeContextName
        )
        break

      case 'get_supplier_outstanding':
        content = formatSupplierOutstandingResponse(
          result.data as SupplierOutstandingResult
        )
        break

      case 'generate_business_report':
        content = formatBusinessReportResponse(
          result.data as ExecutiveReportResult
        )
        break
    }

    return {
      success: true,
      toolUsed: intent.toolName,
      toolParams,
      content,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown internal error'
    return {
      success: false,
      error: message,
      content:
        'An operational error occurred while processing your request. Please try again or contact support.',
    }
  }
}
