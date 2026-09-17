'use server'

import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import {
  detectAndDispatchLowStockAlerts,
  type LowStockScanResult,
} from '@/lib/automation/low-stock-alert'

export type TriggerScanActionState = {
  success: boolean
  data?: LowStockScanResult
  error?: string
}

/**
 * Server Action to trigger a low-stock automation scan.
 * Derives authenticated tenant context strictly from the server-side session.
 * Rejects unauthenticated requests and customer roles.
 */
export async function triggerLowStockAlertScan(
  storeId?: string | null
): Promise<TriggerScanActionState> {
  const authResult = await getAuthenticatedTenantContext(INVENTORY_ROLES)

  if (!authResult.success) {
    return {
      success: false,
      error: authResult.error,
    }
  }

  const result = await detectAndDispatchLowStockAlerts({
    supabase: authResult.context.supabase,
    organizationId: authResult.context.organizationId,
    storeId: storeId ?? null,
  })

  return {
    success: result.success,
    data: result,
    error: result.error,
  }
}
