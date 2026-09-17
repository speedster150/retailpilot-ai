'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type GoodsReceiptActionState = {
  error?: string
  success?: string
}

export type CompleteGoodsReceiptActionState = {
  error?: string
  success?: string
}

const GOODS_RECEIPT_ROLES = new Set([
  'admin_owner',
  'store_manager',
  'inventory_staff',
])

type ReceiptLineInput = {
  purchaseOrderItemId?: unknown
  productId?: unknown
  quantityReceived?: unknown
  unitCost?: unknown
}

type SupabaseErrorLike = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

function reportSupabaseError(
  operation: string,
  error: SupabaseErrorLike,
  fallbackMessage: string
) {
  const diagnostic = {
    operation,
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  }

  console.error('[Goods Receipt Supabase Error]', diagnostic)

  if (process.env.NODE_ENV === 'development') {
    return `${fallbackMessage} ${JSON.stringify(diagnostic)}`
  }

  return fallbackMessage
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

  if (!GOODS_RECEIPT_ROLES.has(membership.role)) {
    return { error: 'You are not authorized to create goods receipts.' }
  }

  return {
    supabase,
    organizationId: membership.organization_id,
  }
}

export async function completeGoodsReceipt(
  _previousState: CompleteGoodsReceiptActionState,
  formData: FormData
): Promise<CompleteGoodsReceiptActionState> {
  const context = await getAuthorizedContext()

  if ('error' in context) {
    return { error: context.error }
  }

  const receiptId = textValue(formData, 'receipt_id')

  if (!receiptId) {
    return { error: 'Select a goods receipt to complete.' }
  }

  const { data, error } = await context.supabase.rpc(
    'complete_goods_receipt',
    { p_goods_receipt_id: receiptId }
  )

  if (error) {
    return {
      error: reportSupabaseError(
        'complete_goods_receipt RPC',
        error,
        'Unable to complete the goods receipt. Please try again.'
      ),
    }
  }

  const result = data as { status?: string } | null

  revalidatePath('/goods-receipts')
  revalidatePath('/inventory')
  revalidatePath('/dashboard')

  if (result?.status === 'already_received') {
    return {
      success: 'This goods receipt was already completed; no duplicate movement was created.',
    }
  }

  return { success: 'Goods receipt completed and inventory updated.' }
}

async function cleanupReceipt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  receiptId: string
) {
  await supabase
    .from('goods_receipt_items')
    .delete()
    .eq('goods_receipt_id', receiptId)

  await supabase
    .from('goods_receipts')
    .delete()
    .eq('id', receiptId)
    .eq('organization_id', organizationId)
}

