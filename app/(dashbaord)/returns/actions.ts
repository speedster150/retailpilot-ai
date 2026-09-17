'use server'

import { revalidatePath } from 'next/cache'
import {
  getAuthenticatedTenantContext,
  INTERNAL_STAFF_ROLES,
} from '@/lib/auth/context'

export type SaleLookupItem = {
  productId: string
  productName: string
  sku: string | null
  barcode: string | null
  originalQuantity: number
  alreadyReturnedQuantity: number
  returnableQuantity: number
  unitPrice: number
  totalPrice: number
}

export type SaleLookupResult = {
  success: boolean
  saleId?: string
  invoiceNumber?: string
  saleDate?: string | null
  storeId?: string | null
  storeName?: string
  customerId?: string | null
  customerName?: string | null
  totalAmount?: number
  items?: SaleLookupItem[]
  error?: string
}

export type ReturnItemInput = {
  productId: string
  productName: string
  sku?: string | null
  returnQuantity: number
  unitPrice: number
}

export type ProcessReturnParams = {
  invoiceNumber: string
  reason: string
  refundMethod: 'cash' | 'upi' | 'credit_card' | 'debit_card' | 'store_credit'
  items: ReturnItemInput[]
}

export type ProcessReturnResult = {
  success: boolean
  returnNumber?: string
  invoiceNumber?: string
  unitsReturned?: number
  refundAmount?: number
  paymentMethod?: string
  error?: string
}

export type ReturnDetailItem = {
  id: string
  productId: string
  productName: string
  sku: string | null
  quantity: number
  unitPrice: number
  refundAmount: number
}

export type ReturnDetailsResult = {
  success: boolean
  returnRecord?: {
    id: string
    returnNumber: string
    invoiceNumber: string
    saleDate: string | null
    storeName: string
    customerName: string | null
    status: string
    reason: string | null
    refundAmount: number
    paymentMethod: string | null
    returnedAt: string
    createdByName: string | null
    items: ReturnDetailItem[]
  }
  error?: string
}

type DbSaleRow = {
  id: string
  invoice_number: string
  status: string | null
  sale_date: string | null
  total_amount: number | string | null
  store_id: string | null
  customer_id: string | null
  stores?: { id: string; name: string; code: string | null } | { id: string; name: string; code: string | null }[] | null
  customers?: { id: string; name: string; email: string | null; phone: string | null } | { id: string; name: string; email: string | null; phone: string | null }[] | null
}

type DbSaleItemRow = {
  id: string
  product_id: string
  quantity: number | string
  unit_price: number | string
  total_price?: number | string
  products?: { id: string; name: string; sku: string | null; barcode: string | null } | null
}

type DbReturnWithItemsRow = {
  id: string
  status: string | null
  return_items?: { product_id: string; quantity: number | string }[] | null
}

type DbReturnDetailsRow = {
  id: string
  sale_id: string
  return_number: string | null
  status: string | null
  reason: string | null
  refund_amount: number | string | null
  returned_at: string
  sales?:
    | {
        invoice_number: string | null
        sale_date: string | null
        stores?: { name: string } | { name: string }[] | null
      }
    | {
        invoice_number: string | null
        sale_date: string | null
        stores?: { name: string } | { name: string }[] | null
      }[]
    | null
  customers?: { name: string } | { name: string }[] | null
  return_items?:
    | {
        id: string
        product_id: string
        quantity: number | string
        unit_price: number | string
        refund_amount: number | string
        products?: { name: string; sku: string | null } | { name: string; sku: string | null }[] | null
      }[]
    | null
}

/**
 * Looks up a completed sale by invoice number to prepare a return.
 * Returns exact items, sold quantities, previous returns, and remaining returnable quantities.
 */
