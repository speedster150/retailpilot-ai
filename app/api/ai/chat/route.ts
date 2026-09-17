import { NextResponse, type NextRequest } from 'next/server'
import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import { processAIAssistantMessage } from '@/lib/ai/assistant'

/**
 * AI Business Assistant HTTP Chat Endpoint.
 * Strictly derives authenticated tenant context from the server-side Supabase session.
 * Rejects unauthenticated requests (401) and customer role accounts (403).
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
    const body = await request.json()
    const { query } = body ?? {}

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'query parameter is required and must be a string.',
        },
        { status: 400 }
      )
    }

    const result = await processAIAssistantMessage(query, authResult.context)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid request'
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    )
  }
}
