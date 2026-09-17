import type { AuthenticatedTenantContext } from '@/lib/auth/context'
export { createTenantMcpServer } from './server'
import {
  getLowStockProductsToolDefinition,
  executeGetLowStockProducts,
  type GetLowStockProductsInput,
} from './tools/get-low-stock-products'
import {
  getDeadStockToolDefinition,
  executeGetDeadStock,
  type GetDeadStockInput,
} from './tools/get-dead-stock'
import {
  getProfitabilityToolDefinition,
  executeGetProfitability,
  type GetProfitabilityInput,
} from './tools/get-profitability'
import {
  getSupplierOutstandingToolDefinition,
  executeGetSupplierOutstanding,
  type GetSupplierOutstandingInput,
} from './tools/get-supplier-outstanding'
import {
  generateBusinessReportToolDefinition,
  executeGenerateBusinessReport,
  type GenerateBusinessReportInput,
} from './tools/generate-business-report'

export type MCPToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/**
 * Registry of available MCP tools in RetailPilot AI.
 */
export const MCP_TOOLS: Record<string, MCPToolDefinition> = {
  get_low_stock_products: getLowStockProductsToolDefinition,
  get_dead_stock: getDeadStockToolDefinition,
  get_profitability: getProfitabilityToolDefinition,
  get_supplier_outstanding: getSupplierOutstandingToolDefinition,
  generate_business_report: generateBusinessReportToolDefinition,
}

/**
 * Dispatches an MCP tool call to its authorized handler.
 * Always passes the authenticated tenant context derived from the server session.
 */
export async function executeMCPTool(
  toolName: string,
  params: Record<string, unknown>,
  context: AuthenticatedTenantContext
): Promise<{
  success: boolean
  tool: string
  data?: unknown
  error?: string
}> {
  switch (toolName) {
    case 'get_low_stock_products': {
      const result = await executeGetLowStockProducts(
        params as GetLowStockProductsInput,
        context
      )
      return {
        success: result.success,
        tool: toolName,
        data: result.data,
        error: result.error,
      }
    }

    case 'get_dead_stock': {
      const result = await executeGetDeadStock(
        params as GetDeadStockInput,
        context
      )
      return {
        success: result.success,
        tool: toolName,
        data: result.data,
        error: result.error,
      }
    }

    case 'get_profitability': {
      const result = await executeGetProfitability(
        params as GetProfitabilityInput,
        context
      )
      return {
        success: result.success,
        tool: toolName,
        data: result.data,
        error: result.error,
      }
    }

    case 'get_supplier_outstanding': {
      const result = await executeGetSupplierOutstanding(
        params as GetSupplierOutstandingInput,
        context
      )
      return {
        success: result.success,
        tool: toolName,
        data: result.data,
        error: result.error,
      }
    }

    case 'generate_business_report': {
      const result = await executeGenerateBusinessReport(
        params as GenerateBusinessReportInput,
        context
      )
      return {
        success: result.success,
        tool: toolName,
        data: result.data,
        error: result.error,
      }
    }

    default:
      return {
        success: false,
        tool: toolName,
        error: `Unknown MCP tool "${toolName}". Available tools: ${Object.keys(
          MCP_TOOLS
        ).join(', ')}`,
      }
  }
}
