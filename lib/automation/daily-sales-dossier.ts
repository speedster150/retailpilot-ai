import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/inventory/stock'
import { maskWebhookUrl } from '@/lib/automation/low-stock-alert'

export type TopProductItem = {
  productId: string
  productName: string
  sku: string | null
  unitsSold: number
  totalRevenue: number
}

export type PaymentMethodSummary = {
  method: string
  transactionCount: number
  totalAmount: number
}

export type DailySalesDossierData = {
  organizationId: string
  storeId: string | null
  storeName: string
  businessDate: string
  timezone: string
  startBoundary: string
  endBoundary: string
  grossRevenue: number
  refundAmount: number
  netRevenue: number
  salesCount: number
  refundsCount: number
  totalUnitsSold: number
  topProductsByUnits: TopProductItem[]
  topProductsByRevenue: TopProductItem[]
  paymentMethods: PaymentMethodSummary[]
  executiveSummaryPlan: string[]
  disclaimer: string
}

export type DailySalesDossierPayload = {
  eventId: string
  eventType: 'sales.end_of_day_dossier'
  organizationId: string
  storeId: string | null
  storeName: string
  businessDate: string
  timezone: string
  executionTimestamp: string
  grossRevenue: number
  refundAmount: number
  netRevenue: number
  salesCount: number
  refundsCount: number
  totalUnitsSold: number
  topProducts: TopProductItem[]
  paymentMethods: PaymentMethodSummary[]
  executiveSummaryPlan: string[]
  disclaimer: string
}

export type DailySalesDossierResult = {
  success: boolean
  dossierId: string
  organizationId: string
  storeId: string | null
  businessDate: string
  timezone: string
  grossRevenue: number
  refundAmount: number
  netRevenue: number
  salesCount: number
  refundsCount: number
  totalUnitsSold: number
  topProducts: TopProductItem[]
  paymentMethods: PaymentMethodSummary[]
  executiveSummaryPlan: string[]
  status: 'dispatched' | 'suppressed_duplicate' | 'failed'
  dispatchedToWebhook: boolean
  responseStatus?: number
  error?: string
}

export type DailySalesDossierParams = {
  supabase: SupabaseClient
  organizationId: string
  storeId?: string | null
  businessDate?: string | null
  timezone?: string | null
  webhookUrl?: string | null
  force?: boolean
  now?: Date
}

/**
 * Currency formatter for business reporting
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
 * Validates and calculates start and end UTC timestamps for a given business date string (YYYY-MM-DD).
 * If no business date is provided, defaults to the previous calendar day (yesterday) for midnight EOD runs.
 */
export function getBusinessDayBoundaries(
  businessDateStr?: string | null,
  tz: string = 'UTC',
  now: Date = new Date()
): {
  valid: boolean
  businessDate: string
  startIso: string
  endIso: string
  error?: string
} {
  const effectiveTz = tz.trim() || 'UTC'
  try {
    Intl.DateTimeFormat(undefined, { timeZone: effectiveTz })
  } catch {
    return {
      valid: false,
      businessDate: businessDateStr ?? '',
      startIso: '',
      endIso: '',
      error: `Invalid timezone provided: ${effectiveTz}`,
    }
  }

  let targetDateStr = businessDateStr?.trim()

  if (!targetDateStr) {
    // Default to yesterday's date relative to now in UTC
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    targetDateStr = yesterday.toISOString().slice(0, 10)
  }

  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(targetDateStr)) {
    return {
      valid: false,
      businessDate: targetDateStr,
      startIso: '',
      endIso: '',
      error: 'Invalid business_date format. Expected YYYY-MM-DD (e.g. 2026-09-12).',
    }
  }

  const [yearStr, monthStr, dayStr] = targetDateStr.split('-')
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)
  const day = Number.parseInt(dayStr, 10)

  // Verify valid calendar day
  const testDate = new Date(Date.UTC(year, month - 1, day))
  if (
    testDate.getUTCFullYear() !== year ||
    testDate.getUTCMonth() !== month - 1 ||
    testDate.getUTCDate() !== day
  ) {
    return {
      valid: false,
      businessDate: targetDateStr,
      startIso: '',
      endIso: '',
      error: 'Invalid calendar date provided.',
    }
  }

  // Calculate UTC boundary timestamps for 00:00:00.000 to 23:59:59.999
  const startIso = `${targetDateStr}T00:00:00.000Z`
  const endIso = `${targetDateStr}T23:59:59.999Z`

  return {
    valid: true,
    businessDate: targetDateStr,
    startIso,
    endIso,
  }
}

