import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getSupplierOutstandingBalances,
  type SupplierOutstandingSummary,
} from '@/lib/finance/supplier-outstanding'
import { maskWebhookUrl } from '@/lib/automation/low-stock-alert'

export type EscalationSeverity = 'warning' | 'critical' | 'overdue'

export type SupplierEscalationItem = {
  purchaseOrderId: string
  poNumber: string | null
  receiptNumber: string | null
  supplierId: string
  supplierName: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  storeId: string
  storeName: string
  outstandingAmount: number
  paymentTerms: string | null
  dueDate: string | null
  hoursRemaining: number
  severity: EscalationSeverity
  isOverdue: boolean
  daysOverdue: number
  suggestedAction: string
  recommendation: string
}

export type SupplierEscalationPayload = {
  eventId: string
  eventType: 'finance.supplier_payment_escalation'
  organizationId: string
  storeFilter: string
  executionTimestamp: string
  totalEscalationsCount: number
  totalOutstandingAmount: number
  escalations: SupplierEscalationItem[]
  summaryPlan: string[]
  disclaimer: string
}

export type EscalationItemRecord = SupplierEscalationItem & {
  status: 'dispatched' | 'suppressed_duplicate' | 'failed'
}

export type SupplierEscalationResult = {
  success: boolean
  organizationId: string
  storeFilter: string
  totalEvaluatedOrders: number
  totalEligibleEscalations: number
  dispatchedCount: number
  suppressedCount: number
  failedCount: number
  escalations: EscalationItemRecord[]
  summaryPlan: string[]
  responseStatus?: number
  error?: string
}

export type SupplierEscalationParams = {
  supabase: SupabaseClient
  organizationId: string
  storeId?: string | null
  webhookUrl?: string | null
  cooldownHours?: number
  now?: Date
}

