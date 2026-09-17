'use server'

import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import {
  executeDeadStockBiweeklyAudit,
  type DeadStockAuditResult,
} from '@/lib/automation/dead-stock-audit'

export type TriggerDeadStockAuditActionState = {
  success: boolean
  data?: DeadStockAuditResult
  error?: string
}

/**
 * Server Action to trigger a bi-weekly dead stock audit.
 * Derives authenticated tenant context strictly from the server-side session.
 * Rejects unauthenticated requests and customer roles.
 */
export async function triggerDeadStockAuditScan(
  storeId?: string | null
): Promise<TriggerDeadStockAuditActionState> {
  const authResult = await getAuthenticatedTenantContext(INVENTORY_ROLES)

  if (!authResult.success) {
    return {
      success: false,
      error: authResult.error,
    }
  }

  const result = await executeDeadStockBiweeklyAudit({
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
