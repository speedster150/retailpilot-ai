import type { SupabaseClient } from '@supabase/supabase-js'
import {
  generateExecutiveBusinessReport,
  getMonthDateBoundaries,
  type ExecutiveReportResult,
} from '@/lib/reports/business-report'
import { maskWebhookUrl } from '@/lib/automation/low-stock-alert'

export type MonthlyExecutiveReportPayload = {
  eventId: string
  eventType: 'analytics.monthly_executive_report'
  organizationId: string
  periodMonth: string
  startDate: string
  endDate: string
  executionTimestamp: string
  report: ExecutiveReportResult
  aiExecutiveDiagnostic: string[]
  disclaimer: string
}

export type MonthlyExecutiveReportResult = {
  success: boolean
  reportId: string
  organizationId: string
  periodMonth: string
  startDate: string
  endDate: string
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
  salesPerformance: ExecutiveReportResult['salesPerformance']
  profitability: ExecutiveReportResult['profitability']
  inventoryHealth: ExecutiveReportResult['inventoryHealth']
  supplierLiabilities: ExecutiveReportResult['supplierLiabilities']
  keyRisks: string[]
  recommendedFocusAreas: string[]
  aiExecutiveDiagnostic: string[]
  status: 'dispatched' | 'suppressed_duplicate' | 'failed'
  dispatchedToWebhook: boolean
  responseStatus?: number
  error?: string
}

export type MonthlyExecutiveReportParams = {
  supabase: SupabaseClient
  organizationId: string
  periodMonth?: string | null
  webhookUrl?: string | null
  force?: boolean
  now?: Date
}

/**
 * Currency formatter for executive reporting
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
 * Resolves the target reporting month (YYYY-MM).
 * Defaults to the previous calendar month relative to the current date.
 */
export function resolveReportingMonth(
  periodMonth?: string | null,
  now: Date = new Date()
): {
  valid: boolean
  periodMonth: string
  error?: string
} {
  if (periodMonth && periodMonth.trim()) {
    const trimmed = periodMonth.trim()
    const boundaries = getMonthDateBoundaries(trimmed)
    if (!boundaries.valid) {
      return {
        valid: false,
        periodMonth: trimmed,
        error: boundaries.error,
      }
    }
    return {
      valid: true,
      periodMonth: trimmed,
    }
  }

  // Default to previous calendar month
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const year = prevMonthDate.getUTCFullYear()
  const month = String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')
  const defaultPeriod = `${year}-${month}`

  return {
    valid: true,
    periodMonth: defaultPeriod,
  }
}

/**
 * Synthesizes high-level AI executive diagnostics from genuine report data.
 * Enforces the mandatory "AI-generated recommendation" tag on all items.
 */
export function generateAiExecutiveDiagnostics(
  report: ExecutiveReportResult
): string[] {
  const diagnostics: string[] = []
  const { executiveSummary, inventoryHealth, supplierLiabilities } = report

  // 1. Profitability & Margin Diagnostic
  if (executiveSummary.grossSales > 0) {
    if (executiveSummary.netProfit >= 0) {
      diagnostics.push(
        `AI-generated recommendation: Net profit closed at ${formatCurrency(
          executiveSummary.netProfit
        )} (${executiveSummary.profitMargin}% margin) on ${formatCurrency(
          executiveSummary.grossSales
        )} gross sales. Reinvest operating surplus into high-velocity inventory categories.`
      )
    } else {
      diagnostics.push(
        `AI-generated recommendation: Negative net profit of ${formatCurrency(
          executiveSummary.netProfit
        )} recorded. Audit operating overhead (${formatCurrency(
          executiveSummary.operatingExpenses
        )}) and cost of goods sold (${formatCurrency(
          executiveSummary.cogs
        )}) to re-establish positive operating margins.`
      )
    }
  } else {
    diagnostics.push(
      'AI-generated recommendation: Zero completed sales recorded in the period. Audit POS synchronization, terminal connectivity, and register batch submissions.'
    )
  }

  // 2. Dead-Stock Capital Diagnostics
  if (inventoryHealth.deadStockItemsCount > 0) {
    diagnostics.push(
      `AI-generated recommendation: ${inventoryHealth.deadStockItemsCount} SKUs are stagnant (60+ days without sales), tying up ${formatCurrency(
        inventoryHealth.deadStockValue
      )} in idle working capital. Prioritize promotional clearance bundles or vendor returns to restore liquidity.`
    )
  }

  // 3. Low-Stock Diagnostics
  if (inventoryHealth.lowStockItemsCount > 0) {
    diagnostics.push(
      `AI-generated recommendation: ${inventoryHealth.lowStockItemsCount} items have reached or breached their reorder threshold. Queue replenishment purchase orders to avert revenue loss from out-of-stock positions.`
    )
  }

  // 4. Supplier Liabilities Diagnostics
  if (supplierLiabilities.totalOverdueAmount > 0) {
    diagnostics.push(
      `AI-generated recommendation: CRITICAL - ${formatCurrency(
        supplierLiabilities.totalOverdueAmount
      )} across ${supplierLiabilities.overdueSuppliersCount} suppliers is OVERDUE. Disburse priority payments immediately to preserve trade credit terms and shipment releases.`
    )
  } else if (supplierLiabilities.totalOutstandingAmount > 0) {
    diagnostics.push(
      `AI-generated recommendation: Accounts payable balance of ${formatCurrency(
        supplierLiabilities.totalOutstandingAmount
      )} is current across ${supplierLiabilities.totalSuppliersCount} suppliers. Schedule regular payment batches according to invoice terms.`
    )
  }

  return diagnostics
}