/**
 * Produces structured executive recommendations for the business owner/manager.
 * Always includes the required "AI-generated recommendation" tag.
 */
export function generateDossierRecommendations(dossier: {
  businessDate: string
  grossRevenue: number
  refundAmount: number
  netRevenue: number
  salesCount: number
  totalUnitsSold: number
  topProductsByRevenue: TopProductItem[]
}): string[] {
  const plans: string[] = []

  if (dossier.salesCount === 0) {
    plans.push(
      `AI-generated recommendation: Zero sales transactions recorded for ${dossier.businessDate}. Verify store operational hours, POS terminal connectivity, and register batch submissions.`
    )
    return plans
  }

  plans.push(
    `AI-generated recommendation: End-of-day revenue closed at ${formatCurrency(
      dossier.netRevenue
    )} net (${formatCurrency(dossier.grossRevenue)} gross across ${
      dossier.salesCount
    } transactions and ${dossier.totalUnitsSold} total units sold).`
  )

  if (dossier.refundAmount > 0) {
    const refundRatio =
      dossier.grossRevenue > 0
        ? Math.round((dossier.refundAmount / dossier.grossRevenue) * 1000) / 10
        : 0
    plans.push(
      `AI-generated recommendation: Total customer refunds of ${formatCurrency(
        dossier.refundAmount
      )} (${refundRatio}% of gross). Conduct quality checks on returned inventory.`
    )
  }

  if (dossier.topProductsByRevenue.length > 0) {
    const topItem = dossier.topProductsByRevenue[0]
    plans.push(
      `AI-generated recommendation: Top revenue driver was "${topItem.productName}" generating ${formatCurrency(
        topItem.totalRevenue
      )} (${topItem.unitsSold} units). Ensure adequate buffer stock for upcoming days.`
    )
  }

  return plans
}

/**
 * Computes the Daily End-of-Day Sales Dossier from genuine database records.
 * Pure read-only operation; zero mutation.
 */
