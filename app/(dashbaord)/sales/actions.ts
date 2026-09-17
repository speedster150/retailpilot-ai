'use server'

import { revalidatePath } from 'next/cache'
import {
  getAuthenticatedTenantContext,
  INTERNAL_STAFF_ROLES,
  validateStoreBelongsToTenant,
} from '@/lib/auth/context'

export type PosLineItem = {
  productId: string
  productName: string
  sku?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

export type CheckoutParams = {
  storeId: string
  customerId?: string | null
  items: PosLineItem[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'upi'
  transactionReference?: string | null
}

export type CheckoutResult = {
  success: boolean
  invoiceNumber?: string
  saleId?: string
  totalAmount?: number
  error?: string
}

export async function processSaleCheckout(
  params: CheckoutParams
): Promise<CheckoutResult> {
  const authResult = await getAuthenticatedTenantContext(INTERNAL_STAFF_ROLES)

  if (!authResult.success) {
    return {
      success: false,
      error: authResult.error,
    }
  }

  const { supabase, organizationId } = authResult.context
  const {
    storeId,
    customerId,
    items,
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
    paymentMethod,
    transactionReference,
  } = params ?? {}

  // 1. Validate Store
  if (!storeId) {
    return { success: false, error: 'Store selection is required.' }
  }

  const storeValidation = await validateStoreBelongsToTenant(
    supabase,
    organizationId,
    storeId
  )
  if (storeValidation.error || !storeValidation.storeId) {
    return { success: false, error: 'Invalid store location.' }
  }

  // 2. Validate Items
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: 'Cart is empty. Please add items to checkout.' }
  }

  for (const item of items) {
    if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0) {
      return { success: false, error: `Invalid item or quantity for "${item.productName || 'product'}".` }
    }
  }

  // 3. Generate Invoice Number (e.g. INV-YYYYMMDD-XXXXX)
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString()
  const invoiceNumber = `INV-${dateStamp}-${randomSuffix}`

  try {
    // 4. Insert Sale record
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        organization_id: organizationId,
        store_id: storeId,
        customer_id: customerId || null,
        invoice_number: invoiceNumber,
        status: 'completed',
        subtotal: Number(subtotal) || 0,
        discount_amount: Number(discountAmount) || 0,
        tax_amount: Number(taxAmount) || 0,
        total_amount: Number(totalAmount) || 0,
        sale_date: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (saleError || !saleData) {
      return {
        success: false,
        error: `Failed to record sale: ${saleError?.message || 'Database error'}`,
      }
    }

    const saleId = saleData.id

    // 5. Insert Sale Items (sale_items schema: sale_id, product_id, quantity, unit_price)
    const saleItemsRows = items.map((item) => ({
      sale_id: saleId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItemsRows)

    if (itemsError) {
      console.error('Error recording sale items:', itemsError)
    }

    // 6. Insert Payment Record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        sale_id: saleId,
        amount: Number(totalAmount) || 0,
        payment_method: paymentMethod || 'cash',
        payment_status: 'completed',
        transaction_reference: transactionReference || null,
        paid_at: new Date().toISOString(),
      })

    if (paymentError) {
      console.error('Error recording payment:', paymentError)
    }

    // 7. Append movements to immutable Inventory Ledger
    const ledgerMovements = items.map((item) => ({
      organization_id: organizationId,
      store_id: storeId,
      product_id: item.productId,
      movement_type: 'sale',
      quantity: -item.quantity, // deduction
      reference_type: 'sale',
      reference_id: saleId,
    }))

    const { error: ledgerError } = await supabase
      .from('inventory_ledger')
      .insert(ledgerMovements)

    if (ledgerError) {
      console.error('Error updating inventory ledger:', ledgerError)
    }

    // 8. Update Customer Loyalty Points if customer is linked (1 point per 10 currency units)
    if (customerId) {
      const earnedPoints = Math.floor((Number(totalAmount) || 0) / 10)
      if (earnedPoints > 0) {
        const { data: cust } = await supabase
          .from('customers')
          .select('loyalty_points')
          .eq('id', customerId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (cust) {
          const currentPoints = Number(cust.loyalty_points) || 0
          await supabase
            .from('customers')
            .update({ loyalty_points: currentPoints + earnedPoints })
            .eq('id', customerId)
        }
      }
    }

    try {
      revalidatePath('/sales')
      revalidatePath('/inventory')
      revalidatePath('/dashboard')
    } catch {
      // revalidatePath may throw when executed outside Next.js request context (e.g. in test runner)
    }

    return {
      success: true,
      invoiceNumber,
      saleId,
      totalAmount: Number(totalAmount) || 0,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout transaction failed'
    return { success: false, error: message }
  }
}