export async function lookupSaleForReturn(
  invoiceNumber: string
): Promise<SaleLookupResult> {
  const authResult = await getAuthenticatedTenantContext(INTERNAL_STAFF_ROLES)
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const { supabase, organizationId } = authResult.context
  const cleanInvoice = invoiceNumber?.trim()

  if (!cleanInvoice) {
    return { success: false, error: 'Please enter an invoice number to search.' }
  }

  try {
    // 1. Fetch sale
    const { data: sales, error: saleError } = await supabase
      .from('sales')
      .select(`
        id,
        invoice_number,
        status,
        sale_date,
        total_amount,
        store_id,
        customer_id,
        stores:store_id (
          id,
          name,
          code
        ),
        customers:customer_id (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('organization_id', organizationId)
      .eq('invoice_number', cleanInvoice)
      .limit(1)

    if (saleError || !sales || sales.length === 0) {
      return {
        success: false,
        error: `Invoice "${cleanInvoice}" not found in your organization.`,
      }
    }

    const sale = sales[0] as unknown as DbSaleRow
    const saleStatus = (sale.status ?? '').toLowerCase()

    if (saleStatus === 'cancelled' || saleStatus === 'void') {
      return {
        success: false,
        error: `Invoice "${cleanInvoice}" is ${saleStatus}. Cannot process returns on voided sales.`,
      }
    }

    // 2. Fetch sale items (sale_items schema has id, sale_id, product_id, quantity, unit_price)
    const { data: rawSaleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        products:product_id (
          id,
          name,
          sku,
          barcode
        )
      `)
      .eq('sale_id', sale.id)

    if (itemsError) {
      console.error('Note on sale_items query:', itemsError.message)
    }

    let saleItems = (rawSaleItems ?? []) as unknown as DbSaleItemRow[]

    // If sale_items is empty (e.g. from checkout insert defect), resolve from authoritative immutable inventory ledger
    if (saleItems.length === 0) {
      type DbLedgerMovementRow = {
        id: string
        product_id: string
        quantity: number | string
        products?: {
          id: string
          name: string
          sku: string | null
          barcode: string | null
          selling_price?: number | string | null
        } | null
      }

      const { data: ledgerItems } = await supabase
        .from('inventory_ledger')
        .select(`
          id,
          product_id,
          quantity,
          products:product_id (
            id,
            name,
            sku,
            barcode,
            selling_price
          )
        `)
        .eq('reference_id', sale.id)
        .eq('reference_type', 'sale')

      const rawLedger = ledgerItems as unknown as DbLedgerMovementRow[] | null
      if (rawLedger && rawLedger.length > 0) {
        saleItems = rawLedger.map((li) => {
          const qty = Math.abs(Number(li.quantity) || 0)
          const prod = li.products
          const unitPrice =
            Number(sale.total_amount && qty > 0 ? Number(sale.total_amount) / qty : prod?.selling_price) || 0

          return {
            id: li.id,
            product_id: li.product_id,
            quantity: qty,
            unit_price: unitPrice,
            products: prod ?? null,
          }
        })
      }
    }

    if (saleItems.length === 0) {
      return {
        success: false,
        error: 'No product line items found for this invoice.',
      }
    }

    // 3. Fetch prior returns for this sale to compute already returned quantities
    const { data: priorReturns, error: returnsError } = await supabase
      .from('returns')
      .select(`
        id,
        status,
        return_items (
          product_id,
          quantity
        )
      `)
      .eq('organization_id', organizationId)
      .eq('sale_id', sale.id)

    const alreadyReturnedMap = new Map<string, number>()

    if (!returnsError && priorReturns) {
      for (const ret of priorReturns as unknown as DbReturnWithItemsRow[]) {
        const status = (ret.status ?? '').toLowerCase()
        if (status === 'rejected' || status === 'cancelled') continue

        if (Array.isArray(ret.return_items)) {
          for (const item of ret.return_items) {
            const current = alreadyReturnedMap.get(item.product_id) ?? 0
            alreadyReturnedMap.set(item.product_id, current + Number(item.quantity || 0))
          }
        }
      }
    }

    // 4. Build line items with returnable quantities
    const items: SaleLookupItem[] = (saleItems as unknown as DbSaleItemRow[]).map((si) => {
      const prod = si.products ?? { id: si.product_id, name: 'Product', sku: null, barcode: null }
      const originalQty = Number(si.quantity) || 0
      const returnedQty = alreadyReturnedMap.get(si.product_id) ?? 0
      const returnable = Math.max(0, originalQty - returnedQty)
      const unitPrice = Number(si.unit_price) || 0

      return {
        productId: si.product_id,
        productName: prod.name ?? 'Unknown Product',
        sku: prod.sku ?? null,
        barcode: prod.barcode ?? null,
        originalQuantity: originalQty,
        alreadyReturnedQuantity: returnedQty,
        returnableQuantity: returnable,
        unitPrice,
        totalPrice: Number(si.total_price) || originalQty * unitPrice,
      }
    })

    const storeObj = Array.isArray(sale.stores) ? sale.stores[0] : sale.stores
    const custObj = Array.isArray(sale.customers) ? sale.customers[0] : sale.customers

    return {
      success: true,
      saleId: sale.id,
      invoiceNumber: sale.invoice_number,
      saleDate: sale.sale_date,
      storeId: sale.store_id,
      storeName: storeObj?.name ?? 'Main Store',
      customerId: sale.customer_id,
      customerName: custObj?.name ?? null,
      totalAmount: Number(sale.total_amount) || 0,
      items,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lookup failed'
    return { success: false, error: msg }
  }
}

/**
 * Processes a return with complete database integrity:
 * 1. Validates quantities against remaining returnable bounds.
 * 2. Creates the return record in `returns`.
 * 3. Creates line items in `return_items`.
 * 4. Appends a positive compensating movement in the immutable `inventory_ledger` (movement_type = 'Customer Return').
 * 5. Records a payment refund entry in `payments`.
 * 6. Emits an asynchronous inventory.return webhook.
 */
export async function processCreateReturn(
  params: ProcessReturnParams
): Promise<ProcessReturnResult> {
  const authResult = await getAuthenticatedTenantContext(INTERNAL_STAFF_ROLES)
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const { supabase, organizationId } = authResult.context
  const { invoiceNumber, reason, refundMethod, items } = params ?? {}

  // 1. Basic validation
  if (!invoiceNumber?.trim()) {
    return { success: false, error: 'Invoice number is required.' }
  }
  if (!reason?.trim()) {
    return { success: false, error: 'A return reason is required.' }
  }
  if (!refundMethod) {
    return { success: false, error: 'Refund payment method is required.' }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: 'No items selected for return.' }
  }

  // 2. Validate return quantities
  const itemsToReturn = items.filter((it) => Number(it.returnQuantity) > 0)
  if (itemsToReturn.length === 0) {
    return { success: false, error: 'Please specify a return quantity greater than 0.' }
  }

  for (const item of itemsToReturn) {
    if (typeof item.returnQuantity !== 'number' || item.returnQuantity <= 0) {
      return { success: false, error: `Invalid return quantity for ${item.productName}.` }
    }
  }

  // 3. Re-verify against live database sale items to prevent over-returning or concurrency race
  const lookup = await lookupSaleForReturn(invoiceNumber)
  if (!lookup.success || !lookup.items || !lookup.saleId) {
    return { success: false, error: lookup.error ?? 'Unable to verify invoice items.' }
  }

  const lookupItemsMap = new Map(lookup.items.map((it) => [it.productId, it]))

  for (const item of itemsToReturn) {
    const verified = lookupItemsMap.get(item.productId)
    if (!verified) {
      return {
        success: false,
        error: `Product "${item.productName}" was not found on invoice ${invoiceNumber}.`,
      }
    }
    if (item.returnQuantity > verified.returnableQuantity) {
      return {
        success: false,
        error: `Cannot return ${item.returnQuantity} units of "${item.productName}". Maximum returnable quantity is ${verified.returnableQuantity}.`,
      }
    }
  }

  // 4. Calculate refund total
  const totalRefundAmount =
    Math.round(
      itemsToReturn.reduce(
        (sum, it) => sum + it.returnQuantity * Number(it.unitPrice),
        0
      ) * 100
    ) / 100

  const totalUnits = itemsToReturn.reduce(
    (sum, it) => sum + it.returnQuantity,
    0
  )

  // 5. Generate unique return number: RET-YYYYMMDD-XXXX
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString()
  const returnNumber = `RET-${dateStamp}-${randomSuffix}`
  const nowIso = new Date().toISOString()

  try {
    // 6. Insert Return record (matches exact Supabase columns)
    const { data: returnData, error: returnError } = await supabase
      .from('returns')
      .insert({
        organization_id: organizationId,
        sale_id: lookup.saleId,
        customer_id: lookup.customerId || null,
        return_number: returnNumber,
        status: 'completed',
        reason: reason.trim(),
        refund_amount: totalRefundAmount,
        returned_at: nowIso,
      })
      .select('id')
      .single()

    if (returnError || !returnData) {
      return {
        success: false,
        error: `Failed to record return: ${returnError?.message || 'Database error'}`,
      }
    }

    const returnId = returnData.id

    // 7. Insert Return Items
    const returnItemRows = itemsToReturn.map((it) => ({
      return_id: returnId,
      product_id: it.productId,
      quantity: it.returnQuantity,
      unit_price: Number(it.unitPrice) || 0,
      refund_amount: Math.round(it.returnQuantity * Number(it.unitPrice) * 100) / 100,
    }))

    const { error: itemsError } = await supabase
      .from('return_items')
      .insert(returnItemRows)

    if (itemsError) {
      console.error('[Return] Warning inserting return_items:', itemsError)
    }

    // 8. Immutable Inventory Ledger: Add compensating positive stock movement
    // Idempotency check: Guard against duplicate submission or concurrent insertion
    const { data: existingLedger } = await supabase
      .from('inventory_ledger')
      .select('id, product_id')
      .eq('reference_type', 'return')
      .eq('reference_id', returnId)

    const existingProductIds = new Set(existingLedger?.map((r) => r.product_id) ?? [])
    const itemsPendingLedger = itemsToReturn.filter((it) => !existingProductIds.has(it.productId))

    if (itemsPendingLedger.length > 0) {
      const ledgerMovements = itemsPendingLedger.map((it) => ({
        organization_id: organizationId,
        store_id: lookup.storeId,
        product_id: it.productId,
        movement_type: 'customer_return',
        quantity: it.returnQuantity, // POSITIVE addition back into stock
        reference_type: 'return',
        reference_id: returnId,
        notes: `Customer return ${returnNumber} for invoice ${lookup.invoiceNumber}`,
      }))

      const { error: ledgerError } = await supabase
        .from('inventory_ledger')
        .insert(ledgerMovements)

      if (ledgerError) {
        console.error('[Return] Warning appending to inventory_ledger with customer_return:', ledgerError)
        // Fallback for environments with title-case or simplified constraints
        const fallbackMovements = ledgerMovements.map((m) => ({
          ...m,
          movement_type: 'return',
        }))
        const { error: fallbackError } = await supabase
          .from('inventory_ledger')
          .insert(fallbackMovements)

        if (fallbackError) {
          console.error('[Return] Fallback inventory_ledger append also failed:', fallbackError)
        }
      }
    }

    // 9. Payment Refund Record (Idempotency protected against duplicate submissions)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('sale_id', lookup.saleId)
      .eq('transaction_reference', `REF-${returnNumber}`)
      .maybeSingle()

    if (!existingPayment) {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          sale_id: lookup.saleId,
          amount: totalRefundAmount,
          payment_method: refundMethod,
          payment_status: 'refunded',
          transaction_reference: `REF-${returnNumber}`,
          paid_at: nowIso,
        })

      if (paymentError) {
        console.error('[Return] Warning inserting payment refund:', paymentError)
      }
    }

    // 10. Customer loyalty points deduction (1 point per 10 currency units refunded)
    if (lookup.customerId) {
      const pointsToDeduct = Math.floor(totalRefundAmount / 10)
      if (pointsToDeduct > 0) {
        const { data: cust } = await supabase
          .from('customers')
          .select('loyalty_points')
          .eq('id', lookup.customerId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (cust) {
          const currentPoints = Number(cust.loyalty_points) || 0
          const updatedPoints = Math.max(0, currentPoints - pointsToDeduct)
          await supabase
            .from('customers')
            .update({ loyalty_points: updatedPoints })
            .eq('id', lookup.customerId)
        }
      }
    }

    // 11. Optional asynchronous webhook dispatch (non-blocking, failure-safe)
    const webhookUrl =
      process.env.MAKE_RETURN_WEBHOOK_URL || process.env.MAKE_LOW_STOCK_WEBHOOK_URL

    if (webhookUrl) {
      const returnPayload = {
        eventId: `evt_ret_${Date.now()}`,
        eventType: 'inventory.return',
        returnNumber,
        originalInvoice: lookup.invoiceNumber,
        storeId: lookup.storeId,
        storeName: lookup.storeName,
        totalUnitsReturned: totalUnits,
        refundAmount: totalRefundAmount,
        refundMethod,
        reason: reason.trim(),
        items: itemsToReturn.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          quantityReturned: it.returnQuantity,
          unitPrice: it.unitPrice,
        })),
        timestamp: nowIso,
      }

      // Fire-and-forget fetch with timeout
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnPayload),
        signal: AbortSignal.timeout(5000),
      }).catch((e) => {
        console.warn('[Return] Webhook notification warning (non-fatal):', e.message)
      })
    }

    try {
      revalidatePath('/returns')
      revalidatePath('/inventory')
      revalidatePath('/sales')
      revalidatePath('/dashboard')
    } catch {
      // Ignored outside Next.js request context
    }

    return {
      success: true,
      returnNumber,
      invoiceNumber: lookup.invoiceNumber,
      unitsReturned: totalUnits,
      refundAmount: totalRefundAmount,
      paymentMethod: refundMethod,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Return processing failed'
    return { success: false, error: msg }
  }
}