/**
 * Executes the Monthly Executive AI Report automation.
 *
 * Flow:
 * 1. Resolves reporting month (defaults to previous calendar month).
 * 2. Directly reuses generateExecutiveBusinessReport from @/lib/reports/business-report (the exact core underlying generate_business_report MCP tool).
 * 3. Formulates AI executive diagnostics with required disclaimers.
 * 4. Enforces idempotency against public.monthly_executive_reports.
 * 5. Dispatches structured event to Make.com webhook.
 * 6. Logs audit record with masked secrets.
 * 7. Strictly guarantees zero data mutation.
 */
export async function executeMonthlyExecutiveReportAutomation({
  supabase,
  organizationId,
  periodMonth,
  webhookUrl = process.env.MAKE_MONTHLY_REPORT_WEBHOOK_URL,
  force = false,
  now = new Date(),
}: MonthlyExecutiveReportParams): Promise<MonthlyExecutiveReportResult> {
  const periodResolution = resolveReportingMonth(periodMonth, now)

  if (!periodResolution.valid) {
    return {
      success: false,
      reportId: `err_${Date.now()}`,
      organizationId,
      periodMonth: periodMonth ?? '',
      startDate: '',
      endDate: '',
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
      aiExecutiveDiagnostic: [],
      status: 'failed',
      dispatchedToWebhook: false,
      error: periodResolution.error ?? 'Invalid reporting period format.',
    }
  }

  const targetPeriod = periodResolution.periodMonth

  // 1. Check Idempotency / Duplicate Prevention
  let shouldSuppress = false
  if (!force) {
    try {
      const { data: previousReports, error: prevError } = await supabase
        .from('monthly_executive_reports')
        .select('period_month, status, created_at')
        .eq('organization_id', organizationId)
        .eq('period_month', targetPeriod)
        .eq('status', 'dispatched')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!prevError && previousReports && previousReports.length > 0) {
        shouldSuppress = true
      }
    } catch (e: unknown) {
      console.warn('[MonthlyReport] Idempotency lookup warning:', e)
    }
  }

  // 2. Invoke the verified business report service directly
  const reportResult = await generateExecutiveBusinessReport({
    supabase,
    organizationId,
    periodMonth: targetPeriod,
  })

  if (!reportResult.success) {
    return {
      success: false,
      reportId: `err_${Date.now()}`,
      organizationId,
      periodMonth: targetPeriod,
      startDate: reportResult.period?.startDate ?? '',
      endDate: reportResult.period?.endDate ?? '',
      executiveSummary: reportResult.executiveSummary,
      salesPerformance: reportResult.salesPerformance,
      profitability: reportResult.profitability,
      inventoryHealth: reportResult.inventoryHealth,
      supplierLiabilities: reportResult.supplierLiabilities,
      keyRisks: reportResult.keyRisks,
      recommendedFocusAreas: reportResult.recommendedFocusAreas,
      aiExecutiveDiagnostic: [],
      status: 'failed',
      dispatchedToWebhook: false,
      error: reportResult.error ?? 'Failed to generate monthly executive report from database.',
    }
  }

  const aiExecutiveDiagnostic = generateAiExecutiveDiagnostics(reportResult)
  const reportId = `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const disclaimer =
    'AI-generated recommendation: All executive diagnostics and operational recommendations are algorithmically produced based on historical sales, stock levels, and accounts payable data. Business owners and management must review and approve all operational decisions.'

  const resolvedWebhookUrl =
    webhookUrl?.trim() ||
    process.env.MAKE_MONTHLY_REPORT_WEBHOOK_URL?.trim() ||
    ''
  const maskedUrl = maskWebhookUrl(resolvedWebhookUrl)

  let webhookHost: string | undefined
  if (resolvedWebhookUrl) {
    try {
      webhookHost = new URL(resolvedWebhookUrl).hostname
    } catch {
      webhookHost = 'invalid_url'
    }
  }

  console.log(
    `[MonthlyReport] Webhook configured: ${Boolean(resolvedWebhookUrl)}${webhookHost ? ` (${webhookHost})` : ''}, entering dispatch: ${Boolean(resolvedWebhookUrl)}`
  )

  // 3. Handle Duplicate Suppression
  if (shouldSuppress) {
    await logExecutiveReportAuditRecord({
      supabase,
      organizationId,
      periodMonth: targetPeriod,
      reportResult,
      status: 'suppressed_duplicate',
      maskedUrl,
      errorMessage: 'Duplicate monthly report suppressed; report for this period was already dispatched',
    })

    return {
      success: true,
      reportId,
      organizationId,
      periodMonth: targetPeriod,
      startDate: reportResult.period.startDate,
      endDate: reportResult.period.endDate,
      executiveSummary: reportResult.executiveSummary,
      salesPerformance: reportResult.salesPerformance,
      profitability: reportResult.profitability,
      inventoryHealth: reportResult.inventoryHealth,
      supplierLiabilities: reportResult.supplierLiabilities,
      keyRisks: reportResult.keyRisks,
      recommendedFocusAreas: reportResult.recommendedFocusAreas,
      aiExecutiveDiagnostic,
      status: 'suppressed_duplicate',
      dispatchedToWebhook: false,
    }
  }

  // 4. Construct Structured Webhook Payload
  const eventId = `evt_month_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const payload: MonthlyExecutiveReportPayload = {
    eventId,
    eventType: 'analytics.monthly_executive_report',
    organizationId,
    periodMonth: targetPeriod,
    startDate: reportResult.period.startDate,
    endDate: reportResult.period.endDate,
    executionTimestamp: now.toISOString(),
    report: reportResult,
    aiExecutiveDiagnostic,
    disclaimer,
  }

  // 5. Dispatch to Make.com Webhook (Failure Safe)
  let dispatchSuccess = false
  let responseStatus: number | undefined
  let dispatchError: string | undefined

  if (!resolvedWebhookUrl) {
    dispatchError = 'Make.com webhook URL not configured (MAKE_MONTHLY_REPORT_WEBHOOK_URL).'
  } else {
    try {
      const response = await fetch(resolvedWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RetailPilot-AI-Automation/1.0',
        },
        body: JSON.stringify(payload),
      })

      responseStatus = response.status
      if (response.ok) {
        dispatchSuccess = true
      } else {
        dispatchError = `Webhook returned HTTP ${response.status}: ${response.statusText}`
      }
    } catch (err: unknown) {
      dispatchError =
        err instanceof Error
          ? `Webhook dispatch network error: ${err.message}`
          : 'Webhook dispatch failed with unknown network error.'
    }
  }

  const finalStatus: 'dispatched' | 'failed' = dispatchSuccess ? 'dispatched' : 'failed'

  // 6. Record Audit Record in public.monthly_executive_reports
  await logExecutiveReportAuditRecord({
    supabase,
    organizationId,
    periodMonth: targetPeriod,
    reportResult,
    status: finalStatus,
    maskedUrl,
    responseStatus,
    errorMessage: dispatchError,
    payload,
  })

  return {
    success: dispatchSuccess,
    reportId,
    organizationId,
    periodMonth: targetPeriod,
    startDate: reportResult.period.startDate,
    endDate: reportResult.period.endDate,
    executiveSummary: reportResult.executiveSummary,
    salesPerformance: reportResult.salesPerformance,
    profitability: reportResult.profitability,
    inventoryHealth: reportResult.inventoryHealth,
    supplierLiabilities: reportResult.supplierLiabilities,
    keyRisks: reportResult.keyRisks,
    recommendedFocusAreas: reportResult.recommendedFocusAreas,
    aiExecutiveDiagnostic,
    status: finalStatus,
    dispatchedToWebhook: dispatchSuccess,
    responseStatus,
    error: dispatchError,
  }
}

