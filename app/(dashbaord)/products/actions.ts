'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProductActionState = {
  error?: string
  success?: string
}

const PRODUCT_MANAGEMENT_ROLES = new Set([
  'admin_owner',
  'store_manager',
  'inventory_staff',
])

function textValue(formData: FormData, field: string) {
  const value = formData.get(field)
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(formData: FormData, field: string) {
  const value = Number(textValue(formData, field))
  return Number.isFinite(value) ? value : null
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

  if (error || !memberships?.[0]?.organization_id) {
    return { error: 'We could not determine your organization.' }
  }

  const membership = memberships[0]

  if (!PRODUCT_MANAGEMENT_ROLES.has(membership.role)) {
    return { error: 'You are not authorized to manage products.' }
  }

  return {
    supabase,
    organizationId: membership.organization_id,
  }
}

async function validateCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  categoryId: string
) {
  if (!categoryId) {
    return true
  }

  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  return !error && Boolean(data)
}

export async function saveProduct(
  _previousState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const context = await getAuthorizedContext()

  if ('error' in context) {
    return { error: context.error }
  }

  const name = textValue(formData, 'name')
  const sku = textValue(formData, 'sku')
  const barcode = textValue(formData, 'barcode')
  const categoryId = textValue(formData, 'category_id')
  const brand = textValue(formData, 'brand')
  const costPrice = numberValue(formData, 'cost_price')
  const sellingPrice = numberValue(formData, 'selling_price')
  const taxRate = numberValue(formData, 'tax_rate')
  const reorderLevel = numberValue(formData, 'reorder_level')
  const productId = textValue(formData, 'id')
  const isActive = textValue(formData, 'is_active') !== 'false'

  if (!name) {
    return { error: 'Product name is required.' }
  }

  if (costPrice === null || costPrice < 0) {
    return { error: 'Enter a valid non-negative cost price.' }
  }

  if (sellingPrice === null || sellingPrice < 0) {
    return { error: 'Enter a valid non-negative selling price.' }
  }

  if (taxRate === null || taxRate < 0 || taxRate > 100) {
    return { error: 'Tax rate must be between 0 and 100.' }
  }

  if (
    reorderLevel === null ||
    reorderLevel < 0 ||
    !Number.isInteger(reorderLevel)
  ) {
    return { error: 'Reorder level must be a non-negative whole number.' }
  }

  if (
    !(await validateCategory(
      context.supabase,
      context.organizationId,
      categoryId
    ))
  ) {
    return { error: 'Select a valid category from your organization.' }
  }

  const product = {
    name,
    sku: sku || null,
    barcode: barcode || null,
    category_id: categoryId || null,
    brand: brand || null,
    cost_price: costPrice,
    selling_price: sellingPrice,
    tax_rate: taxRate,
    reorder_level: reorderLevel,
    is_active: isActive,
  }

  const result = productId
    ? await context.supabase
        .from('products')
        .update(product)
        .eq('id', productId)
        .eq('organization_id', context.organizationId)
    : await context.supabase.from('products').insert({
        ...product,
        organization_id: context.organizationId,
      })

  if (result.error) {
    if (result.error.code === '23505') {
      return { error: 'SKU or barcode is already in use.' }
    }

    return { error: 'Unable to save the product. Please try again.' }
  }

  revalidatePath('/products')
  return { success: productId ? 'Product updated.' : 'Product added.' }
}

export async function toggleProductStatus(
  _previousState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const context = await getAuthorizedContext()

  if ('error' in context) {
    return { error: context.error }
  }

  const productId = textValue(formData, 'id')
  const isActive = textValue(formData, 'is_active') === 'true'

  if (!productId) {
    return { error: 'Product could not be identified.' }
  }

  const { error } = await context.supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', productId)
    .eq('organization_id', context.organizationId)

  if (error) {
    return { error: 'Unable to update the product status. Please try again.' }
  }

  revalidatePath('/products')
  return { success: isActive ? 'Product activated.' : 'Product deactivated.' }
}

export async function linkProductSupplier(
  _previousState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const context = await getAuthorizedContext()

  if ('error' in context) {
    return { error: context.error }
  }

  const productId = textValue(formData, 'product_id')
  const supplierId = textValue(formData, 'supplier_id')
  const supplierSku = textValue(formData, 'supplier_sku')
  const purchasePrice = numberValue(formData, 'purchase_price')
  const minimumOrderQuantity = numberValue(
    formData,
    'minimum_order_quantity'
  )
  const leadTimeDays = numberValue(formData, 'lead_time_days')
  const isPreferred = textValue(formData, 'is_preferred') === 'true'

  if (!productId || !supplierId) {
    return { error: 'Select both a product and a supplier.' }
  }

  if (purchasePrice === null || purchasePrice < 0) {
    return { error: 'Enter a valid non-negative purchase price.' }
  }

  if (
    minimumOrderQuantity === null ||
    minimumOrderQuantity < 1 ||
    !Number.isInteger(minimumOrderQuantity)
  ) {
    return { error: 'Minimum order quantity must be a whole number of at least 1.' }
  }

  if (
    leadTimeDays === null ||
    leadTimeDays < 0 ||
    !Number.isInteger(leadTimeDays)
  ) {
    return { error: 'Lead time must be a non-negative whole number.' }
  }

  const [{ data: product, error: productError }, { data: supplier, error: supplierError }] =
    await Promise.all([
      context.supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .eq('organization_id', context.organizationId)
        .maybeSingle(),
      context.supabase
        .from('suppliers')
        .select('id')
        .eq('id', supplierId)
        .eq('organization_id', context.organizationId)
        .maybeSingle(),
    ])

  if (productError || !product) {
    return { error: 'Select a valid product from your organization.' }
  }

  if (supplierError || !supplier) {
    return { error: 'Select a valid supplier from your organization.' }
  }

  const { data: existingLinks, error: duplicateCheckError } = await context.supabase
    .from('product_suppliers')
    .select('id')
    .eq('organization_id', context.organizationId)
    .eq('product_id', productId)
    .eq('supplier_id', supplierId)
    .limit(1)

  if (duplicateCheckError) {
    return { error: 'Unable to check existing supplier links. Please try again.' }
  }

  if (existingLinks && existingLinks.length > 0) {
    return { error: 'This product is already linked to that supplier.' }
  }

  const { error } = await context.supabase.from('product_suppliers').insert({
    organization_id: context.organizationId,
    product_id: productId,
    supplier_id: supplierId,
    supplier_sku: supplierSku || null,
    purchase_price: purchasePrice,
    minimum_order_quantity: minimumOrderQuantity,
    lead_time_days: leadTimeDays,
    is_preferred: isPreferred,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'This product is already linked to that supplier.' }
    }

    return { error: 'Unable to link the supplier. Please try again.' }
  }

  revalidatePath('/products')
  return { success: 'Supplier linked to product.' }
}
