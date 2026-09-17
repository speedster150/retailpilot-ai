import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateInventoryStock,
  type ProductStockItem,
} from '@/lib/inventory/stock'

export type LowStockAlertPayload = {
  eventId: string
  eventType: 'inventory.low_stock'
  organizationId: string
  storeId: string
  storeName: string
  productId: string
  productName: string
  sku: string | null
  barcode: string | null
  currentStock: number
  reorderLevel: number
  deficit: number
  status: 'low_stock' | 'out_of_stock'
  timestamp: string
}

export type AlertDispatchRecord = {
  productId: string
  productName: string
  storeId: string
  storeName: string
  currentStock: number
  reorderLevel: number
  deficit: number
  status: 'dispatched' | 'failed' | 'suppressed_duplicate'
  responseStatus?: number
  error?: string
}

export type LowStockScanResult = {
  success: boolean
  organizationId: string
  storeFilter?: string | null
  totalEvaluated: number
  lowStockCount: number
  dispatchedCount: number
  suppressedCount: number
  failedCount: number
  alerts: AlertDispatchRecord[]
  error?: string
}

export type LowStockScanParams = {
  supabase: SupabaseClient
  organizationId: string
  storeId?: string | null
  webhookUrl?: string | null
  cooldownHours?: number
}

/**
 * Masks a webhook URL to prevent logging complete tokens or query secrets.
 */
export function maskWebhookUrl(url: string | null | undefined): string {
  if (!url) return 'none'
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const maskedPath =
      pathname.length > 8
        ? `${pathname.slice(0, 4)}...${pathname.slice(-4)}`
        : '***'
    return `${parsed.protocol}//${parsed.host}${maskedPath}`
  } catch {
    return 'invalid_url'
  }
}

/**
 * Dispatches a single low-stock alert payload to the configured Make.com webhook.
 * Failure-safe: Never throws an unhandled error, returns structured result.
 */
async function dispatchWebhookToMake(
  webhookUrl: string,
  payload: LowStockAlertPayload
): Promise<{ success: boolean; responseStatus?: number; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RetailPilot-AI/1.0 (Low-Stock-Automation)',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8-second safety timeout
    })

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
    return {
      success: false,
      error: `Webhook dispatch failed: ${message}`,
    }
  }
}

/**
 * Single source of truth for detecting low-stock conditions and triggering Make.com automation.
 *
 * Invariants:
 * 1. Reuses authoritative calculateInventoryStock() formula.
 * 2. Suppresses duplicate alerts for unchanged stock levels.
 * 3. Dispatches new alerts if deficit increases or cooldown expires.
 * 4. Failure-safe: A Make.com network failure or error NEVER alters inventory or throws uncaught exceptions.
 * 5. Sanitized payload: Never exposes user passwords, cookies, or service keys.
 */
