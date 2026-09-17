import { NextResponse, type NextRequest } from 'next/server'
import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import { executeDailySalesDossierAutomation } from '@/lib/automation/daily-sales-dossier'

/**
 * HTTP endpoint for Make.com scheduled Daily End-of-Day Sales Dossier.
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
    let storeId: string | null = null
    let businessDate: string | null = null
    let timezone: string | null = null
    let force = false

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}))
      if (body.store_id && typeof body.store_id === 'string') {
        storeId = body.store_id.trim()
      }
      if (body.business_date && typeof body.business_date === 'string') {
        businessDate = body.business_date.trim()
      }
      if (body.timezone && typeof body.timezone === 'string') {
        timezone = body.timezone.trim()
      }
      if (typeof body.force === 'boolean') {
        force = body.force
      }
    }

    const result = await executeDailySalesDossierAutomation({
      supabase: authResult.context.supabase,
      organizationId: authResult.context.organizationId,
      storeId,
      businessDate,
      timezone,
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
