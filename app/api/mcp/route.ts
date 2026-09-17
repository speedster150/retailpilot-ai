import { NextResponse, type NextRequest } from 'next/server'
import { createMcpHandler } from '@modelcontextprotocol/server'
import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import { createTenantMcpServer } from '@/lib/mcp/server'

/**
 * Handles incoming web-standard HTTP requests for the MCP server.
 * Derives authenticated tenant context from the server-side Supabase cookie session.
 * Rejects unauthenticated requests and customer accounts before any MCP dispatch.
 */
async function handleMcpRequest(request: Request | NextRequest): Promise<Response> {
  // 1. Derive authenticated tenant context and enforce RBAC
  const authResult = await getAuthenticatedTenantContext(INVENTORY_ROLES)

  if (!authResult.success) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: authResult.error,
        },
        id: null,
      },
      { status: authResult.status }
    )
  }

  // 2. Create official MCP Streamable HTTP handler bound to the authenticated tenant
  const handler = createMcpHandler(
    () => createTenantMcpServer(authResult.context),
    {
      legacy: 'stateless',
    }
  )

  // 3. Delegate to official MCP SDK fetch handler
  return handler.fetch(request)
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request)
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request)
}
