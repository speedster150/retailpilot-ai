import {
  getSupplierOutstandingBalances,
  type SupplierOutstandingResult,
} from '@/lib/finance/supplier-outstanding'
import {
  validateStoreBelongsToTenant,
  type AuthenticatedTenantContext,
} from '@/lib/auth/context'

export type GetSupplierOutstandingInput = {
  min_due?: number
  store_id?: string
  overdue_only?: boolean
}

export const getSupplierOutstandingToolDefinition = {
  name: 'get_supplier_outstanding',
  description:
    'Identifies unpaid/outstanding supplier balances from active purchase orders, purchase order items, and goods receipts. Calculates due dates and overdue statuses using supplier payment terms (e.g. Net 30, Net 60). Tenant context is derived strictly from the server session; never supply an organization_id.',
  parameters: {
    type: 'object',
    properties: {
      min_due: {
        type: 'number',
        minimum: 0,
        description:
          'Optional minimum outstanding balance filter. Excludes suppliers with balances below this amount.',
      },
      store_id: {
        type: 'string',
        description:
          'Optional store UUID to filter purchase orders by store location. If omitted, evaluates all stores in the organization.',
      },
      overdue_only: {
        type: 'boolean',
        default: false,
        description:
          'Whether to filter only to overdue supplier balances. Default is false.',
      },
    },
    required: [],
    additionalProperties: false,
  },
}

/**
 * Handler for the get_supplier_outstanding MCP tool.
 * Binds execution strictly to context.organizationId.
 */
export async function executeGetSupplierOutstanding(
  params: GetSupplierOutstandingInput,
  context: AuthenticatedTenantContext
): Promise<{
  success: boolean
  data?: SupplierOutstandingResult
  error?: string
}> {
  const { min_due = 0, store_id, overdue_only = false } = params ?? {}

  // Validate store_id if provided - ensure it belongs to the authenticated tenant
  if (store_id) {
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
  }

  const result = await getSupplierOutstandingBalances({
    supabase: context.supabase,
    organizationId: context.organizationId,
    storeId: store_id,
    minDue: min_due,
    overdueOnly: overdue_only,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to retrieve supplier outstanding balances.',
    }
  }

  return {
    success: true,
    data: result,
  }
}
