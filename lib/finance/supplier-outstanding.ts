import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/inventory/stock'

export type OutstandingOrderLine = {
  purchaseOrderId: string
  poNumber: string | null
  receiptNumber: string | null
  supplierId: string
  supplierName: string
  storeId: string
  storeName: string
  orderDate: string | null
  receivedDate: string | null
  expectedDate: string | null
  dueDate: string | null
  paymentTerms: string | null
  paymentStatus: 'unpaid' | 'overdue'
  outstandingAmount: number
  isOverdue: boolean
  daysOverdue: number
}

export type SupplierOutstandingSummary = {
  supplierId: string
  supplierName: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  paymentTerms: string | null
  ordersCount: number
  totalOutstandingAmount: number
  totalOverdueAmount: number
  isOverdue: boolean
  maxDaysOverdue: number
  oldestDueDate: string | null
  orders: OutstandingOrderLine[]
}

export type SupplierOutstandingParams = {
  supabase: SupabaseClient
  organizationId: string
  storeId?: string | null
  minDue?: number
  overdueOnly?: boolean
}

export type SupplierOutstandingResult = {
  success: boolean
  organizationId: string
  storeFilter: string
  minDueFilter: number
  overdueOnlyFilter: boolean
  totalSuppliersCount: number
  totalOutstandingAmount: number
  totalOverdueAmount: number
  suppliers: SupplierOutstandingSummary[]
  orders: OutstandingOrderLine[]
  error?: string
}

/**
 * Parses payment terms strings into number of net days allowed.
 * Examples: 'Net 30' -> 30, 'Net 60' -> 60, 'Due on receipt' -> 0, '15 days' -> 15.
 * Defaults to 30 days if unspecified or unrecognizable.
 */
export function parsePaymentTermsDays(terms: string | null | undefined): number {
  if (!terms) return 30
  const lower = terms.toLowerCase().trim()

  if (
    lower.includes('immediate') ||
    lower.includes('receipt') ||
    lower.includes('advance') ||
    lower.includes('cod')
  ) {
    return 0
  }

  const match = lower.match(/(?:net\s*)?(\d+)\s*(?:days?)?/)
  if (match && match[1]) {
    const days = Number.parseInt(match[1], 10)
    return Number.isFinite(days) && days >= 0 ? days : 30
  }

  return 30
}

/**
 * Retrieves supplier outstanding amounts, due dates, and overdue status
 * from existing purchase orders, purchase order items, goods receipts, and supplier terms.
 */