export async function calculateDailySalesDossier({
  supabase,
  organizationId,
  storeId,
  businessDate,
  timezone = 'UTC',
  now = new Date(),
}: {
  supabase: SupabaseClient
  organizationId: string
  storeId?: string | null
  businessDate?: string | null
  timezone?: string | null
  now?: Date
}): Promise<{
  success: boolean
  data?: DailySalesDossierData
  error?: string
}> {
  const effectiveTz = timezone?.trim() || process.env.BUSINESS_TIMEZONE?.trim() || 'UTC'
  const boundaries = getBusinessDayBoundaries(businessDate, effectiveTz, now)

  if (!boundaries.valid) {
    return {
      success: false,
      error: boundaries.error,
    }
  }

  const { startIso, endIso, businessDate: targetDate } = boundaries

  // 1. Resolve store name if storeId is supplied
  let storeName = 'All Stores'
  if (storeId) {
    const { data: storeData } = await supabase
      .from('stores')
      .select('name')
      .eq('organization_id', organizationId)
      .eq('id', storeId)
      .maybeSingle()

    if (storeData?.name) {
      storeName = storeData.name
    }
  }

  // 2. Fetch sales within business date boundaries
  let salesQuery = supabase
    .from('sales')
    .select('id, store_id, total_amount, status, sale_date')
    .eq('organization_id', organizationId)
    .gte('sale_date', startIso)
    .lte('sale_date', endIso)

  if (storeId) {
    salesQuery = salesQuery.eq('store_id', storeId)
  }

  // 3. Fetch returns within business date boundaries
  const returnsQuery = supabase
    .from('returns')
    .select('id, refund_amount, status, returned_at')
    .eq('organization_id', organizationId)
    .gte('returned_at', startIso)
    .lte('returned_at', endIso)

  const [salesResult, returnsResult] = await Promise.all([salesQuery, returnsQuery])

  if (salesResult.error) {
    return {
      success: false,
      error: `Failed to retrieve sales records: ${salesResult.error.message}`,
    }
  }

  if (returnsResult.error) {
    return {
      success: false,
      error: `Failed to retrieve return records: ${returnsResult.error.message}`,
    }
  }

  // Filter valid sales: exclude cancelled, void, refunded
  const validSales = (salesResult.data ?? []).filter((s) => {
    const st = (s.status ?? '').toLowerCase()
    return st !== 'cancelled' && st !== 'void' && st !== 'refunded'
  })

  const grossRevenue =
    Math.round(validSales.reduce((acc, s) => acc + toNumber(s.total_amount), 0) * 100) / 100
  const salesCount = validSales.length

  // Filter valid returns: exclude rejected, cancelled
  const validReturns = (returnsResult.data ?? []).filter((r) => {
    const st = (r.status ?? '').toLowerCase()
    return st !== 'rejected' && st !== 'cancelled'
  })

  const refundAmount =
    Math.round(validReturns.reduce((acc, r) => acc + toNumber(r.refund_amount), 0) * 100) / 100
  const refundsCount = validReturns.length
  const netRevenue = Math.max(0, Math.round((grossRevenue - refundAmount) * 100) / 100)

  // 4. Fetch sale items and product details for top SKUs
  let totalUnitsSold = 0
  const topProductsByUnits: TopProductItem[] = []
  const topProductsByRevenue: TopProductItem[] = []
  const paymentMethods: PaymentMethodSummary[] = []

  const validSaleIds = validSales.map((s) => s.id)

  if (validSaleIds.length > 0) {
    const [itemsResult, paymentsResult] = await Promise.all([
      supabase
        .from('sale_items')
        .select('sale_id, product_id, quantity')
        .in('sale_id', validSaleIds),
      supabase
        .from('payments')
        .select('sale_id, amount, payment_method, payment_status')
        .in('sale_id', validSaleIds),
    ])

    const items = itemsResult.data ?? []
    totalUnitsSold = items.reduce((acc, i) => acc + toNumber(i.quantity), 0)

    const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean)))

    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, selling_price')
        .eq('organization_id', organizationId)
        .in('id', productIds)

      const productMap = new Map<
        string,
        { name: string; sku: string | null; sellingPrice: number }
      >()
      for (const p of products ?? []) {
        productMap.set(p.id, {
          name: p.name,
          sku: p.sku ?? null,
          sellingPrice: toNumber(p.selling_price),
        })
      }

      const productAgg = new Map<string, { units: number; revenue: number }>()
      for (const item of items) {
        const qty = toNumber(item.quantity)
        const pInfo = productMap.get(item.product_id)
        const sp = pInfo?.sellingPrice ?? 0

        const prev = productAgg.get(item.product_id) ?? { units: 0, revenue: 0 }
        productAgg.set(item.product_id, {
          units: prev.units + qty,
          revenue: prev.revenue + qty * sp,
        })
      }

      const allProductItems: TopProductItem[] = []
      for (const [pId, agg] of productAgg.entries()) {
        const pInfo = productMap.get(pId)
        allProductItems.push({
          productId: pId,
          productName: pInfo?.name ?? 'Unknown Product',
          sku: pInfo?.sku ?? null,
          unitsSold: agg.units,
          totalRevenue: Math.round(agg.revenue * 100) / 100,
        })
      }

      // Sort by units
      topProductsByUnits.push(...[...allProductItems].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5))
      // Sort by revenue
      topProductsByRevenue.push(
        ...[...allProductItems].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5)
      )
    }

    // Payment methods aggregation
    const paymentMap = new Map<string, { count: number; amount: number }>()
    for (const p of paymentsResult.data ?? []) {
      const method = (p.payment_method ?? 'other').toLowerCase()
      const amt = toNumber(p.amount)
      const prev = paymentMap.get(method) ?? { count: 0, amount: 0 }
      paymentMap.set(method, {
        count: prev.count + 1,
        amount: prev.amount + amt,
      })
    }

    for (const [method, agg] of paymentMap.entries()) {
      paymentMethods.push({
        method,
        transactionCount: agg.count,
        totalAmount: Math.round(agg.amount * 100) / 100,
      })
    }
  }

  const executiveSummaryPlan = generateDossierRecommendations({
    businessDate: targetDate,
    grossRevenue,
    refundAmount,
    netRevenue,
    salesCount,
    totalUnitsSold,
    topProductsByRevenue,
  })

  return {
    success: true,
    data: {
      organizationId,
      storeId: storeId ?? null,
      storeName,
      businessDate: targetDate,
      timezone: effectiveTz,
      startBoundary: startIso,
      endBoundary: endIso,
      grossRevenue,
      refundAmount,
      netRevenue,
      salesCount,
      refundsCount,
      totalUnitsSold,
      topProductsByUnits,
      topProductsByRevenue,
      paymentMethods,
      executiveSummaryPlan,
      disclaimer:
        'AI-generated end-of-day sales dossier. This automated report is read-only and does not mutate sales, payments, or inventory ledger entries. Prepared for Owner/Manager executive review.',
    },
  }
}

