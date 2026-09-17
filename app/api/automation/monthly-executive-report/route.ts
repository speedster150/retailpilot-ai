import { NextResponse, type NextRequest } from 'next/server'
import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import { executeMonthlyExecutiveReportAutomation } from '@/lib/automation/monthly-executive-report'

/**
 * HTTP endpoint for Make.com scheduled Monthly Executive AI Report.
 *
 * Security:
 * - Derives authenticated tenant context strictly from the server session.
 * - Rejects unauthenticated requests (401) and customer accounts (403).
 * - Never trusts organization_id supplied by the client.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const authResult = await getAuthenticatedTenantContext(INVENTORY_ROLES)

  if (!authResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: authResult.error,
      },
      { status: authResult.status }
    )
  }

  try {
    let periodMonth: string | null = null
    let force = false

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}))
      if (body.period_month && typeof body.period_month === 'string') {
        periodMonth = body.period_month.trim()
      }
      if (typeof body.force === 'boolean') {
        force = body.force
      }
    }

    const result = await executeMonthlyExecutiveReportAutomation({
      supabase: authResult.context.supabase,
      organizationId: authResult.context.organizationId,
      periodMonth,
      force,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operational error'
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