export async function getSupplierOutstandingBalances({
  supabase,
  organizationId,
  storeId,
  minDue = 0,
  overdueOnly = false,
}: SupplierOutstandingParams): Promise<SupplierOutstandingResult> {
  const effectiveMinDue = Math.max(0, toNumber(minDue))

  // 1. Fetch active purchase orders (ordered or received status represent supplier obligations)
  let poQuery = supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      status,
      order_date,
      expected_date,
      store_id,
      supplier_id,
      suppliers (
        id,
        name,
        contact_person,
        phone,
        email,
        payment_terms
      ),
      stores (
        id,
        name,
        code
      )
    `)
    .eq('organization_id', organizationId)
    .in('status', ['ordered', 'received', 'pending'])
    .order('order_date', { ascending: true })

  if (storeId) {
    poQuery = poQuery.eq('store_id', storeId)
  }

  const { data: purchaseOrders, error: poError } = await poQuery

  if (poError) {
    return {
      success: false,
      organizationId,
      storeFilter: storeId ?? 'all_stores',
      minDueFilter: effectiveMinDue,
      overdueOnlyFilter: overdueOnly,
      totalSuppliersCount: 0,
      totalOutstandingAmount: 0,
      totalOverdueAmount: 0,
      suppliers: [],
      orders: [],
      error: `Failed to retrieve purchase orders: ${poError.message}`,
    }
  }

  const ordersList = purchaseOrders ?? []
  if (ordersList.length === 0) {
    return {
      success: true,
      organizationId,
      storeFilter: storeId ?? 'all_stores',
      minDueFilter: effectiveMinDue,
      overdueOnlyFilter: overdueOnly,
      totalSuppliersCount: 0,
      totalOutstandingAmount: 0,
      totalOverdueAmount: 0,
      suppliers: [],
      orders: [],
    }
  }

  const poIds = ordersList.map((po) => po.id)

  // 2. Fetch purchase order items to calculate monetary order amounts
  const [itemsResult, receiptsResult] = await Promise.all([
    supabase
      .from('purchase_order_items')
      .select('purchase_order_id, quantity, unit_cost')
      .in('purchase_order_id', poIds),
    supabase
      .from('goods_receipts')
      .select('id, purchase_order_id, receipt_number, received_date, status')
      .eq('organization_id', organizationId)
      .in('purchase_order_id', poIds),
  ])

  if (itemsResult.error) {
    return {
      success: false,
      organizationId,
      storeFilter: storeId ?? 'all_stores',
      minDueFilter: effectiveMinDue,
      overdueOnlyFilter: overdueOnly,
      totalSuppliersCount: 0,
      totalOutstandingAmount: 0,
      totalOverdueAmount: 0,
      suppliers: [],
      orders: [],
      error: `Failed to retrieve purchase order items: ${itemsResult.error.message}`,
    }
  }

  // Map order amounts by purchase_order_id: sum(quantity * unit_cost)
  const amountByPoId = new Map<string, number>()
  for (const item of itemsResult.data ?? []) {
    if (!item.purchase_order_id) continue
    const lineTotal = toNumber(item.quantity) * toNumber(item.unit_cost)
    amountByPoId.set(
      item.purchase_order_id,
      (amountByPoId.get(item.purchase_order_id) ?? 0) + lineTotal
    )
  }

  // Map latest completed goods receipt by purchase_order_id
  const receiptByPoId = new Map<
    string,
    { receiptNumber: string; receivedDate: string }
  >()
  for (const receipt of receiptsResult.data ?? []) {
    if (!receipt.purchase_order_id) continue
    const existing = receiptByPoId.get(receipt.purchase_order_id)
    if (
      !existing ||
      (receipt.received_date &&
        new Date(receipt.received_date) > new Date(existing.receivedDate))
    ) {
      receiptByPoId.set(receipt.purchase_order_id, {
        receiptNumber: receipt.receipt_number,
        receivedDate: receipt.received_date,
      })
    }
  }

  const now = new Date()
  const orderLines: OutstandingOrderLine[] = []

  // 3. Process each purchase order into an outstanding obligation
  for (const po of ordersList) {
    const rawTotal = amountByPoId.get(po.id) ?? 0
    const outstandingAmount = Math.round(rawTotal * 100) / 100

    if (outstandingAmount <= 0) continue

    const supplierRecord = Array.isArray(po.suppliers)
      ? po.suppliers[0]
      : po.suppliers
    const storeRecord = Array.isArray(po.stores) ? po.stores[0] : po.stores

    const supplierId = supplierRecord?.id ?? po.supplier_id ?? 'unknown_supplier'
    const supplierName = supplierRecord?.name ?? 'Unknown Supplier'
    const paymentTerms = supplierRecord?.payment_terms ?? null

    const storeIdVal = storeRecord?.id ?? po.store_id ?? 'unknown_store'
    const storeNameVal = storeRecord?.name ?? 'Store'

    const receiptInfo = receiptByPoId.get(po.id)
    const receiptNumber = receiptInfo?.receiptNumber ?? null
    const receivedDate = receiptInfo?.receivedDate ?? null

    // Compute due date based on payment terms
    // Priority base date: receivedDate (actual delivery) > orderDate > expectedDate
    const termDays = parsePaymentTermsDays(paymentTerms)
    const baseDateStr = receivedDate || po.order_date || po.expected_date
    let dueDate: string | null = null
    let isOverdue = false
    let daysOverdue = 0

    if (baseDateStr) {
      const baseDate = new Date(baseDateStr)
      if (!Number.isNaN(baseDate.getTime())) {
        const calculatedDueDate = new Date(
          baseDate.getTime() + termDays * 24 * 60 * 60 * 1000
        )
        dueDate = calculatedDueDate.toISOString()

        const diffMs = now.getTime() - calculatedDueDate.getTime()
        if (diffMs > 0) {
          isOverdue = true
          daysOverdue = Math.floor(diffMs / (24 * 60 * 60 * 1000))
        }
      }
    }

    if (overdueOnly && !isOverdue) {
      continue
    }

    orderLines.push({
      purchaseOrderId: po.id,
      poNumber: po.po_number ?? null,
      receiptNumber,
      supplierId,
      supplierName,
      storeId: storeIdVal,
      storeName: storeNameVal,
      orderDate: po.order_date ?? null,
      receivedDate,
      expectedDate: po.expected_date ?? null,
      dueDate,
      paymentTerms,
      paymentStatus: isOverdue ? 'overdue' : 'unpaid',
      outstandingAmount,
      isOverdue,
      daysOverdue,
    })
  }

  // 4. Group by supplier
  const supplierMap = new Map<string, SupplierOutstandingSummary>()

  for (const order of orderLines) {
    let summary = supplierMap.get(order.supplierId)

    if (!summary) {
      const originalPo = ordersList.find((p) => p.supplier_id === order.supplierId)
      const supplierRecord = Array.isArray(originalPo?.suppliers)
        ? originalPo?.suppliers[0]
        : originalPo?.suppliers

      summary = {
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        contactPerson: supplierRecord?.contact_person ?? null,
        phone: supplierRecord?.phone ?? null,
        email: supplierRecord?.email ?? null,
        paymentTerms: order.paymentTerms,
        ordersCount: 0,
        totalOutstandingAmount: 0,
        totalOverdueAmount: 0,
        isOverdue: false,
        maxDaysOverdue: 0,
        oldestDueDate: null,
        orders: [],
      }
      supplierMap.set(order.supplierId, summary)
    }

    summary.ordersCount += 1
    summary.totalOutstandingAmount =
      Math.round((summary.totalOutstandingAmount + order.outstandingAmount) * 100) / 100

    if (order.isOverdue) {
      summary.isOverdue = true
      summary.totalOverdueAmount =
        Math.round((summary.totalOverdueAmount + order.outstandingAmount) * 100) / 100
      summary.maxDaysOverdue = Math.max(summary.maxDaysOverdue, order.daysOverdue)
    }

    if (order.dueDate) {
      if (
        !summary.oldestDueDate ||
        new Date(order.dueDate) < new Date(summary.oldestDueDate)
      ) {
        summary.oldestDueDate = order.dueDate
      }
    }

    summary.orders.push(order)
  }

  // Apply min_due filter
  let filteredSuppliers = Array.from(supplierMap.values())
  if (effectiveMinDue > 0) {
    filteredSuppliers = filteredSuppliers.filter(
      (s) => s.totalOutstandingAmount >= effectiveMinDue
    )
  }

  // Sort by highest outstanding amount descending
  filteredSuppliers.sort(
    (a, b) => b.totalOutstandingAmount - a.totalOutstandingAmount
  )

  const finalOrders = filteredSuppliers.flatMap((s) => s.orders)

  const totalOutstandingAmount =
    Math.round(
      filteredSuppliers.reduce(
        (sum, s) => sum + s.totalOutstandingAmount,
        0
      ) * 100
    ) / 100

  const totalOverdueAmount =
    Math.round(
      filteredSuppliers.reduce((sum, s) => sum + s.totalOverdueAmount, 0) * 100
    ) / 100

  return {
    success: true,
    organizationId,
    storeFilter: storeId ?? 'all_stores',
    minDueFilter: effectiveMinDue,
    overdueOnlyFilter: overdueOnly,
    totalSuppliersCount: filteredSuppliers.length,
    totalOutstandingAmount,
    totalOverdueAmount,
    suppliers: filteredSuppliers,
    orders: finalOrders,
  }
}