/**
 * Inserts an audit record into public.monthly_executive_reports safely without breaking execution.
 */
async function logExecutiveReportAuditRecord({
  supabase,
  organizationId,
  periodMonth,
  reportResult,
  status,
  maskedUrl,
  responseStatus,
  errorMessage,
  payload,
}: {
  supabase: SupabaseClient
  organizationId: string
  periodMonth: string
  reportResult: ExecutiveReportResult
  status: 'dispatched' | 'failed' | 'suppressed_duplicate'
  maskedUrl: string
  responseStatus?: number
  errorMessage?: string
  payload?: unknown
}): Promise<void> {
  try {
    const summary = reportResult.executiveSummary
    const inv = reportResult.inventoryHealth
    const supp = reportResult.supplierLiabilities

    await supabase.from('monthly_executive_reports').insert({
      organization_id: organizationId,
      period_month: periodMonth,
      gross_revenue: summary.grossSales,
      net_revenue: summary.netSales,
      net_profit: summary.netProfit,
      profit_margin: summary.profitMargin,
      low_stock_count: inv.lowStockItemsCount,
      dead_stock_value: inv.deadStockValue,
      supplier_liabilities: supp.totalOutstandingAmount,
      status,
      webhook_url_masked: maskedUrl,
      response_status: responseStatus ?? null,
      error_message: errorMessage ?? null,
      payload: payload ?? { reportResult },
    })
  } catch (e: unknown) {
    console.warn('[MonthlyReport] Failed to log audit record:', e)
  }
}
