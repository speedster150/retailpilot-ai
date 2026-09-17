'use server'

import {
  getAuthenticatedTenantContext,
  INVENTORY_ROLES,
} from '@/lib/auth/context'
import {
  processAIAssistantMessage,
  type AIAssistantMessageResult,
} from '@/lib/ai/assistant'

/**
 * Server action to process an AI Business Assistant query.
 * Derives tenant and authenticated session strictly on the server.
 * Rejects unauthenticated requests and customer roles.
 */
export async function askAIAssistant(
  query: string
): Promise<AIAssistantMessageResult> {
  const authResult = await getAuthenticatedTenantContext(INVENTORY_ROLES)

  if (!authResult.success) {
    return {
      success: false,
      error: authResult.error,
      content: `### 🔒 Access Denied\n${authResult.error}`,
    }
  }

  return processAIAssistantMessage(query, authResult.context)
}
