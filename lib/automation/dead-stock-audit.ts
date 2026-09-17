import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getDeadStockProducts,
  type DeadStockItem,
} from '@/lib/inventory/dead-stock'
import { maskWebhookUrl } from '@/lib/automation/low-stock-alert'

export type DeadStockSeverity = 'critical' | 'high' | 'medium' | 'low'

export type DeadStockItemPlan = DeadStockItem & {
  severity: DeadStockSeverity
  suggestedAction: string
  recommendation: string
}

export type DeadStockAuditPayload = {
  eventId: string
  eventType: 'inventory.dead_stock_biweekly_audit'
  cadence: 'bi_weekly'
  organizationId: string
  storeFilter: string
  executionTimestamp: string
  totalDeadStockItems: number
  totalTiedUpCapital: number
  items: DeadStockItemPlan[]
  liquidationPlan: string[]
  disclaimer: string
}

export type DeadStockAuditResult = {
  success: boolean
  auditId: string
  organizationId: string
  storeFilter: string
  totalDeadStockItems: number
  totalTiedUpCapital: number
  items: DeadStockItemPlan[]
  liquidationPlan: string[]
  disclaimer: string
  dispatchedToWebhook: boolean
  webhookConfigured?: boolean
  webhookHost?: string
  responseStatus?: number
  error?: string
}

export type DeadStockAuditParams = {
  supabase: SupabaseClient
  organizationId: string
  storeId?: string | null
  categoryId?: string | null
  webhookUrl?: string | null
}

/**
 * Currency formatter for financial recommendations
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
 * Evaluates an individual dead-stock item and produces a structured liquidation strategy.
 * Every recommendation explicitly incorporates the required "AI-generated recommendation" tag.
 */
export function generateItemLiquidationPlan(item: DeadStockItem): {
  severity: DeadStockSeverity
  suggestedAction: string
  recommendation: string
} {
  const value = item.inventoryValue
  const days = item.daysSinceLastSale ?? 999
  const isNeverSold = item.deadStockStatus === 'never_sold'

  if (value >= 500 || days >= 120) {
    const action = 'Aggressive clearance markdown (30-50%) or vendor buyback request'
    return {
      severity: 'critical',
      suggestedAction: action,
      recommendation: `AI-generated recommendation: Apply a 30-50% clearance discount or initiate a vendor return to release ${formatCurrency(value)} in idle working capital.`,
    }
  }

  if (value >= 200 || days >= 90) {
    const action = 'Promotional bundle with top-selling complementary product'
    return {
      severity: 'high',
      suggestedAction: action,
      recommendation: `AI-generated recommendation: Bundle with fast-moving category items or feature in bi-weekly promotional endcaps to liquidate ${item.currentStock} units (${formatCurrency(value)}).`,
    }
  }

  if (isNeverSold) {
    const action = 'Merchandising review, barcode validation, and promotional placement'
    return {
      severity: 'medium',
      suggestedAction: action,
      recommendation: `AI-generated recommendation: Product has never recorded a sale. Audit shelf placement, verify barcode scannability, and run an introductory 15% discount.`,
    }
  }

  const action = 'Flash sale promotion or customer loyalty point redemption reward'
  return {
    severity: 'low',
    suggestedAction: action,
    recommendation: `AI-generated recommendation: Offer as a loyalty reward redemption or include in a weekend flash sale to recover ${formatCurrency(value)}.`,
  }
}

/**
 * Generates an executive liquidation plan summary across all identified dead-stock inventory.
 */
