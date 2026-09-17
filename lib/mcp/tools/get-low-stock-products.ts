import {
  getLowStockProducts,
  type ProductStockItem,
} from '@/lib/inventory/stock'
import {
  validateStoreBelongsToTenant,
  type AuthenticatedTenantContext,
} from '@/lib/auth/context'

export type GetLowStockProductsInput = {
  store_id?: string
  category_id?: string
  include_out_of_stock?: boolean
}

export type LowStockProductResponseItem = {
  productId: string
  productName: string
  sku: string | null
  barcode: string | null
  storeId: string
  storeName: string
  storeCode: string | null
  currentStock: number
  reorderLevel: number
  deficit: number
  status: 'out_of_stock' | 'low_stock'
  statusLabel: string
}

export type GetLowStockProductsResult = {
  organizationId: string
  storeFilter: string
  totalCount: number
  items: LowStockProductResponseItem[]
}

export const getLowStockProductsToolDefinition = {
  name: 'get_low_stock_products',
  description:
    'Retrieves products that are currently below their reorder level or out of stock for the authenticated organization. Tenant context is derived strictly from the server-side session. Never supply or trust an organization_id.',
  parameters: {
    type: 'object',
    properties: {
      store_id: {
        type: 'string',
        description:
          'Optional store UUID to filter stock to a specific location. If omitted, evaluates all stores in the organization.',
      },
      category_id: {
        type: 'string',
        description:
          'Optional category UUID to filter products to a specific category.',
      },
      include_out_of_stock: {
        type: 'boolean',
        description:
          'Whether to include items with zero or negative stock. Default is true.',
      },
    },
    required: [],
    additionalProperties: false,
  },
}

/**
 * Handler for the get_low_stock_products MCP tool.
 * Binds execution strictly to context.organizationId.
 */
export async function executeGetLowStockProducts(
  params: GetLowStockProductsInput,
  context: AuthenticatedTenantContext
): Promise<{
  success: boolean
  data?: GetLowStockProductsResult
  error?: string
}> {
  const { store_id, category_id, include_out_of_stock = true } = params ?? {}

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

  const result = await getLowStockProducts({
    supabase: context.supabase,
    organizationId: context.organizationId,
    storeId: store_id,
    categoryId: category_id,
    includeOutOfStock: include_out_of_stock,
  })

  if (!result.success || !result.products) {
    return {
      success: false,
      error: result.error ?? 'Failed to retrieve low-stock products.',
    }
  }

  const items: LowStockProductResponseItem[] = result.products.map(
    (product: ProductStockItem) => ({
      productId: product.productId,
      productName: product.productName,
      sku: product.sku,
      barcode: product.barcode,
      storeId: product.storeId,
      storeName: product.storeName,
      storeCode: product.storeCode,
      currentStock: product.currentStock,
      reorderLevel: product.reorderLevel,
      deficit: product.deficit,
      status: product.status as 'out_of_stock' | 'low_stock',
      statusLabel: product.statusLabel,
    })
  )

  return {
    success: true,
    data: {
      organizationId: context.organizationId,
      storeFilter: store_id ?? 'all_stores',
      totalCount: items.length,
      items,
    },
  }
}
