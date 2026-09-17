'use server'

import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import {
  executeDailySalesDossierAutomation,
  type DailySalesDossierResult,
} from '@/lib/automation/daily-sales-dossier'

export type TriggerDailyDossierActionState = {
  success: boolean
  data?: DailySalesDossierResult
  error?: string
}

/**
 * Server Action to trigger a Daily Sales Dossier scan.
 * Derives authenticated tenant context strictly from the server-side cookie session.
 * Rejects unauthenticated requests and customer roles.
 */
export async function triggerDailySalesDossierScan(options?: {
  storeId?: string | null
  businessDate?: string | null
  timezone?: string | null
  force?: boolean
}): Promise<TriggerDailyDossierActionState> {
  const authResult = await getAuthenticatedTenantContext(INVENTORY_ROLES)

  if (!authResult.success) {
    return {
      success: false,
      error: authResult.error,
    }
  }

  const result = await executeDailySalesDossierAutomation({
    supabase: authResult.context.supabase,
    organizationId: authResult.context.organizationId,
    storeId: options?.storeId ?? null,
    businessDate: options?.businessDate ?? null,
    timezone: options?.timezone ?? null,
    force: options?.force ?? false,
  })

  return {
    success: result.success,
    data: result,
    error: result.error,
  }
}