export async function detectAndDispatchLowStockAlerts({
  supabase,
  organizationId,
  storeId,
  webhookUrl = process.env.MAKE_LOW_STOCK_WEBHOOK_URL,
  cooldownHours = 24,
}: LowStockScanParams): Promise<LowStockScanResult> {
  // 1. Calculate current inventory stock using verified shared stock calculation
  const stockResult = await calculateInventoryStock({
    supabase,
    organizationId,
    storeId,
    activeOnly: true,
  })

  if (!stockResult.success || !stockResult.items) {
    return {
      success: false,
      organizationId,
      storeFilter: storeId,
      totalEvaluated: 0,
      lowStockCount: 0,
      dispatchedCount: 0,
      suppressedCount: 0,
      failedCount: 0,
      alerts: [],
      error: stockResult.error ?? 'Failed to calculate inventory stock.',
    }
  }

  const allItems = stockResult.items
  const lowStockItems = allItems.filter(
    (item: ProductStockItem) =>
      item.status === 'low_stock' || item.status === 'out_of_stock'
  )

  const alertRecords: AlertDispatchRecord[] = []
  let dispatchedCount = 0
  let suppressedCount = 0
  let failedCount = 0

  const resolvedWebhookUrl = webhookUrl?.trim() ?? ''
  const maskedUrl = maskWebhookUrl(resolvedWebhookUrl)
  const now = new Date()

  // 2. Process each low-stock item
  for (const item of lowStockItems) {
    // Check previous alert for this (organization_id, product_id, store_id)
    let shouldSuppress = false
    let previousStockLevel: number | null = null

    try {
      const { data: previousAlerts, error: prevError } = await supabase
        .from('low_stock_alerts')
        .select('stock_level, deficit, status, created_at')
        .eq('organization_id', organizationId)
        .eq('product_id', item.productId)
        .eq('store_id', item.storeId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!prevError && previousAlerts && previousAlerts.length > 0) {
        const prev = previousAlerts[0]
        previousStockLevel = Number(prev.stock_level)
        const prevDeficit = Number(prev.deficit)
        const prevCreatedAt = new Date(prev.created_at)

        const hoursSinceLastAlert =
          (now.getTime() - prevCreatedAt.getTime()) / (1000 * 60 * 60)

        // Duplicate suppression rule:
        // If previous alert was successfully dispatched AND stock hasn't dropped further
        // AND cooldown period hasn't elapsed, suppress repeated alert.
        if (
          prev.status === 'dispatched' &&
          item.currentStock >= previousStockLevel &&
          item.deficit <= prevDeficit &&
          hoursSinceLastAlert < cooldownHours
        ) {
          shouldSuppress = true
        }
      }
    } catch (e: unknown) {
      // Table may not exist yet or query failed; fallback safely to proceed without crashing
      console.warn('[LowStockAlert] Alert history lookup warning:', e)
    }

    if (shouldSuppress) {
      suppressedCount += 1
      alertRecords.push({
        productId: item.productId,
        productName: item.productName,
        storeId: item.storeId,
        storeName: item.storeName,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
        deficit: item.deficit,
        status: 'suppressed_duplicate',
      })
      continue
    }

    // Prepare clean, minimal webhook payload
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const payload: LowStockAlertPayload = {
      eventId,
      eventType: 'inventory.low_stock',
      organizationId,
      storeId: item.storeId,
      storeName: item.storeName,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      barcode: item.barcode,
      currentStock: item.currentStock,
      reorderLevel: item.reorderLevel,
      deficit: item.deficit,
      status: item.status === 'out_of_stock' ? 'out_of_stock' : 'low_stock',
      timestamp: now.toISOString(),
    }

    // 3. Dispatch to Make.com
    if (!resolvedWebhookUrl) {
      failedCount += 1
      const errorMsg = 'MAKE_LOW_STOCK_WEBHOOK_URL is not configured.'
      alertRecords.push({
        productId: item.productId,
        productName: item.productName,
        storeId: item.storeId,
        storeName: item.storeName,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
        deficit: item.deficit,
        status: 'failed',
        error: errorMsg,
      })

      // Attempt audit write
      await recordAlertAudit(supabase, {
        organization_id: organizationId,
        store_id: item.storeId,
        product_id: item.productId,
        stock_level: item.currentStock,
        reorder_level: item.reorderLevel,
        deficit: item.deficit,
        status: 'failed',
        webhook_url_masked: maskedUrl,
        error_message: errorMsg,
        payload,
      })

      continue
    }

    const dispatchResult = await dispatchWebhookToMake(resolvedWebhookUrl, payload)

    if (dispatchResult.success) {
      dispatchedCount += 1
      alertRecords.push({
        productId: item.productId,
        productName: item.productName,
        storeId: item.storeId,
        storeName: item.storeName,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
        deficit: item.deficit,
        status: 'dispatched',
        responseStatus: dispatchResult.responseStatus,
      })

      await recordAlertAudit(supabase, {
        organization_id: organizationId,
        store_id: item.storeId,
        product_id: item.productId,
        stock_level: item.currentStock,
        reorder_level: item.reorderLevel,
        deficit: item.deficit,
        status: 'dispatched',
        webhook_url_masked: maskedUrl,
        response_status: dispatchResult.responseStatus,
        payload,
      })
    } else {
      failedCount += 1
      alertRecords.push({
        productId: item.productId,
        productName: item.productName,
        storeId: item.storeId,
        storeName: item.storeName,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
        deficit: item.deficit,
        status: 'failed',
        responseStatus: dispatchResult.responseStatus,
        error: dispatchResult.error,
      })

      await recordAlertAudit(supabase, {
        organization_id: organizationId,
        store_id: item.storeId,
        product_id: item.productId,
        stock_level: item.currentStock,
        reorder_level: item.reorderLevel,
        deficit: item.deficit,
        status: 'failed',
        webhook_url_masked: maskedUrl,
        response_status: dispatchResult.responseStatus,
        error_message: dispatchResult.error,
        payload,
      })
    }
  }

  return {
    success: true,
    organizationId,
    storeFilter: storeId,
    totalEvaluated: allItems.length,
    lowStockCount: lowStockItems.length,
    dispatchedCount,
    suppressedCount,
    failedCount,
    alerts: alertRecords,
  }
}

/**
 * Safely inserts an audit entry into low_stock_alerts.
 * Never throws an error if table is missing or write fails.
 */
async function recordAlertAudit(
  supabase: SupabaseClient,
  record: {
    organization_id: string
    store_id: string
    product_id: string
    stock_level: number
    reorder_level: number
    deficit: number
    status: 'dispatched' | 'failed' | 'suppressed_duplicate'
    webhook_url_masked: string
    response_status?: number
    error_message?: string
    payload: LowStockAlertPayload
  }
) {
  try {
    await supabase.from('low_stock_alerts').insert([record])
  } catch (err: unknown) {
    console.warn('[LowStockAlert] Audit recording warning:', err)
  }
}