const SEVERITY_RANK: Record<EscalationSeverity, number> = {
  warning: 1,
  critical: 2,
  overdue: 3,
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
 * Classifies an outstanding PO obligation into an escalation severity tier
 * based on remaining hours until due date.
 *
 * Rules:
 * - hoursRemaining <= 0: 'overdue'
 * - 0 < hoursRemaining <= 24: 'critical'
 * - 24 < hoursRemaining <= 48: 'warning'
 * - hoursRemaining > 48: null (no escalation)
 */
export function classifyEscalationSeverity(
  hoursRemaining: number
): EscalationSeverity | null {
  if (hoursRemaining <= 0) {
    return 'overdue'
  }
  if (hoursRemaining <= 24) {
    return 'critical'
  }
  if (hoursRemaining <= 48) {
    return 'warning'
  }
  return null
}

/**
 * Produces structured actionable recommendations for Accounts and Store Managers.
 * Explicitly includes the required "AI-generated recommendation" tag.
 */
export function generateEscalationRecommendation(
  item: {
    poNumber: string | null
    supplierName: string
    outstandingAmount: number
    hoursRemaining: number
    severity: EscalationSeverity
    paymentTerms: string | null
  }
): { suggestedAction: string; recommendation: string } {
  const poRef = item.poNumber ? `PO ${item.poNumber}` : 'PO obligation'
  const formattedAmt = formatCurrency(item.outstandingAmount)
  const terms = item.paymentTerms ? ` (${item.paymentTerms})` : ''

  if (item.severity === 'overdue') {
    const action = 'Immediate Accounts review & priority remittance release to prevent credit hold'
    return {
      suggestedAction: action,
      recommendation: `AI-generated recommendation: ${poRef} for ${item.supplierName}${terms} is OVERDUE by ${Math.abs(
        Math.round(item.hoursRemaining)
      )} hours with ${formattedAmt} outstanding. Immediately verify goods receipt and disburse payment to preserve supplier credit terms.`,
    }
  }

  if (item.severity === 'critical') {
    const action = 'Schedule payment disbursement within next 24 hours'
    return {
      suggestedAction: action,
      recommendation: `AI-generated recommendation: ${poRef} for ${item.supplierName}${terms} is due in ${Math.round(
        item.hoursRemaining
      )} hours (${formattedAmt}). Verify invoice clearance and disburse payment before cutoff.`,
    }
  }

  const action = 'Review pending invoice and queue payment batch'
  return {
    suggestedAction: action,
    recommendation: `AI-generated recommendation: ${poRef} for ${item.supplierName}${terms} is due in ${Math.round(
      item.hoursRemaining
    )} hours (${formattedAmt}). Review pending supplier statement and queue for scheduled accounts batch.`,
  }
}

/**
 * Executes the Supplier Payment Escalation automation.
 *
 * Flow:
 * 1. Queries real outstanding PO obligations using getSupplierOutstandingBalances.
 * 2. Filters obligations due within 48 hours (or already overdue) with pending balance > 0.
 * 3. Enforces duplicate prevention against public.supplier_payment_escalations,
 *    allowing re-escalation if urgency worsened (e.g. warning -> critical -> overdue).
 * 4. Dispatches structured escalation event to Make.com webhook.
 * 5. Logs all audit records with masked webhook secrets.
 * 6. Guarantees zero financial/inventory mutation.
 */
export async function executeSupplierPaymentEscalation({
  supabase,
  organizationId,
  storeId,
  webhookUrl = process.env.MAKE_SUPPLIER_ESCALATION_WEBHOOK_URL,
  cooldownHours = 24,
  now = new Date(),
}: SupplierEscalationParams): Promise<SupplierEscalationResult> {
  const storeFilter = storeId ?? 'all_stores'

  // 1. Fetch real supplier balances from existing verified service
  const outstandingResult = await getSupplierOutstandingBalances({
    supabase,
    organizationId,
    storeId,
    minDue: 0.01,
  })

  if (!outstandingResult.success) {
    return {
      success: false,
      organizationId,
      storeFilter,
      totalEvaluatedOrders: 0,
      totalEligibleEscalations: 0,
      dispatchedCount: 0,
      suppressedCount: 0,
      failedCount: 0,
      escalations: [],
      summaryPlan: [],
      error: outstandingResult.error ?? 'Failed to query supplier outstanding balances.',
    }
  }

  // Create lookup for supplier contacts from summary
  const supplierContactMap = new Map<string, SupplierOutstandingSummary>()
  for (const s of outstandingResult.suppliers) {
    supplierContactMap.set(s.supplierId, s)
  }

  const eligibleItems: SupplierEscalationItem[] = []

  // 2. Evaluate 48-hour condition for each outstanding order
  for (const order of outstandingResult.orders) {
    // Condition 1 & 3: Must have genuine outstanding amount
    if (order.outstandingAmount <= 0) {
      continue
    }

    // Must have a resolvable due date
    if (!order.dueDate) {
      continue
    }

    const dueTime = new Date(order.dueDate).getTime()
    if (Number.isNaN(dueTime)) {
      continue
    }

    const diffMs = dueTime - now.getTime()
    const hoursRemaining = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10

    // Condition 2: 48-hour escalation rule
    const severity = classifyEscalationSeverity(hoursRemaining)
    if (!severity) {
      // Due in > 48 hours; no escalation required
      continue
    }

    const supplierDetails = supplierContactMap.get(order.supplierId)
    const { suggestedAction, recommendation } = generateEscalationRecommendation({
      poNumber: order.poNumber,
      supplierName: order.supplierName,
      outstandingAmount: order.outstandingAmount,
      hoursRemaining,
      severity,
      paymentTerms: order.paymentTerms,
    })

    eligibleItems.push({
      purchaseOrderId: order.purchaseOrderId,
      poNumber: order.poNumber,
      receiptNumber: order.receiptNumber,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      contactPerson: supplierDetails?.contactPerson ?? null,
      phone: supplierDetails?.phone ?? null,
      email: supplierDetails?.email ?? null,
      storeId: order.storeId,
      storeName: order.storeName,
      outstandingAmount: order.outstandingAmount,
      paymentTerms: order.paymentTerms,
      dueDate: order.dueDate,
      hoursRemaining,
      severity,
      isOverdue: hoursRemaining <= 0,
      daysOverdue: hoursRemaining <= 0 ? Math.ceil(Math.abs(hoursRemaining) / 24) : 0,
      suggestedAction,
      recommendation,
    })
  }

  const resolvedWebhookUrl =
    webhookUrl?.trim() ||
    process.env.MAKE_SUPPLIER_ESCALATION_WEBHOOK_URL?.trim() ||
    process.env.MAKE_SUPPLIER_PAYMENT_ESCALATION_WEBHOOK_URL?.trim() ||
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
    `[SupplierEscalation] Webhook configured: ${Boolean(resolvedWebhookUrl)}${webhookHost ? ` (${webhookHost})` : ''}, entering dispatch: ${Boolean(resolvedWebhookUrl)}`
  )

  const itemsToDispatch: SupplierEscalationItem[] = []
  const recordedEscalations: EscalationItemRecord[] = []
  let suppressedCount = 0

  // 3. Duplicate prevention check for each eligible item
  for (const item of eligibleItems) {
    let shouldSuppress = false
    let prevSeverity: EscalationSeverity | null = null
    let prevAmount: number | null = null

    try {
      const { data: previousEscalations, error: prevError } = await supabase
        .from('supplier_payment_escalations')
        .select('severity, outstanding_amount, status, created_at')
        .eq('organization_id', organizationId)
        .eq('purchase_order_id', item.purchaseOrderId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!prevError && previousEscalations && previousEscalations.length > 0) {
        const prev = previousEscalations[0]
        prevSeverity = prev.severity as EscalationSeverity
        prevAmount = Number(prev.outstanding_amount)
        const prevCreatedAt = new Date(prev.created_at)
        const hoursSinceLastAlert = (now.getTime() - prevCreatedAt.getTime()) / (1000 * 60 * 60)

        // Duplicate prevention logic:
        // Suppress ONLY IF previous was successfully dispatched, within cooldown,
        // current severity hasn't worsened (rank <= prevRank), and amount hasn't increased.
        const currentRank = SEVERITY_RANK[item.severity]
        const previousRank = prevSeverity ? SEVERITY_RANK[prevSeverity] ?? 1 : 1

        if (
          prev.status === 'dispatched' &&
          hoursSinceLastAlert < cooldownHours &&
          currentRank <= previousRank &&
          item.outstandingAmount <= (prevAmount ?? item.outstandingAmount)
        ) {
          shouldSuppress = true
        }
      }
    } catch (e: unknown) {
      console.warn('[SupplierEscalation] Previous audit lookup warning:', e)
    }

    if (shouldSuppress) {
      suppressedCount += 1
      recordedEscalations.push({
        ...item,
        status: 'suppressed_duplicate',
      })
    } else {
      itemsToDispatch.push(item)
    }
  }

  // 4. Generate summary action plan
  const summaryPlan: string[] = []
  if (itemsToDispatch.length === 0) {
    if (eligibleItems.length === 0) {
      summaryPlan.push(
        'AI-generated recommendation: No supplier payment obligations due within 48 hours or overdue. All supplier liabilities are current.'
      )
    } else {
      summaryPlan.push(
        `AI-generated recommendation: ${suppressedCount} pending supplier obligations are already escalated and within cooldown. No new notifications required.`
      )
    }
  } else {
    const overdueList = itemsToDispatch.filter((i) => i.severity === 'overdue')
    const criticalList = itemsToDispatch.filter((i) => i.severity === 'critical')
    const warningList = itemsToDispatch.filter((i) => i.severity === 'warning')
    const totalDispatchAmount = itemsToDispatch.reduce((acc, i) => acc + i.outstandingAmount, 0)

    summaryPlan.push(
      `AI-generated recommendation: Immediate escalation of ${itemsToDispatch.length} obligations totaling ${formatCurrency(
        totalDispatchAmount
      )} to Accounts/Manager.`
    )

    if (overdueList.length > 0) {
      const overdueTotal = overdueList.reduce((acc, i) => acc + i.outstandingAmount, 0)
      summaryPlan.push(
        `AI-generated recommendation: CRITICAL - ${overdueList.length} obligations (${formatCurrency(
          overdueTotal
        )}) are already OVERDUE. Disburse immediately to avoid vendor shipment suspensions.`
      )
    }

    if (criticalList.length > 0) {
      const critTotal = criticalList.reduce((acc, i) => acc + i.outstandingAmount, 0)
      summaryPlan.push(
        `AI-generated recommendation: ${criticalList.length} obligations (${formatCurrency(
          critTotal
        )}) due in <24 hours. Queue in today's banking batch.`
      )
    }

    if (warningList.length > 0) {
      const warnTotal = warningList.reduce((acc, i) => acc + i.outstandingAmount, 0)
      summaryPlan.push(
        `AI-generated recommendation: ${warningList.length} obligations (${formatCurrency(
          warnTotal
        )}) due in 24-48 hours. Verify invoice matching and approval.`
      )
    }
  }

  // If nothing to dispatch, record suppressed audit entries and return
  if (itemsToDispatch.length === 0) {
    for (const suppressedItem of recordedEscalations.filter((i) => i.status === 'suppressed_duplicate')) {
      await logEscalationAuditRecord({
        supabase,
        organizationId,
        item: suppressedItem,
        status: 'suppressed_duplicate',
        maskedUrl,
        responseStatus: undefined,
        errorMessage: 'Suppressed duplicate within cooldown period and same/lower severity',
      })
    }

    return {
      success: true,
      organizationId,
      storeFilter,
      totalEvaluatedOrders: outstandingResult.orders.length,
      totalEligibleEscalations: eligibleItems.length,
      dispatchedCount: 0,
      suppressedCount,
      failedCount: 0,
      escalations: recordedEscalations,
      summaryPlan,
    }
  }

  // 5. Construct Make.com Webhook Payload
  const eventId = `evt_po_esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const totalOutstandingAmount = itemsToDispatch.reduce((acc, i) => acc + i.outstandingAmount, 0)

  const payload: SupplierEscalationPayload = {
    eventId,
    eventType: 'finance.supplier_payment_escalation',
    organizationId,
    storeFilter,
    executionTimestamp: now.toISOString(),
    totalEscalationsCount: itemsToDispatch.length,
    totalOutstandingAmount,
    escalations: itemsToDispatch,
    summaryPlan,
    disclaimer:
      'AI-generated escalation alert. This automation does not execute payments or modify supplier ledgers. Authorized staff must review and approve all remittances.',
  }

  // 6. Dispatch to Make.com Webhook (Failure Safe)
  let dispatchSuccess = false
  let responseStatus: number | undefined
  let dispatchError: string | undefined

  if (!resolvedWebhookUrl) {
    dispatchError = 'Make.com webhook URL is not configured (MAKE_SUPPLIER_ESCALATION_WEBHOOK_URL).'
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

  const dispatchStatus: 'dispatched' | 'failed' = dispatchSuccess ? 'dispatched' : 'failed'
  let dispatchedCount = 0
  let failedCount = 0

  // 7. Record Audit Records in public.supplier_payment_escalations
  for (const item of itemsToDispatch) {
    const itemRecord: EscalationItemRecord = {
      ...item,
      status: dispatchStatus,
    }
    recordedEscalations.push(itemRecord)

    if (dispatchSuccess) {
      dispatchedCount += 1
    } else {
      failedCount += 1
    }

    await logEscalationAuditRecord({
      supabase,
      organizationId,
      item,
      status: dispatchStatus,
      maskedUrl,
      responseStatus,
      errorMessage: dispatchError,
      payload,
    })
  }

  // Also log suppressed items if any
  for (const suppressedItem of recordedEscalations.filter((i) => i.status === 'suppressed_duplicate')) {
    await logEscalationAuditRecord({
      supabase,
      organizationId,
      item: suppressedItem,
      status: 'suppressed_duplicate',
      maskedUrl,
      responseStatus: undefined,
      errorMessage: 'Suppressed duplicate within cooldown period and same/lower severity',
      payload,
    })
  }

  return {
    success: dispatchSuccess || itemsToDispatch.length === 0,
    organizationId,
    storeFilter,
    totalEvaluatedOrders: outstandingResult.orders.length,
    totalEligibleEscalations: eligibleItems.length,
    dispatchedCount,
    suppressedCount,
    failedCount,
    escalations: recordedEscalations,
    summaryPlan,
    responseStatus,
    error: dispatchError,
  }
}

/**
 * Inserts an escalation audit record safely without breaking execution.
 */
async function logEscalationAuditRecord({
  supabase,
  organizationId,
  item,
  status,
  maskedUrl,
  responseStatus,
  errorMessage,
  payload,
}: {
  supabase: SupabaseClient
  organizationId: string
  item: SupplierEscalationItem
  status: 'dispatched' | 'failed' | 'suppressed_duplicate'
  maskedUrl: string
  responseStatus?: number
  errorMessage?: string
  payload?: unknown
}): Promise<void> {
  try {
    await supabase.from('supplier_payment_escalations').insert({
      organization_id: organizationId,
      purchase_order_id: item.purchaseOrderId,
      po_number: item.poNumber,
      supplier_id: item.supplierId,
      supplier_name: item.supplierName,
      store_id: item.storeId,
      store_name: item.storeName,
      outstanding_amount: item.outstandingAmount,
      due_date: item.dueDate,
      hours_remaining: item.hoursRemaining,
      severity: item.severity,
      status,
      webhook_url_masked: maskedUrl,
      response_status: responseStatus ?? null,
      error_message: errorMessage ?? null,
      payload: payload ?? { item },
    })
  } catch (e: unknown) {
    console.warn('[SupplierEscalation] Failed to record audit record:', e)
  }
}