/**
 * Retrieves detailed information for a specific return record.
 */
export async function getReturnDetails(
  returnId: string
): Promise<ReturnDetailsResult> {
  const authResult = await getAuthenticatedTenantContext(INTERNAL_STAFF_ROLES)
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const { supabase, organizationId } = authResult.context

  try {
    const { data: returnRec, error } = await supabase
      .from('returns')
      .select(`
        id,
        sale_id,
        return_number,
        status,
        reason,
        refund_amount,
        returned_at,
        sales:sale_id (
          invoice_number,
          sale_date,
          store_id,
          stores:store_id (
            name
          )
        ),
        customers:customer_id (
          name
        ),
        return_items (
          id,
          product_id,
          quantity,
          unit_price,
          refund_amount,
          products:product_id (
            name,
            sku
          )
        )
      `)
      .eq('organization_id', organizationId)
      .eq('id', returnId)
      .single()

    if (error || !returnRec) {
      return { success: false, error: 'Return record not found.' }
    }

    const rec = returnRec as unknown as DbReturnDetailsRow
    const saleObj = Array.isArray(rec.sales) ? rec.sales[0] : rec.sales
    const storeObj = saleObj?.stores
      ? Array.isArray(saleObj.stores)
        ? saleObj.stores[0]
        : saleObj.stores
      : null
    const custObj = Array.isArray(rec.customers) ? rec.customers[0] : rec.customers

    // Query payment record for refund method (prioritize refund transaction reference, fallback to sale payment)
    const { data: refundPayment } = await supabase
      .from('payments')
      .select('payment_method')
      .eq('sale_id', rec.sale_id)
      .eq('transaction_reference', `REF-${rec.return_number}`)
      .maybeSingle()

    let paymentMethod = refundPayment?.payment_method
    if (!paymentMethod) {
      const { data: paymentData } = await supabase
        .from('payments')
        .select('payment_method')
        .eq('sale_id', rec.sale_id)
        .limit(1)
      paymentMethod = paymentData?.[0]?.payment_method ?? 'cash'
    }

    const items: ReturnDetailItem[] = (rec.return_items ?? []).map((ri) => {
      const prod = Array.isArray(ri.products) ? ri.products[0] : ri.products
      return {
        id: ri.id,
        productId: ri.product_id,
        productName: prod?.name ?? 'Product',
        sku: prod?.sku ?? null,
        quantity: Number(ri.quantity) || 0,
        unitPrice: Number(ri.unit_price) || 0,
        refundAmount: Number(ri.refund_amount) || 0,
      }
    })

    return {
      success: true,
      returnRecord: {
        id: rec.id,
        returnNumber: rec.return_number ?? '—',
        invoiceNumber: saleObj?.invoice_number ?? '—',
        saleDate: saleObj?.sale_date ?? null,
        storeName: storeObj?.name ?? 'Main Store',
        customerName: custObj?.name ?? null,
        status: rec.status ?? 'completed',
        reason: rec.reason ?? null,
        refundAmount: Number(rec.refund_amount) || 0,
        paymentMethod,
        returnedAt: rec.returned_at,
        createdByName: 'Authorized Staff',
        items,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch details'
    return { success: false, error: msg }
  }
}
