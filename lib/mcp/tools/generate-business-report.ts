import {
  generateExecutiveBusinessReport,
  type ExecutiveReportResult,
} from '@/lib/reports/business-report'
import type { AuthenticatedTenantContext } from '@/lib/auth/context'

export type GenerateBusinessReportInput = {
  period_month: string
}

export const generateBusinessReportToolDefinition = {
  name: 'generate_business_report',
  description:
    'Generates a comprehensive executive AI business report for a specified calendar month (YYYY-MM). Aggregates gross/net sales, COGS, operating expenses, gross/net profit, margins, inventory valuation, low stock alerts, dead stock capital, supplier liabilities, key risks, and recommended operational focus areas. Tenant context is derived strictly from the server session; never supply an organization_id.',
  parameters: {
    type: 'object',
    properties: {
      period_month: {
        type: 'string',
        pattern: '^\\d{4}-(?:0[1-9]|1[0-2])$',
        description:
          'Calendar month to generate the report for in YYYY-MM format (e.g. 2026-08).',
      },
    },
    required: ['period_month'],
    additionalProperties: false,
  },
}

/**
 * Handler for the generate_business_report MCP tool.
 * Binds execution strictly to context.organizationId.
 */
export async function executeGenerateBusinessReport(
  params: GenerateBusinessReportInput,
  context: AuthenticatedTenantContext
): Promise<{
  success: boolean
  data?: ExecutiveReportResult
  error?: string
}> {
  const { period_month } = params ?? {}

  if (!period_month) {
    return {
      success: false,
      error: 'period_month parameter is required (format: YYYY-MM).',
    }
  }

  const result = await generateExecutiveBusinessReport({
    supabase: context.supabase,
    organizationId: context.organizationId,
    periodMonth: period_month,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to generate business report.',
    }
  }

  return {
    success: true,
    data: result,
  }
}
