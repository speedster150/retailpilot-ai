import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import {
  getLowStockProducts,
  type ProductStockItem,
} from '@/lib/inventory/stock'
import { getDeadStockProducts } from '@/lib/inventory/dead-stock'
import { calculateStoreProfitability } from '@/lib/finance/profitability'
import { getSupplierOutstandingBalances } from '@/lib/finance/supplier-outstanding'
import { generateExecutiveBusinessReport } from '@/lib/reports/business-report'
import {
  validateStoreBelongsToTenant,
  type AuthenticatedTenantContext,
} from '@/lib/auth/context'

/**
 * Creates and configures an official MCP server instance bound strictly to
 * the authenticated user's organization. No tenant identifier is exposed to or
 * accepted from the model/tool arguments.
 */
export function createTenantMcpServer(
  authContext: AuthenticatedTenantContext
): McpServer {
  const server = new McpServer({
    name: 'retailpilot-mcp-server',
    version: '1.0.0',
  })

  // Register get_low_stock_products using the official MCP v2 SDK registerTool API
  server.registerTool(
    'get_low_stock_products',
    {
      title: 'Get Low Stock Products',
      description:
        'Retrieves products that are currently below their reorder level or out of stock for the authenticated organization. Tenant context is derived strictly from the server session; never supply an organization_id.',
      inputSchema: z.object({
        store_id: z
          .string()
          .optional()
          .describe(
            'Optional store UUID to filter stock to a specific location. If omitted, evaluates all stores in the organization.'
          ),
        category_id: z
          .string()
          .optional()
          .describe(
            'Optional category UUID to filter products to a specific category.'
          ),
        include_out_of_stock: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            'Whether to include items with zero or negative stock. Default is true.'
          ),
      }),
    },
    async ({ store_id, category_id, include_out_of_stock }) => {
      // Validate store_id if provided - ensure it belongs to the authenticated tenant
      if (store_id) {
        const storeValidation = await validateStoreBelongsToTenant(
          authContext.supabase,
          authContext.organizationId,
          store_id
        )

        if (!storeValidation.valid) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text:
                  storeValidation.error ??
                  'Invalid store specified for this organization.',
              },
            ],
          }
        }
      }

      const result = await getLowStockProducts({
        supabase: authContext.supabase,
        organizationId: authContext.organizationId,
        storeId: store_id,
        categoryId: category_id,
        includeOutOfStock: include_out_of_stock ?? true,
      })

      if (!result.success || !result.products) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: result.error ?? 'Failed to retrieve low-stock products.',
            },
          ],
        }
      }

      const items = result.products.map((product: ProductStockItem) => ({
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
        status: product.status,
        statusLabel: product.statusLabel,
      }))

      const payload = {
        organizationId: authContext.organizationId,
        storeFilter: store_id ?? 'all_stores',
        totalCount: items.length,
        items,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
      }
    }
  )

  // Register get_dead_stock using official MCP v2 SDK registerTool API
  server.registerTool(
    'get_dead_stock',
    {
      title: 'Get Dead Stock',
      description:
        'Identifies high-value inventory items with positive stock and zero sales for at least min_days (default: 60 days). Calculates idle tied-up capital using current stock and product cost. Tenant context is derived strictly from the server session; never supply an organization_id.',
      inputSchema: z.object({
        min_days: z
          .number()
          .int()
          .min(1)
          .optional()
          .default(60)
          .describe(
            'Minimum number of days without recorded sales to classify as dead stock. Default is 60 days.'
          ),
        store_id: z
          .string()
          .optional()
          .describe(
            'Optional store UUID to filter dead stock to a specific location. If omitted, evaluates all stores in the organization.'
          ),
        category_id: z
          .string()
          .optional()
          .describe(
            'Optional category UUID to filter products to a specific category.'
          ),
      }),
    },
    async ({ min_days, store_id, category_id }) => {
      // Validate store_id if provided - ensure it belongs to the authenticated tenant
      if (store_id) {
        const storeValidation = await validateStoreBelongsToTenant(
          authContext.supabase,
          authContext.organizationId,
          store_id
        )

        if (!storeValidation.valid) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text:
                  storeValidation.error ??
                  'Invalid store specified for this organization.',
              },
            ],
          }
        }
      }

      const result = await getDeadStockProducts({
        supabase: authContext.supabase,
        organizationId: authContext.organizationId,
        storeId: store_id,
        categoryId: category_id,
        minDays: min_days ?? 60,
      })

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: result.error ?? 'Failed to retrieve dead stock products.',
            },
          ],
        }
      }

      const payload = {
        organizationId: authContext.organizationId,
        storeFilter: result.storeFilter,
        minDays: result.minDays,
        totalDeadStockItems: result.totalDeadStockItems,
        totalDeadStockValue: result.totalDeadStockValue,
        items: result.items,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
      }
    }
  )

  // Register get_profitability using official MCP v2 SDK registerTool API
  server.registerTool(
    'get_profitability',
    {
      title: 'Get Store Profitability',
      description:
        'Calculates store profitability for a specified date range using the Capstone formula: Gross Profit = Gross Sales - COGS, and Net Profit = Gross Profit - Store Operating Expenses. Tenant context is derived strictly from the server session; never supply an organization_id.',
      inputSchema: z.object({
        store_id: z
          .string()
          .describe(
            'Store UUID to analyze profitability for. Must belong to the authenticated organization.'
          ),
        start_date: z
          .string()
          .describe(
            'Start date for profitability analysis (YYYY-MM-DD or ISO-8601 string).'
          ),
        end_date: z
          .string()
          .describe(
            'End date for profitability analysis (YYYY-MM-DD or ISO-8601 string).'
          ),
      }),
    },
    async ({ store_id, start_date, end_date }) => {
      // Validate store_id - ensure it belongs to the authenticated tenant
      const storeValidation = await validateStoreBelongsToTenant(
        authContext.supabase,
        authContext.organizationId,
        store_id
      )

      if (!storeValidation.valid) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text:
                storeValidation.error ??
                'Invalid store specified for this organization.',
            },
          ],
        }
      }

      const result = await calculateStoreProfitability({
        supabase: authContext.supabase,
        organizationId: authContext.organizationId,
        storeId: store_id,
        startDate: start_date,
        endDate: end_date,
      })

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: result.error ?? 'Failed to calculate store profitability.',
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    }
  )

  // Register get_supplier_outstanding using official MCP v2 SDK registerTool API
  server.registerTool(
    'get_supplier_outstanding',
    {
      title: 'Get Supplier Outstanding Balances',
      description:
        'Identifies unpaid/outstanding supplier balances from active purchase orders, purchase order items, and goods receipts. Calculates due dates and overdue statuses using supplier payment terms (e.g. Net 30, Net 60). Tenant context is derived strictly from the server session; never supply an organization_id.',
      inputSchema: z.object({
        min_due: z
          .number()
          .min(0)
          .optional()
          .describe(
            'Optional minimum outstanding balance filter. Excludes suppliers with balances below this amount.'
          ),
        store_id: z
          .string()
          .optional()
          .describe(
            'Optional store UUID to filter purchase orders by store location. If omitted, evaluates all stores in the organization.'
          ),
        overdue_only: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'Whether to filter only to overdue supplier balances. Default is false.'
          ),
      }),
    },
    async ({ min_due, store_id, overdue_only }) => {
      // Validate store_id if provided - ensure it belongs to the authenticated tenant
      if (store_id) {
        const storeValidation = await validateStoreBelongsToTenant(
          authContext.supabase,
          authContext.organizationId,
          store_id
        )

        if (!storeValidation.valid) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text:
                  storeValidation.error ??
                  'Invalid store specified for this organization.',
              },
            ],
          }
        }
      }

      const result = await getSupplierOutstandingBalances({
        supabase: authContext.supabase,
        organizationId: authContext.organizationId,
        storeId: store_id,
        minDue: min_due ?? 0,
        overdueOnly: overdue_only ?? false,
      })

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text:
                result.error ??
                'Failed to retrieve supplier outstanding balances.',
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    }
  )

  // Register generate_business_report using official MCP v2 SDK registerTool API
  server.registerTool(
    'generate_business_report',
    {
      title: 'Generate Executive Business Report',
      description:
        'Generates a comprehensive executive AI business report for a specified calendar month (YYYY-MM). Aggregates gross/net sales, COGS, operating expenses, gross/net profit, margins, inventory valuation, low stock alerts, dead stock capital, supplier liabilities, key risks, and recommended operational focus areas. Tenant context is derived strictly from the server session; never supply an organization_id.',
      inputSchema: z.object({
        period_month: z
          .string()
          .regex(
            /^\d{4}-(?:0[1-9]|1[0-2])$/,
            'Expected YYYY-MM format (e.g. 2026-08)'
          )
          .describe(
            'Calendar month to generate the report for in YYYY-MM format (e.g. 2026-08).'
          ),
      }),
    },
    async ({ period_month }) => {
      const result = await generateExecutiveBusinessReport({
        supabase: authContext.supabase,
        organizationId: authContext.organizationId,
        periodMonth: period_month,
      })

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: result.error ?? 'Failed to generate executive business report.',
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    }
  )

  return server
}
