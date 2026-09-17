import {
  calculateStoreProfitability,
  type StoreProfitabilityResult,
} from '@/lib/finance/profitability'
import {
  validateStoreBelongsToTenant,
  type AuthenticatedTenantContext,
} from '@/lib/auth/context'

export type GetProfitabilityInput = {
  store_id: string
  start_date: string
  end_date: string
}

export const getProfitabilityToolDefinition = {
  name: 'get_profitability',
  description:
    'Calculates store profitability for a specified date range using the Capstone formula: Gross Profit = Gross Sales - COGS, and Net Profit = Gross Profit - Store Operating Expenses. Tenant context is derived strictly from the server session; never supply an organization_id.',
  parameters: {
    type: 'object',
    properties: {
      store_id: {
        type: 'string',
        description:
          'Store UUID to analyze profitability for. Must belong to the authenticated organization.',
      },
      start_date: {
        type: 'string',
        description:
          'Start date for profitability analysis (YYYY-MM-DD or ISO-8601 string).',
      },
      end_date: {
        type: 'string',
        description:
          'End date for profitability analysis (YYYY-MM-DD or ISO-8601 string).',
      },
    },
    required: ['store_id', 'start_date', 'end_date'],
    additionalProperties: false,
  },
}

/**
 * Handler for the get_profitability MCP tool.
 * Binds execution strictly to context.organizationId.
 */
export async function executeGetProfitability(
  params: GetProfitabilityInput,
  context: AuthenticatedTenantContext
): Promise<{
  success: boolean
  data?: StoreProfitabilityResult
  error?: string
}> {
  const { store_id, start_date, end_date } = params ?? {}

  if (!store_id) {
    return {
      success: false,
      error: 'store_id parameter is required.',
    }
  }

  // Validate store belongs to the authenticated tenant
  const storeValidation = await validateStoreBelongsToTenant(
    context.supabase,
    context.organizationId,
    store_id
  )

  if (!storeValidation.valid) {
    return {
      success: false,
      error: storeValidation.error ?? 'Invalid store specified for this organization.',
    }
  }

  const result = await calculateStoreProfitability({
    supabase: context.supabase,
    organizationId: context.organizationId,
    storeId: store_id,
    startDate: start_date,
    endDate: end_date,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to calculate store profitability.',
    }
  }

  return {
    success: true,
    data: result,
  }
}
