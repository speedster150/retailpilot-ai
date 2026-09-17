import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export type UserRole =
  | 'admin_owner'
  | 'store_manager'
  | 'sales_staff'
  | 'inventory_staff'
  | 'customer'

export const INTERNAL_STAFF_ROLES = new Set<UserRole>([
  'admin_owner',
  'store_manager',
  'sales_staff',
  'inventory_staff',
])

export const INVENTORY_ROLES = new Set<UserRole>([
  'admin_owner',
  'store_manager',
  'inventory_staff',
])

export type AuthenticatedTenantContext = {
  supabase: SupabaseClient
  user: User
  organizationId: string
  role: UserRole
}

export type TenantContextResult =
  | { success: true; context: AuthenticatedTenantContext }
  | { success: false; error: string; status: number }

let _authContextOverride: (() => Promise<TenantContextResult>) | null = null

export function setAuthContextOverrideForTesting(
  override: (() => Promise<TenantContextResult>) | null
) {
  _authContextOverride = override
}

/**
 * Derives the authenticated user and organization tenant context strictly from
 * the server-side Supabase cookie session. Never trusts organization_id, user_id,
 * or role supplied by a client or an AI model.
 */
export async function getAuthenticatedTenantContext(
  requiredRoles: Set<UserRole> = INVENTORY_ROLES
): Promise<TenantContextResult> {
  if (_authContextOverride) {
    return _authContextOverride()
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      success: false,
      error: 'Authentication required. No active session found.',
      status: 401,
    }
  }

  // Derive organization membership from the database using user.id from verified session
  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)

  const membership = memberships?.[0]

  if (membershipError || !membership?.organization_id) {
    return {
      success: false,
      error: 'Account is not associated with an active organization.',
      status: 403,
    }
  }

  const role = membership.role as UserRole

  if (!requiredRoles.has(role)) {
    return {
      success: false,
      error: `Access denied. Role "${role}" is not authorized for this operation.`,
      status: 403,
    }
  }

  return {
    success: true,
    context: {
      supabase,
      user,
      organizationId: membership.organization_id,
      role,
    },
  }
}

/**
 * Validates that an optional store_id actually belongs to the authenticated organization.
 * Returns null if no storeId provided, or the validated storeId, or an error if invalid.
 */
export async function validateStoreBelongsToTenant(
  supabase: SupabaseClient,
  organizationId: string,
  storeId?: string | null
): Promise<{ valid: boolean; error?: string; storeId?: string }> {
  if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
    return { valid: true }
  }

  const trimmedStoreId = storeId.trim()

  const { data: store, error } = await supabase
    .from('stores')
    .select('id, name, is_active')
    .eq('id', trimmedStoreId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error || !store) {
    return {
      valid: false,
      error: 'Specified store does not exist in your organization.',
    }
  }

  return {
    valid: true,
    storeId: store.id,
  }
}