export function generateExecutiveLiquidationPlan(
  items: DeadStockItemPlan[],
  totalTiedUpCapital: number
): string[] {
  if (items.length === 0) {
    return [
      'AI-generated recommendation: Zero dead-stock inventory identified. Inventory turnover across all categories is healthy.',
    ]
  }

  const criticalItems = items.filter((i) => i.severity === 'critical')
  const highItems = items.filter((i) => i.severity === 'high')
  const neverSoldItems = items.filter((i) => i.deadStockStatus === 'never_sold')

  const plan: string[] = [
    `AI-generated recommendation: Prioritize immediate liquidation of ${items.length} stagnant SKUs to recover ${formatCurrency(totalTiedUpCapital)} in working capital.`,
  ]

  if (criticalItems.length > 0) {
    const criticalValue = criticalItems.reduce((acc, i) => acc + i.inventoryValue, 0)
    plan.push(
      `AI-generated recommendation: Immediately schedule markdown clearance or vendor buybacks for ${criticalItems.length} critical items tying up ${formatCurrency(criticalValue)}.`
    )
  }

  if (highItems.length > 0) {
    plan.push(
      `AI-generated recommendation: Launch merchandising bundles pairing ${highItems.length} high-idle SKUs with top-velocity category anchors.`
    )
  }

  if (neverSoldItems.length > 0) {
    plan.push(
      `AI-generated recommendation: Audit ${neverSoldItems.length} never-sold SKUs to verify pricing accuracy and shelf placement before initiating markdowns.`
    )
  }

  return plan
}

/**
 * Dispatches the dead-stock audit report payload to Make.com.
 * Failure-safe: Never throws an unhandled exception.
 */
