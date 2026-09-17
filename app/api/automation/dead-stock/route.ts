import { NextResponse, type NextRequest } from 'next/server'
import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import { executeDeadStockBiweeklyAudit } from '@/lib/automation/dead-stock-audit'

/**
 * HTTP endpoint for Make.com scheduled bi-weekly dead stock audit.
 *
 * Security:
 * - Derives authenticated tenant context from the server session.
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
    let storeId: string | null = null
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}))
      if (body.store_id && typeof body.store_id === 'string') {
        storeId = body.store_id.trim()
      }
    }

    const result = await executeDeadStockBiweeklyAudit({
      supabase: authResult.context.supabase,
      organizationId: authResult.context.organizationId,
      storeId,
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
