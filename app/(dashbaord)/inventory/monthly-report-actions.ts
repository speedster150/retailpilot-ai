'use server'

import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import {
  executeMonthlyExecutiveReportAutomation,
  type MonthlyExecutiveReportResult,
} from '@/lib/automation/monthly-executive-report'

export type TriggerMonthlyReportActionState = {
  success: boolean
  data?: MonthlyExecutiveReportResult
  error?: string
}

/**
 * Server Action to trigger a Monthly Executive AI Report scan.
 * Derives authenticated tenant context strictly from the server cookie session.
 * Rejects unauthenticated requests and customer roles.
 */
export async function triggerMonthlyExecutiveReportScan(options?: {
  periodMonth?: string | null
  force?: boolean
}): Promise<TriggerMonthlyReportActionState> {
  const authResult = await getAuthenticatedTenantContext(INVENTORY_ROLES)

  if (!authResult.success) {
    return {
      success: false,
      error: authResult.error,
    }
  }

  const result = await executeMonthlyExecutiveReportAutomation({
    supabase: authResult.context.supabase,
    organizationId: authResult.context.organizationId,
    periodMonth: options?.periodMonth ?? null,
    force: options?.force ?? false,
  })

  return {
    success: result.success,
    data: result,
    error: result.error,
  }
}
