'use server'

import { revalidatePath } from 'next/cache'
import {
  getAuthenticatedTenantContext,
  INTERNAL_STAFF_ROLES,
} from '@/lib/auth/context'

export type CustomerActionState = {
  error?: string
  success?: string
}

function textValue(formData: FormData, field: string) {
  const value = formData.get(field)
  return typeof value === 'string' ? value.trim() : ''
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return /^[+\d\s().-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15
}

export async function saveCustomer(
  _previousState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const authResult = await getAuthenticatedTenantContext(INTERNAL_STAFF_ROLES)

  if (!authResult.success) {
    return { error: authResult.error }
  }

  const { supabase, organizationId } = authResult.context

  const name = textValue(formData, 'name')
  const phone = textValue(formData, 'phone')
  const email = textValue(formData, 'email')
  const address = textValue(formData, 'address')
  const rawPoints = textValue(formData, 'loyalty_points')
  const isActive = textValue(formData, 'is_active') !== 'false'

  if (!name) {
    return { error: 'Customer name is required.' }
  }

  if (email && !isValidEmail(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  if (phone && !isValidPhone(phone)) {
    return { error: 'Please enter a valid telephone number.' }
  }

  const loyaltyPoints = Number(rawPoints)
  const safePoints = Number.isFinite(loyaltyPoints) && loyaltyPoints >= 0 ? loyaltyPoints : 0

  const { error } = await supabase.from('customers').insert({
    organization_id: organizationId,
    name,
    phone: phone || null,
    email: email || null,
    address: address || null,
    loyalty_points: safePoints,
    is_active: isActive,
  })

  if (error) {
    console.error('Error saving customer:', error)
    return { error: 'Unable to save customer record. Please try again.' }
  }

  revalidatePath('/customers')
  return { success: 'Customer profile created successfully.' }
}
