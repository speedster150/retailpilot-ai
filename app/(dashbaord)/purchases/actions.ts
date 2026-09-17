'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PurchaseOrderActionState = {
  error?: string
  success?: string
}

const PURCHASE_MANAGEMENT_ROLES = new Set([
  'admin_owner',
  'store_manager',
  'inventory_staff',
])

type PurchaseOrderLineInput = {
  productId?: unknown
  quantity?: unknown
  unitCost?: unknown
}

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

  if (!PURCHASE_MANAGEMENT_ROLES.has(membership.role)) {
    return { error: 'You are not authorized to create purchase orders.' }
  }

  return {
    supabase,
    userId: user.id,
    organizationId: membership.organization_id,
  }
}

async function getUniquePoNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `PO-${new Date().getUTCFullYear()}-${randomUUID()
      .replaceAll('-', '')
      .slice(0, 8)
      .toUpperCase()}`

    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('po_number', candidate)
      .limit(1)

    if (error) {
      return { error: true, poNumber: null }
    }

    if (!data || data.length === 0) {
      return { error: false, poNumber: candidate }
    }
  }

  return { error: true, poNumber: null }
}

export async function createPurchaseOrder(
  _previousState: PurchaseOrderActionState,
  formData: FormData
): Promise<PurchaseOrderActionState> {
  const context = await getAuthorizedContext()

  if ('error' in context) {
    return { error: context.error }
  }

  const storeId = textValue(formData, 'store_id')
  const supplierId = textValue(formData, 'supplier_id')
  const expectedDate = textValue(formData, 'expected_date')
  const notes = textValue(formData, 'notes')
  const rawItems = textValue(formData, 'items')

  if (!storeId || !supplierId) {
    return { error: 'Select both a store and a supplier.' }
  }

  let parsedItems: PurchaseOrderLineInput[]

  try {
    const value: unknown = JSON.parse(rawItems)
    parsedItems = Array.isArray(value) ? value : []
  } catch {
    parsedItems = []
  }

  if (parsedItems.length === 0) {
    return { error: 'Add at least one product to the purchase order.' }
  }

  const lines = parsedItems.map((item) => {
    const productId = typeof item.productId === 'string' ? item.productId : ''
    const quantity = Number(item.quantity)
    const unitCost = Number(item.unitCost)

    return { productId, quantity, unitCost }
  })

  if (
    lines.some(
      (line) =>
        !line.productId ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isFinite(line.unitCost) ||
        line.unitCost < 0
    )
  ) {
    return {
      error: 'Each line needs a product, positive whole quantity, and valid price.',
    }
  }

  const productIds = lines.map((line) => line.productId)

  if (new Set(productIds).size !== productIds.length) {
    return { error: 'Each product can only appear once in a purchase order.' }
  }

  const [storeResult, supplierResult, productsResult] = await Promise.all([
    context.supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('organization_id', context.organizationId)
      .maybeSingle(),
    context.supabase
      .from('suppliers')
      .select('id')
      .eq('id', supplierId)
      .eq('organization_id', context.organizationId)
      .maybeSingle(),
    context.supabase
      .from('products')
      .select('id')
      .eq('organization_id', context.organizationId)
      .in('id', productIds),
  ])

  if (storeResult.error || !storeResult.data) {
    return { error: 'Select a valid store from your organization.' }
  }

  if (supplierResult.error || !supplierResult.data) {
    return { error: 'Select a valid supplier from your organization.' }
  }

  if (
    productsResult.error ||
    !productsResult.data ||
    productsResult.data.length !== productIds.length
  ) {
    return { error: 'Select valid products from your organization.' }
  }

  const poNumberResult = await getUniquePoNumber(
    context.supabase,
    context.organizationId
  )

  if (poNumberResult.error || !poNumberResult.poNumber) {
    return { error: 'Unable to generate a unique PO number. Please try again.' }
  }

  let purchaseOrderId: string | null = null
  let purchaseOrderError: { code?: string } | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentPoNumber =
      attempt === 0
        ? poNumberResult.poNumber
        : (await getUniquePoNumber(context.supabase, context.organizationId))
            .poNumber

    if (!currentPoNumber) {
      purchaseOrderError = { code: 'po_number_generation_failed' }
      break
    }

    const { data, error } = await context.supabase
      .from('purchase_orders')
      .insert({
        organization_id: context.organizationId,
        po_number: currentPoNumber,
        supplier_id: supplierId,
        store_id: storeId,
        status: 'draft',
        order_date: new Date().toISOString(),
        expected_date: expectedDate || null,
        notes: notes || null,
        created_by: context.userId,
      })
      .select('id')
      .single()

    if (!error && data) {
      purchaseOrderId = data.id
      break
    }

    purchaseOrderError = error

    if (error?.code !== '23505') {
      break
    }
  }

  if (!purchaseOrderId) {
    return purchaseOrderError?.code === '23505'
      ? { error: 'Unable to reserve a unique PO number. Please try again.' }
      : { error: 'Unable to create the purchase order. Please try again.' }
  }

  const { error: itemsError } = await context.supabase
    .from('purchase_order_items')
    .insert(
      lines.map((line) => ({
        purchase_order_id: purchaseOrderId,
        product_id: line.productId,
        quantity: line.quantity,
        unit_cost: line.unitCost,
      }))
    )

  if (itemsError) {
    await context.supabase
      .from('purchase_orders')
      .delete()
      .eq('id', purchaseOrderId)
      .eq('organization_id', context.organizationId)

    return { error: 'Unable to save purchase-order items. Please try again.' }
  }

  revalidatePath('/purchases')
  return { success: 'Purchase order created.' }
}
