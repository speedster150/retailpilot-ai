import {
  getDeadStockProducts,
  type DeadStockItem,
} from '@/lib/inventory/dead-stock'
import {
  validateStoreBelongsToTenant,
  type AuthenticatedTenantContext,
} from '@/lib/auth/context'

export type GetDeadStockInput = {
  min_days?: number
  store_id?: string
  category_id?: string
}

export type GetDeadStockResult = {
  organizationId: string
  storeFilter: string
  minDays: number
  totalDeadStockItems: number
  totalDeadStockValue: number
  items: DeadStockItem[]
}

export const getDeadStockToolDefinition = {
  name: 'get_dead_stock',
  description:
    'Identifies high-value inventory items with positive stock and zero sales for at least min_days (default: 60 days). Calculates idle tied-up capital using current stock and product cost. Tenant context is derived strictly from the server session; never supply an organization_id.',
  parameters: {
    type: 'object',
    properties: {
      min_days: {
        type: 'integer',
        minimum: 1,
        default: 60,
        description:
          'Minimum number of days without recorded sales to classify as dead stock. Default is 60 days.',
      },
      store_id: {
        type: 'string',
        description:
          'Optional store UUID to filter dead stock to a specific location. If omitted, evaluates all stores in the organization.',
      },
      category_id: {
        type: 'string',
        description:
          'Optional category UUID to filter products to a specific category.',
      },
    },
    required: [],
    additionalProperties: false,
  },
}

/**
 * Handler for the get_dead_stock MCP tool.
 * Binds execution strictly to context.organizationId.
 */
export async function executeGetDeadStock(
  params: GetDeadStockInput,
  context: AuthenticatedTenantContext
): Promise<{
  success: boolean
  data?: GetDeadStockResult
  error?: string
}> {
  const { min_days = 60, store_id, category_id } = params ?? {}

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

  const result = await getDeadStockProducts({
    supabase: context.supabase,
    organizationId: context.organizationId,
    storeId: store_id,
    categoryId: category_id,
    minDays: min_days,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to retrieve dead stock products.',
    }
  }

  return {
    success: true,
    data: {
      organizationId: context.organizationId,
      storeFilter: result.storeFilter,
      minDays: result.minDays,
      totalDeadStockItems: result.totalDeadStockItems,
      totalDeadStockValue: result.totalDeadStockValue,
      items: result.items,
    },
  }
}
