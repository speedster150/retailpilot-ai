'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type SupplierActionState = {
  error?: string
  success?: string
}

const SUPPLIER_MANAGEMENT_ROLES = new Set([
  'admin_owner',
  'store_manager',
  'inventory_staff',
])

function textValue(formData: FormData, field: string) {
  const value = formData.get(field)
  return typeof value === 'string' ? value.trim() : ''
}

async function getAuthorizedContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Your session has expired. Please sign in again.' }
  }

  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)

  const membership = memberships?.[0]

  if (error || !membership?.organization_id) {
    return { error: 'We could not determine your organization.' }
  }

  if (!SUPPLIER_MANAGEMENT_ROLES.has(membership.role)) {
    return { error: 'You are not authorized to manage suppliers.' }
  }

  return {
    supabase,
    organizationId: membership.organization_id,
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return /^[+\d\s().-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15
}

async function supplierNameExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  name: string
) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('organization_id', organizationId)

  if (error) {
    return { error: true, exists: false }
  }

  const normalizedName = name.toLocaleLowerCase()
  const exists = (data ?? []).some(
    (supplier) => supplier.name?.trim().toLocaleLowerCase() === normalizedName
  )

  return { error: false, exists }
}

export async function saveSupplier(
  _previousState: SupplierActionState,
  formData: FormData
): Promise<SupplierActionState> {
  const context = await getAuthorizedContext()

  if ('error' in context) {
    return { error: context.error }
  }

  const name = textValue(formData, 'name')
  const contactPerson = textValue(formData, 'contact_person')
  const phone = textValue(formData, 'phone')
  const email = textValue(formData, 'email')
  const address = textValue(formData, 'address')
  const paymentTerms = textValue(formData, 'payment_terms')
  const isActive = textValue(formData, 'is_active') !== 'false'

  if (!name) {
    return { error: 'Supplier name is required.' }
  }

  if (email && !isValidEmail(email)) {
    return { error: 'Enter a valid email address.' }
  }

  if (phone && !isValidPhone(phone)) {
    return { error: 'Enter a valid phone number.' }
  }

  const duplicateCheck = await supplierNameExists(
    context.supabase,
    context.organizationId,
    name
  )

  if (duplicateCheck.error) {
    return { error: 'Unable to validate the supplier name. Please try again.' }
  }

  if (duplicateCheck.exists) {
    return { error: 'A supplier with this name already exists.' }
  }

  const { error } = await context.supabase.from('suppliers').insert({
    organization_id: context.organizationId,
    name,
    contact_person: contactPerson || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
    payment_terms: paymentTerms || null,
    is_active: isActive,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'A supplier with this name already exists.' }
    }

    return { error: 'Unable to save the supplier. Please try again.' }
  }

  revalidatePath('/suppliers')
  return { success: 'Supplier added.' }
}
