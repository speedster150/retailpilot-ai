'use server'

import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import {
  executeSupplierPaymentEscalation,
  type SupplierEscalationResult,
} from '@/lib/automation/supplier-escalation'

export type TriggerSupplierEscalationActionState = {
  success: boolean
  data?: SupplierEscalationResult
  error?: string
}

/**
 * Server Action to trigger a Supplier Payment Escalation scan.
 * Derives authenticated tenant context strictly from the server-side session.
 * Rejects unauthenticated requests and customer roles.
 */
export async function triggerSupplierPaymentEscalationScan(
  storeId?: string | null
): Promise<TriggerSupplierEscalationActionState> {
  const authResult = await getAuthenticatedTenantContext(INVENTORY_ROLES)

  if (!authResult.success) {
    return {
      success: false,
      error: authResult.error,
    }
  }

  const result = await executeSupplierPaymentEscalation({
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