export async function createGoodsReceipt(
  _previousState: GoodsReceiptActionState,
  formData: FormData
): Promise<GoodsReceiptActionState> {
  const context = await getAuthorizedContext()

  if ('error' in context) {
    return { error: context.error }
  }

  const receiptNumber = textValue(formData, 'receipt_number')
  const purchaseOrderId = textValue(formData, 'purchase_order_id')
  const receivedDate = textValue(formData, 'received_date')
  const status = textValue(formData, 'status')
  const notes = textValue(formData, 'notes')
  const rawItems = textValue(formData, 'items')

  if (!receiptNumber || !purchaseOrderId || !receivedDate) {
    return {
      error: 'Receipt number, purchase order, and received date are required.',
    }
  }

  if (status !== 'draft' && status !== 'received') {
    return { error: 'Select a valid goods-receipt status.' }
  }

  const parsedDate = new Date(receivedDate)

  if (Number.isNaN(parsedDate.getTime())) {
    return { error: 'Enter a valid received date.' }
  }

  let parsedItems: ReceiptLineInput[]

  try {
    const value: unknown = JSON.parse(rawItems)
    parsedItems = Array.isArray(value) ? value : []
  } catch {
    parsedItems = []
  }

  if (parsedItems.length === 0) {
    return { error: 'Add at least one received product.' }
  }

  const lines = parsedItems.map((item) => ({
    purchaseOrderItemId:
      typeof item.purchaseOrderItemId === 'string'
        ? item.purchaseOrderItemId
        : '',
    productId: typeof item.productId === 'string' ? item.productId : '',
    quantityReceived: Number(item.quantityReceived),
    unitCost: Number(item.unitCost),
  }))

  if (
    lines.some(
      (line) =>
        !line.purchaseOrderItemId ||
        !line.productId ||
        !Number.isInteger(line.quantityReceived) ||
        line.quantityReceived <= 0 ||
        !Number.isFinite(line.unitCost) ||
        line.unitCost < 0
    )
  ) {
    return {
      error: 'Each received line needs a product, positive whole quantity, and valid cost.',
    }
  }

  const itemIds = lines.map((line) => line.purchaseOrderItemId)
  const productIds = lines.map((line) => line.productId)

  if (new Set(itemIds).size !== itemIds.length) {
    return { error: 'A purchase-order item can only be received once per GRN.' }
  }

  const [{ data: purchaseOrder, error: purchaseOrderError }, { data: existingReceipt, error: receiptCheckError }] =
    await Promise.all([
      context.supabase
        .from('purchase_orders')
        .select('id, store_id')
        .eq('id', purchaseOrderId)
        .eq('organization_id', context.organizationId)
        .maybeSingle(),
      context.supabase
        .from('goods_receipts')
        .select('id')
        .eq('organization_id', context.organizationId)
        .eq('receipt_number', receiptNumber)
        .limit(1),
    ])

  if (purchaseOrderError || !purchaseOrder) {
    if (purchaseOrderError) {
      return {
        error: reportSupabaseError(
          'purchase_orders lookup',
          purchaseOrderError,
          'Select a valid purchase order from your organization.'
        ),
      }
    }

    return { error: 'Select a valid purchase order from your organization.' }
  }

  if (receiptCheckError) {
    return {
      error: reportSupabaseError(
        'goods_receipts duplicate-number lookup',
        receiptCheckError,
        'Unable to check the receipt number. Please try again.'
      ),
    }
  }

  if (existingReceipt && existingReceipt.length > 0) {
    return { error: 'This receipt number already exists in your organization.' }
  }

  const { data: purchaseOrderItems, error: itemCheckError } = await context.supabase
    .from('purchase_order_items')
    .select('id, product_id')
    .eq('purchase_order_id', purchaseOrderId)
    .in('id', itemIds)

  if (
    itemCheckError ||
    !purchaseOrderItems ||
    purchaseOrderItems.length !== lines.length ||
    purchaseOrderItems.some((item) => !productIds.includes(item.product_id))
  ) {
    if (itemCheckError) {
      return {
        error: reportSupabaseError(
          'purchase_order_items lookup',
          itemCheckError,
          'Select products that belong to the chosen purchase order.'
        ),
      }
    }

    return { error: 'Select products that belong to the chosen purchase order.' }
  }

  const { data: products, error: productsError } = await context.supabase
    .from('products')
    .select('id')
    .eq('organization_id', context.organizationId)
    .in('id', productIds)

  if (productsError || !products || products.length !== new Set(productIds).size) {
    if (productsError) {
      return {
        error: reportSupabaseError(
          'products lookup',
          productsError,
          'One or more received products are outside your organization.'
        ),
      }
    }

    return { error: 'One or more received products are outside your organization.' }
  }

  const { data: receipt, error: receiptError } = await context.supabase
    .from('goods_receipts')
    .insert({
      organization_id: context.organizationId,
      receipt_number: receiptNumber,
      purchase_order_id: purchaseOrderId,
      store_id: purchaseOrder.store_id,
      received_date: receivedDate,
      status,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (receiptError || !receipt) {
    if (receiptError) {
      const diagnostic = reportSupabaseError(
        'goods_receipts INSERT ... SELECT',
        receiptError,
        receiptError.code === '23505'
          ? 'This receipt number already exists in your organization.'
          : 'Unable to create the goods receipt. Please try again.'
      )

      return {
        error: diagnostic,
      }
    }

    return {
      error:
        'Unable to create the goods receipt: Supabase returned no receipt row after INSERT ... SELECT.',
    }
  }

  const { error: receiptItemsError } = await context.supabase
    .from('goods_receipt_items')
    .insert(
      lines.map((line) => ({
        goods_receipt_id: receipt.id,
        purchase_order_item_id: line.purchaseOrderItemId,
        product_id: line.productId,
        quantity_received: line.quantityReceived,
        unit_cost: line.unitCost,
      }))
    )

  if (receiptItemsError) {
    await cleanupReceipt(context.supabase, context.organizationId, receipt.id)
    return {
      error: reportSupabaseError(
        'goods_receipt_items INSERT',
        receiptItemsError,
        'Unable to save goods-receipt items. Please try again.'
      ),
    }
  }

  if (status === 'received') {
    const { data: existingMovements, error: movementCheckError } = await context.supabase
      .from('inventory_ledger')
      .select('id')
      .eq('organization_id', context.organizationId)
      .eq('reference_type', 'goods_receipt')
      .eq('reference_id', receipt.id)
      .limit(1)

    if (movementCheckError || (existingMovements && existingMovements.length > 0)) {
      await cleanupReceipt(context.supabase, context.organizationId, receipt.id)

      if (movementCheckError) {
        return {
          error: reportSupabaseError(
            'inventory_ledger duplicate-movement lookup',
            movementCheckError,
            'Unable to verify the inventory movement for this receipt.'
          ),
        }
      }

      return {
        error: 'This goods receipt already has an inventory movement.',
      }
    }

    const { error: ledgerError } = await context.supabase
      .from('inventory_ledger')
      .insert(
        lines.map((line) => ({
          organization_id: context.organizationId,
          product_id: line.productId,
          store_id: purchaseOrder.store_id,
          movement_type: 'purchase',
          quantity: line.quantityReceived,
          reference_type: 'goods_receipt',
          reference_id: receipt.id,
          notes: `Goods receipt ${receiptNumber}`,
        }))
      )

    if (ledgerError) {
      await cleanupReceipt(context.supabase, context.organizationId, receipt.id)
      return {
        error: reportSupabaseError(
          'inventory_ledger INSERT',
          ledgerError,
          'Unable to update inventory from this receipt.'
        ),
      }
    }
  }

  revalidatePath('/goods-receipts')
  revalidatePath('/inventory')
  revalidatePath('/dashboard')
  return { success: 'Goods receipt created.' }
}