/**
 * Executes the Daily Sales Dossier automation workflow:
 * 1. Computes genuine sales dossier for the target business date.
 * 2. Checks duplicate prevention against public.daily_sales_dossiers.
 * 3. Dispatches structured event to Make.com webhook.
 * 4. Logs audit entry with masked secrets.
 */
export async function executeDailySalesDossierAutomation({
  supabase,
  organizationId,
  storeId,
  businessDate,
  timezone,
  webhookUrl = process.env.MAKE_DAILY_DOSSIER_WEBHOOK_URL,
  force = false,
  now = new Date(),
}: DailySalesDossierParams): Promise<DailySalesDossierResult> {
  const calculationResult = await calculateDailySalesDossier({
    supabase,
    organizationId,
    storeId,
    businessDate,
    timezone,
    now,
  })

  if (!calculationResult.success || !calculationResult.data) {
    return {
      success: false,
      dossierId: `err_${Date.now()}`,
      organizationId,
      storeId: storeId ?? null,
      businessDate: businessDate ?? '',
      timezone: timezone ?? 'UTC',
      grossRevenue: 0,
      refundAmount: 0,
      netRevenue: 0,
      salesCount: 0,
      refundsCount: 0,
      totalUnitsSold: 0,
      topProducts: [],
      paymentMethods: [],
      executiveSummaryPlan: [],
      status: 'failed',
      dispatchedToWebhook: false,
      error: calculationResult.error ?? 'Failed to compute daily sales dossier.',
    }
  }

  const dossier = calculationResult.data
  const dossierId = `dossier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // 1. Duplicate Prevention Check
  let shouldSuppress = false
  if (!force) {
    try {
      let query = supabase
        .from('daily_sales_dossiers')
        .select('gross_revenue, sales_count, status, created_at')
        .eq('organization_id', organizationId)
        .eq('business_date', dossier.businessDate)

      if (dossier.storeId) {
        query = query.eq('store_id', dossier.storeId)
      } else {
        query = query.is('store_id', null)
      }

      const { data: previousDossiers, error: prevError } = await query
        .order('created_at', { ascending: false })
        .limit(1)

      if (!prevError && previousDossiers && previousDossiers.length > 0) {
        const prev = previousDossiers[0]
        if (
          prev.status === 'dispatched' &&
          Number(prev.sales_count) === dossier.salesCount &&
          Number(prev.gross_revenue) === dossier.grossRevenue
        ) {
          shouldSuppress = true
        }
      }
    } catch (e: unknown) {
      console.warn('[DailyDossier] Duplicate lookup warning:', e)
    }
  }

  const resolvedWebhookUrl =
    webhookUrl?.trim() ||
    process.env.MAKE_DAILY_DOSSIER_WEBHOOK_URL?.trim() ||
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
    `[DailyDossier] Webhook configured: ${Boolean(resolvedWebhookUrl)}${webhookHost ? ` (${webhookHost})` : ''}, entering dispatch: ${Boolean(resolvedWebhookUrl)}`
  )

  if (shouldSuppress) {
    await logDossierAuditRecord({
      supabase,
      organizationId,
      dossier,
      status: 'suppressed_duplicate',
      maskedUrl,
      errorMessage: 'Identical dossier already dispatched for this business date with no new transactions',
    })

    return {
      success: true,
      dossierId,
      organizationId,
      storeId: dossier.storeId,
      businessDate: dossier.businessDate,
      timezone: dossier.timezone,
      grossRevenue: dossier.grossRevenue,
      refundAmount: dossier.refundAmount,
      netRevenue: dossier.netRevenue,
      salesCount: dossier.salesCount,
      refundsCount: dossier.refundsCount,
      totalUnitsSold: dossier.totalUnitsSold,
      topProducts: dossier.topProductsByRevenue,
      paymentMethods: dossier.paymentMethods,
      executiveSummaryPlan: dossier.executiveSummaryPlan,
      status: 'suppressed_duplicate',
      dispatchedToWebhook: false,
    }
  }

  // 2. Construct Webhook Payload
  const eventId = `evt_dossier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const payload: DailySalesDossierPayload = {
    eventId,
    eventType: 'sales.end_of_day_dossier',
    organizationId,
    storeId: dossier.storeId,
    storeName: dossier.storeName,
    businessDate: dossier.businessDate,
    timezone: dossier.timezone,
    executionTimestamp: now.toISOString(),
    grossRevenue: dossier.grossRevenue,
    refundAmount: dossier.refundAmount,
    netRevenue: dossier.netRevenue,
    salesCount: dossier.salesCount,
    refundsCount: dossier.refundsCount,
    totalUnitsSold: dossier.totalUnitsSold,
    topProducts: dossier.topProductsByRevenue,
    paymentMethods: dossier.paymentMethods,
    executiveSummaryPlan: dossier.executiveSummaryPlan,
    disclaimer: dossier.disclaimer,
  }

  // 3. Dispatch to Make.com Webhook (Failure Safe)
  let dispatchSuccess = false
  let responseStatus: number | undefined
  let dispatchError: string | undefined

  if (!resolvedWebhookUrl) {
    dispatchError = 'Make.com webhook URL not configured (MAKE_DAILY_DOSSIER_WEBHOOK_URL).'
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

  // 4. Log Audit Record in public.daily_sales_dossiers
  await logDossierAuditRecord({
    supabase,
    organizationId,
    dossier,
    status: finalStatus,
    maskedUrl,
    responseStatus,
    errorMessage: dispatchError,
    payload,
  })

  return {
    success: dispatchSuccess,
    dossierId,
    organizationId,
    storeId: dossier.storeId,
    businessDate: dossier.businessDate,
    timezone: dossier.timezone,
    grossRevenue: dossier.grossRevenue,
    refundAmount: dossier.refundAmount,
    netRevenue: dossier.netRevenue,
    salesCount: dossier.salesCount,
    refundsCount: dossier.refundsCount,
    totalUnitsSold: dossier.totalUnitsSold,
    topProducts: dossier.topProductsByRevenue,
    paymentMethods: dossier.paymentMethods,
    executiveSummaryPlan: dossier.executiveSummaryPlan,
    status: finalStatus,
    dispatchedToWebhook: dispatchSuccess,
    responseStatus,
    error: dispatchError,
  }
}

/**
 * Inserts an audit record into public.daily_sales_dossiers safely without breaking execution.
 */
async function logDossierAuditRecord({
  supabase,
  organizationId,
  dossier,
  status,
  maskedUrl,
  responseStatus,
  errorMessage,
  payload,
}: {
  supabase: SupabaseClient
  organizationId: string
  dossier: DailySalesDossierData
  status: 'dispatched' | 'failed' | 'suppressed_duplicate'
  maskedUrl: string
  responseStatus?: number
  errorMessage?: string
  payload?: unknown
}): Promise<void> {
  try {
    await supabase.from('daily_sales_dossiers').insert({
      organization_id: organizationId,
      store_id: dossier.storeId,
      store_name: dossier.storeName,
      business_date: dossier.businessDate,
      timezone: dossier.timezone,
      gross_revenue: dossier.grossRevenue,
      refund_amount: dossier.refundAmount,
      net_revenue: dossier.netRevenue,
      sales_count: dossier.salesCount,
      refunds_count: dossier.refundsCount,
      total_units_sold: dossier.totalUnitsSold,
      top_products: dossier.topProductsByRevenue,
      payment_methods: dossier.paymentMethods,
      status,
      webhook_url_masked: maskedUrl,
      response_status: responseStatus ?? null,
      error_message: errorMessage ?? null,
      payload: payload ?? { dossier },
    })
  } catch (e: unknown) {
    console.warn('[DailyDossier] Failed to log audit record:', e)
  }
}