async function dispatchAuditWebhook(
  webhookUrl: string,
  payload: DeadStockAuditPayload
): Promise<{ success: boolean; responseStatus?: number; error?: string }> {
  let hostname = 'unknown'
  try {
    hostname = new URL(webhookUrl).hostname
  } catch {
    // safe fallback
  }

  try {
    console.log(`[DeadStockAudit] Dispatching to webhook host: ${hostname}, totalItems: ${payload.totalDeadStockItems}`)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RetailPilot-AI/1.0 (Dead-Stock-Biweekly-Audit)',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8-second safety timeout
    })

    console.log(`[DeadStockAudit] Response from ${hostname}: HTTP ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown HTTP error')
      return {
        success: false,
        responseStatus: response.status,
        error: `Make.com returned HTTP ${response.status}: ${errorText.slice(0, 100)}`,
      }
    }

    return {
      success: true,
      responseStatus: response.status,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error'
    console.error(`[DeadStockAudit] Webhook dispatch exception to ${hostname}: ${message}`)
    return {
      success: false,
      error: `Webhook dispatch failed: ${message}`,
    }
  }
}

/**
 * Safely writes an audit record to public.dead_stock_audits.
 * Never throws exceptions if table does not exist.
 */
async function recordDeadStockAudit(
  supabase: SupabaseClient,
  record: {
    organization_id: string
    store_id?: string | null
    total_dead_stock_items: number
    total_tied_up_capital: number
    status: 'completed' | 'dispatched' | 'failed'
    webhook_url_masked?: string | null
    response_status?: number | null
    error_message?: string | null
    summary: Record<string, unknown>
  }
) {
  try {
    await supabase.from('dead_stock_audits').insert([record])
  } catch (err: unknown) {
    console.warn('[DeadStockAudit] Audit log write warning:', err)
  }
}

/**
 * Single source of truth for the Bi-Weekly Dead Stock Audit.
 *
 * Requirements:
 * 1. Reuses verified getDeadStockProducts() service.
 * 2. Strict recommendation-only. Zero inventory or sales mutations.
 * 3. Categorizes dead stock and produces structured liquidation recommendations.
 * 4. Every recommendation contains the mandatory disclaimer: "AI-generated recommendation".
 * 5. Dispatches to Make.com with failure safety and audit logging.
 */
export async function executeDeadStockBiweeklyAudit({
  supabase,
  organizationId,
  storeId,
  categoryId,
  webhookUrl = process.env.MAKE_DEAD_STOCK_WEBHOOK_URL,
}: DeadStockAuditParams): Promise<DeadStockAuditResult> {
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // 1. Compute dead stock using the verified core service (minDays: 60)
  const deadStockResult = await getDeadStockProducts({
    supabase,
    organizationId,
    storeId,
    categoryId,
    minDays: 60,
  })

  if (!deadStockResult.success) {
    return {
      success: false,
      auditId,
      organizationId,
      storeFilter: storeId ?? 'all_stores',
      totalDeadStockItems: 0,
      totalTiedUpCapital: 0,
      items: [],
      liquidationPlan: [],
      disclaimer: '',
      dispatchedToWebhook: false,
      error: deadStockResult.error ?? 'Failed to execute dead stock service.',
    }
  }

  // 2. Build structured liquidation plan for each dead-stock item
  const itemPlans: DeadStockItemPlan[] = (deadStockResult.items || []).map((item) => {
    const plan = generateItemLiquidationPlan(item)
    return {
      ...item,
      severity: plan.severity,
      suggestedAction: plan.suggestedAction,
      recommendation: plan.recommendation,
    }
  })

  // 3. Generate overall executive liquidation recommendations
  const executivePlan = generateExecutiveLiquidationPlan(
    itemPlans,
    deadStockResult.totalDeadStockValue
  )

  const disclaimer =
    'AI-generated recommendation: All liquidation actions are algorithmically generated based on historical sales velocity and working capital impact. Store leadership must review and approve all proposed markdowns or promotions prior to execution.'

  const nowIso = new Date().toISOString()
  const resolvedWebhookUrl =
    webhookUrl?.trim() ||
    process.env.MAKE_DEAD_STOCK_WEBHOOK_URL?.trim() ||
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
    `[DeadStockAudit] Webhook configured: ${Boolean(resolvedWebhookUrl)}${webhookHost ? ` (${webhookHost})` : ''}, entering dispatch: ${Boolean(resolvedWebhookUrl)}`
  )

  const payload: DeadStockAuditPayload = {
    eventId: auditId,
    eventType: 'inventory.dead_stock_biweekly_audit',
    cadence: 'bi_weekly',
    organizationId,
    storeFilter: deadStockResult.storeFilter,
    executionTimestamp: nowIso,
    totalDeadStockItems: deadStockResult.totalDeadStockItems,
    totalTiedUpCapital: deadStockResult.totalDeadStockValue,
    items: itemPlans,
    liquidationPlan: executivePlan,
    disclaimer,
  }

  // 4. Webhook dispatch to Make.com (failure-safe)
  let dispatchedToWebhook = false
  let responseStatus: number | undefined
  let dispatchError: string | undefined

  if (resolvedWebhookUrl) {
    const dispatchResult = await dispatchAuditWebhook(resolvedWebhookUrl, payload)
    dispatchedToWebhook = dispatchResult.success
    responseStatus = dispatchResult.responseStatus
    dispatchError = dispatchResult.error
  }

  // 5. Audit Logging
  const auditStatus = resolvedWebhookUrl
    ? dispatchedToWebhook
      ? 'dispatched'
      : 'failed'
    : 'completed'

  await recordDeadStockAudit(supabase, {
    organization_id: organizationId,
    store_id: storeId,
    total_dead_stock_items: deadStockResult.totalDeadStockItems,
    total_tied_up_capital: deadStockResult.totalDeadStockValue,
    status: auditStatus,
    webhook_url_masked: resolvedWebhookUrl ? maskedUrl : null,
    response_status: responseStatus ?? null,
    error_message: dispatchError ?? null,
    summary: {
      auditId,
      cadence: 'bi_weekly',
      totalDeadStockItems: deadStockResult.totalDeadStockItems,
      totalTiedUpCapital: deadStockResult.totalDeadStockValue,
      executivePlan,
      disclaimer,
      dispatchedToWebhook,
      webhookHost,
    },
  })

  return {
    success: true,
    auditId,
    organizationId,
    storeFilter: deadStockResult.storeFilter,
    totalDeadStockItems: deadStockResult.totalDeadStockItems,
    totalTiedUpCapital: deadStockResult.totalDeadStockValue,
    items: itemPlans,
    liquidationPlan: executivePlan,
    disclaimer,
    dispatchedToWebhook,
    webhookConfigured: Boolean(resolvedWebhookUrl),
    webhookHost,
    responseStatus,
    error: dispatchError,
  }
}
