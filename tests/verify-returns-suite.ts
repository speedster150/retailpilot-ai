import {
  setAuthContextOverrideForTesting,
  type TenantContextResult,
} from '@/lib/auth/context'
import {
  lookupSaleForReturn,
  processCreateReturn,
  getReturnDetails,
} from '@/app/(dashbaord)/returns/actions'
import {
  calculateInventoryStock,
  movementDelta,
  type LedgerMovementLike,
} from '@/lib/inventory/stock'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type TestResult = {
  id: string
  name: string
  status: 'PASS' | 'FAIL'
  evidence: string
}

const testResults: TestResult[] = []

function recordTest(
  id: string,
  name: string,
  status: 'PASS' | 'FAIL',
  evidence: string
) {
  testResults.push({ id, name, status, evidence })
  console.log(`[${status}] ${id}: ${name}`)
  console.log(`       Evidence: ${evidence}\n`)
}

// -----------------------------------------------------------------------------
// Deterministic Test Database Setup
// -----------------------------------------------------------------------------
function createTestDatabase() {
  const organizationId = 'org-retail-pilot'
  const storeId = 'store-mumbai-01'
  const customerId = 'cust-rahul-01'
  const amulMilkId = 'prod-amul-milk-1l'

  const stores = [
    {
      id: storeId,
      organization_id: organizationId,
      name: 'Mumbai Central Superstore',
      code: 'BOM-01',
      is_active: true,
    },
  ]

  const customers = [
    {
      id: customerId,
      organization_id: organizationId,
      name: 'Rahul Sharma',
      email: 'rahul.sharma@example.com',
      phone: '+91 98765 43210',
      loyalty_points: 250,
    },
  ]

  const products = [
    {
      id: amulMilkId,
      organization_id: organizationId,
      name: 'Amul Taaza Milk 1L',
      sku: 'AML-TZ-01',
      barcode: '8901262010053',
      category_id: 'cat-dairy',
      cost_price: 54.0,
      selling_price: 66.0,
      reorder_level: 50,
      is_active: true,
    },
  ]

  // Initial setup:
  // Previous stock: 152
  // Quantity sold: 133 via INV-20260912-8492
  // Current stock after sale: 152 - 133 = 19
  const inventoryLedger: any[] = [
    // 1. Initial Purchase movement: +152
    {
      id: 'leg-init-amul-152',
      organization_id: organizationId,
      store_id: storeId,
      product_id: amulMilkId,
      movement_type: 'purchase',
      quantity: 152,
      reference_type: 'purchase_order',
      reference_id: 'PO-2026-0801',
      created_at: '2026-09-01T08:00:00Z',
    },
    // 2. Sale movement: -133 (deduction)
    {
      id: 'leg-sale-amul-133',
      organization_id: organizationId,
      store_id: storeId,
      product_id: amulMilkId,
      movement_type: 'sale',
      quantity: -133,
      reference_type: 'sale',
      reference_id: 'sale-8492',
      created_at: '2026-09-12T10:30:00Z',
    },
  ]

  const sales: any[] = [
    {
      id: 'sale-8492',
      organization_id: organizationId,
      store_id: storeId,
      customer_id: customerId,
      invoice_number: 'INV-20260912-8492',
      status: 'completed',
      subtotal: 133 * 66.0, // 8778.00
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 133 * 66.0, // 8778.00
      sale_date: '2026-09-12T10:30:00Z',
    },
  ]

  const saleItems: any[] = [
    {
      id: 'si-8492-1',
      sale_id: 'sale-8492',
      product_id: amulMilkId,
      quantity: 133,
      unit_price: 66.0,
      total_price: 8778.0,
    },
  ]

  // Existing previous return: RET-0001 (must remain intact)
  const returns: any[] = [
    {
      id: 'ret-0001',
      organization_id: organizationId,
      sale_id: 'sale-prev-001',
      store_id: storeId,
      customer_id: customerId,
      return_number: 'RET-0001',
      status: 'completed',
      reason: 'Wrong item purchased',
      refund_amount: 66.0,
      payment_method: 'cash',
      returned_at: '2026-09-10T11:00:00Z',
      created_by: 'usr-manager-01',
    },
  ]

  const returnItems: any[] = [
    {
      id: 'ri-0001-1',
      return_id: 'ret-0001',
      product_id: amulMilkId,
      quantity: 1,
      unit_price: 66.0,
      refund_amount: 66.0,
    },
  ]

  const payments: any[] = [
    {
      id: 'pay-8492',
      sale_id: 'sale-8492',
      amount: 8778.0,
      payment_method: 'upi',
      payment_status: 'completed',
      transaction_reference: 'UPI-8492-998877',
      paid_at: '2026-09-12T10:30:00Z',
    },
  ]

  const tables: Record<string, any[]> = {
    stores,
    customers,
    products,
    inventory_ledger: inventoryLedger,
    sales,
    sale_items: saleItems,
    returns,
    return_items: returnItems,
    payments,
  }

  function createScopedClient(): SupabaseClient {
    return {
      from: (table: string) => {
        const dataset = tables[table] || []

        const queryObj: any = {
          _filters: [] as ((item: any) => boolean)[],
          _lastInserted: null as any,
          _selectedColumns: '*',
          select(columns: string = '*') {
            this._selectedColumns = columns
            return this
          },
          eq(column: string, value: any) {
            this._filters.push((item: any) => item[column] === value)
            return this
          },
          in(column: string, values: any[]) {
            this._filters.push((item: any) => values.includes(item[column]))
            return this
          },
          order(column: string, options?: any) {
            return this
          },
          limit(n: number) {
            return this
          },
          maybeSingle() {
            let result = this._lastInserted ? [...this._lastInserted] : [...dataset]
            for (const fn of this._filters) {
              result = result.filter(fn)
            }
            return Promise.resolve({
              data: result[0] ? this._hydrateRow(table, result[0]) : null,
              error: null,
            })
          },
          single() {
            let result = this._lastInserted ? [...this._lastInserted] : [...dataset]
            for (const fn of this._filters) {
              result = result.filter(fn)
            }
            if (result.length === 0) {
              return Promise.resolve({
                data: null,
                error: { message: 'Row not found', code: 'PGRST116' },
              })
            }
            return Promise.resolve({
              data: this._hydrateRow(table, result[0]),
              error: null,
            })
          },
          insert(recordOrRecords: any) {
            const items = Array.isArray(recordOrRecords)
              ? recordOrRecords
              : [recordOrRecords]
            const createdItems = []
            for (const item of items) {
              const created = {
                id: item.id || `gen-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                created_at: item.created_at || new Date().toISOString(),
                ...item,
              }
              dataset.push(created)
              createdItems.push(created)
            }
            this._lastInserted = createdItems
            return this
          },
          _pendingUpdates: null as any,
          update(updates: any) {
            this._pendingUpdates = updates
            return this
          },
          _hydrateRow(t: string, row: any) {
            const copy = { ...row }
            if (t === 'sales') {
              copy.stores = stores.find((s) => s.id === row.store_id)
              copy.customers = customers.find((c) => c.id === row.customer_id)
            }
            if (t === 'sale_items') {
              copy.products = products.find((p) => p.id === row.product_id)
            }
            if (t === 'returns') {
              const matchingSale = sales.find((s) => s.id === row.sale_id)
              copy.sales = matchingSale
                ? {
                    ...matchingSale,
                    stores: stores.find((s) => s.id === matchingSale.store_id),
                  }
                : null
              copy.customers = customers.find((c) => c.id === row.customer_id)
              copy.return_items = returnItems
                .filter((ri) => ri.return_id === row.id)
                .map((ri) => ({
                  ...ri,
                  products: products.find((p) => p.id === ri.product_id),
                }))
            }
            if (t === 'return_items') {
              copy.products = products.find((p) => p.id === row.product_id)
            }
            return copy
          },
          then(resolve: any, reject: any) {
            let result = this._lastInserted ? [...this._lastInserted] : [...dataset]
            for (const fn of this._filters) {
              result = result.filter(fn)
            }
            if (this._pendingUpdates) {
              for (const r of result) {
                Object.assign(r, this._pendingUpdates)
              }
            }
            const hydrated = result.map((r: any) => this._hydrateRow(table, r))
            return Promise.resolve({ data: hydrated, error: null }).then(resolve, reject)
          },
        }

        return queryObj
      },
    } as unknown as SupabaseClient
  }

  return {
    organizationId,
    storeId,
    customerId,
    amulMilkId,
    tables,
    createScopedClient,
  }
}

// -----------------------------------------------------------------------------
// Returns Test Suite Execution
// -----------------------------------------------------------------------------
async function runReturnsTestSuite() {
  console.log('==================================================================')
  console.log('RETAILPILOT AI — RETURNS / REVERSE SALE TEST SUITE')
  console.log('==================================================================\n')

  const db = createTestDatabase()
  const mockClient = db.createScopedClient()

  // Setup Auth Override
  const mockUser: User = {
    id: 'usr-store-manager-01',
    app_metadata: {},
    user_metadata: { full_name: 'Store Manager Vikram' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  }

  setAuthContextOverrideForTesting(async (): Promise<TenantContextResult> => {
    return {
      success: true,
      context: {
        supabase: mockClient,
        user: mockUser,
        organizationId: db.organizationId,
        role: 'store_manager',
      },
    }
  })

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Baseline Stock Verification Before Return
    // -------------------------------------------------------------------------
    const initialStockRes = await calculateInventoryStock({
      supabase: mockClient,
      organizationId: db.organizationId,
      storeId: db.storeId,
    })

    const amulStockBefore = initialStockRes.items?.find(
      (i) => i.productId === db.amulMilkId
    )

    if (!amulStockBefore || amulStockBefore.currentStock !== 19) {
      throw new Error(
        `Expected initial stock 19, got ${amulStockBefore?.currentStock}`
      )
    }

    recordTest(
      'TC-RET-01',
      'Baseline Inventory & Sale Verification (INV-20260912-8492)',
      'PASS',
      `Initial stock for "Amul Taaza Milk 1L" is 19 units (Previous: 152, Sold: 133 via INV-20260912-8492). Original sale ledger row intact (-133).`
    )

    // -------------------------------------------------------------------------
    // TEST 2: Invoice Lookup & Returnable Quantity Calculation
    // -------------------------------------------------------------------------
    const lookup = await lookupSaleForReturn('INV-20260912-8492')
    if (!lookup.success || !lookup.items || lookup.items.length !== 1) {
      throw new Error(`Invoice lookup failed: ${lookup.error}`)
    }

    const milkItem = lookup.items[0]
    if (
      milkItem.originalQuantity !== 133 ||
      milkItem.alreadyReturnedQuantity !== 0 ||
      milkItem.returnableQuantity !== 133
    ) {
      throw new Error(
        `Invalid returnable quantities: original=${milkItem.originalQuantity}, returned=${milkItem.alreadyReturnedQuantity}, returnable=${milkItem.returnableQuantity}`
      )
    }

    recordTest(
      'TC-RET-02',
      'Invoice Lookup & Returnable Bounds',
      'PASS',
      `Found invoice INV-20260912-8492 at "${lookup.storeName}". Product "${milkItem.productName}" (SKU: ${milkItem.sku}): Sold=133, Already Returned=0, Returnable=133.`
    )

    // -------------------------------------------------------------------------
    // TEST 3: Validation & Over-Return Rejection
    // -------------------------------------------------------------------------
    const overReturnAttempt = await processCreateReturn({
      invoiceNumber: 'INV-20260912-8492',
      reason: 'Customer complaint',
      refundMethod: 'upi',
      items: [
        {
          productId: db.amulMilkId,
          productName: 'Amul Taaza Milk 1L',
          sku: 'AML-TZ-01',
          returnQuantity: 134, // 134 > 133 (exceeds returnable)
          unitPrice: 66.0,
        },
      ],
    })

    if (overReturnAttempt.success) {
      throw new Error('Validation failure: system allowed returning 134 units when only 133 were returnable')
    }

    // Zero return quantity rejection
    const zeroReturnAttempt = await processCreateReturn({
      invoiceNumber: 'INV-20260912-8492',
      reason: 'Customer complaint',
      refundMethod: 'cash',
      items: [
        {
          productId: db.amulMilkId,
          productName: 'Amul Taaza Milk 1L',
          returnQuantity: 0,
          unitPrice: 66.0,
        },
      ],
    })

    if (zeroReturnAttempt.success) {
      throw new Error('Validation failure: system allowed return of 0 units')
    }

    recordTest(
      'TC-RET-03',
      'Strict Return Validation (Over-Return & Zero Qty Protection)',
      'PASS',
      `Correctly rejected return of 134 units: "${overReturnAttempt.error}". Correctly rejected return of 0 units: "${zeroReturnAttempt.error}".`
    )

    // -------------------------------------------------------------------------
    // TEST 4: Process Return of 133 Units (Current Test Case)
    // -------------------------------------------------------------------------
    const processResult = await processCreateReturn({
      invoiceNumber: 'INV-20260912-8492',
      reason: 'Customer requested reverse sale due to store transit issue',
      refundMethod: 'upi',
      items: [
        {
          productId: db.amulMilkId,
          productName: 'Amul Taaza Milk 1L',
          sku: 'AML-TZ-01',
          returnQuantity: 133,
          unitPrice: 66.0,
        },
      ],
    })

    if (!processResult.success || !processResult.returnNumber) {
      throw new Error(`Process return failed: ${processResult.error}`)
    }

    const expectedRefund = 133 * 66.0 // 8778.00
    if (processResult.refundAmount !== expectedRefund) {
      throw new Error(`Refund amount mismatch: expected ${expectedRefund}, got ${processResult.refundAmount}`)
    }

    recordTest(
      'TC-RET-04',
      'Return Processing & Transaction Integrity',
      'PASS',
      `Successfully processed return "${processResult.returnNumber}" for invoice "${processResult.invoiceNumber}". Units returned: 133. Total refund issued: ₹${processResult.refundAmount?.toFixed(2)} via ${processResult.paymentMethod}.`
    )

    // -------------------------------------------------------------------------
    // TEST 5: Inventory Restoration & Ledger Immutability (19 + 133 = 152)
    // -------------------------------------------------------------------------
    // 1. Verify original sale ledger row was NOT deleted or modified
    const originalSaleMovement = db.tables.inventory_ledger.find(
      (l) => l.reference_id === 'sale-8492' && l.movement_type === 'sale'
    )
    if (!originalSaleMovement || originalSaleMovement.quantity !== -133) {
      throw new Error('CRITICAL: Original sale movement in inventory ledger was modified or deleted!')
    }

    // 2. Verify NEW compensating Customer Return movement was appended
    const returnMovement = db.tables.inventory_ledger.find(
      (l) =>
        (l.movement_type === 'customer_return' || l.movement_type === 'Customer Return') &&
        l.product_id === db.amulMilkId &&
        l.quantity === 133
    )
    if (!returnMovement) {
      throw new Error('CRITICAL: Compensating Customer Return movement for +133 units was not appended to ledger!')
    }

    // 3. Verify stock calculation: 19 + 133 = 152
    const updatedStockRes = await calculateInventoryStock({
      supabase: mockClient,
      organizationId: db.organizationId,
      storeId: db.storeId,
    })

    const amulStockAfter = updatedStockRes.items?.find(
      (i) => i.productId === db.amulMilkId
    )

    if (!amulStockAfter || amulStockAfter.currentStock !== 152) {
      throw new Error(`Expected updated stock 152 (19 + 133), but got ${amulStockAfter?.currentStock}`)
    }

    recordTest(
      'TC-RET-05',
      'Inventory Stock Restoration (19 + 133 = 152) & Immutable Ledger',
      'PASS',
      `Original sale movement intact (quantity: -133). New movement appended (movement_type: "Customer Return", quantity: +133). Final current stock = 152 units.`
    )

    // -------------------------------------------------------------------------
    // TEST 6: Subsequent Lookup Prevents Duplicate Return on Same Invoice
    // -------------------------------------------------------------------------
    const repeatLookup = await lookupSaleForReturn('INV-20260912-8492')
    if (!repeatLookup.success || !repeatLookup.items) {
      throw new Error(`Repeat lookup failed: ${repeatLookup.error}`)
    }

    const repeatMilkItem = repeatLookup.items[0]
    if (
      repeatMilkItem.alreadyReturnedQuantity !== 133 ||
      repeatMilkItem.returnableQuantity !== 0
    ) {
      throw new Error(
        `Repeat lookup expected returnableQuantity = 0, got ${repeatMilkItem.returnableQuantity}`
      )
    }

    // Attempting another return must fail
    const repeatReturnAttempt = await processCreateReturn({
      invoiceNumber: 'INV-20260912-8492',
      reason: 'Second attempt',
      refundMethod: 'cash',
      items: [
        {
          productId: db.amulMilkId,
          productName: 'Amul Taaza Milk 1L',
          returnQuantity: 1,
          unitPrice: 66.0,
        },
      ],
    })

    if (repeatReturnAttempt.success) {
      throw new Error('System allowed duplicate return after all 133 units were already returned!')
    }

    recordTest(
      'TC-RET-06',
      'Exhausted Returnable Quantity & Duplicate Prevention',
      'PASS',
      `Invoice INV-20260912-8492 updated returnable quantity to 0. Secondary return attempt blocked with message: "${repeatReturnAttempt.error}".`
    )

    // -------------------------------------------------------------------------
    // TEST 7: Return History & Existing Return RET-0001 Integrity
    // -------------------------------------------------------------------------
    const ret0001 = db.tables.returns.find((r) => r.return_number === 'RET-0001')
    if (!ret0001) {
      throw new Error('Existing return RET-0001 was lost or corrupted!')
    }

    const newReturnRecord = db.tables.returns.find(
      (r) => r.return_number === processResult.returnNumber
    )
    if (!newReturnRecord || newReturnRecord.refund_amount !== 8778.0) {
      throw new Error('New return record missing or refund amount invalid!')
    }

    const details = await getReturnDetails(newReturnRecord.id)
    if (!details.success || !details.returnRecord || details.returnRecord.items.length !== 1) {
      throw new Error(`Failed to retrieve return details: ${details.error}`)
    }

    recordTest(
      'TC-RET-07',
      'Returns History & Detail Breakdown (RET-0001 Preserved)',
      'PASS',
      `Previous return RET-0001 intact. New return ${processResult.returnNumber} present in table. Details modal retrieved: Invoice="${details.returnRecord.invoiceNumber}", Store="${details.returnRecord.storeName}", Refund=₹${details.returnRecord.refundAmount}.`
    )

    // -------------------------------------------------------------------------
    // TEST 8: Movement Delta Engine Compatibility
    // -------------------------------------------------------------------------
    const deltaCustomerReturn = movementDelta({
      movement_type: 'Customer Return',
      quantity: 133,
    })
    const deltaReturnLower = movementDelta({
      movement_type: 'return',
      quantity: 1,
    })
    const deltaSale = movementDelta({
      movement_type: 'sale',
      quantity: -133,
    })

    if (deltaCustomerReturn !== 133 || deltaReturnLower !== 1 || deltaSale !== -133) {
      throw new Error(
        `movementDelta failed: Customer Return=${deltaCustomerReturn}, return=${deltaReturnLower}, sale=${deltaSale}`
      )
    }

    recordTest(
      'TC-RET-08',
      'Stock Engine movementDelta() Math Invariant',
      'PASS',
      `movementDelta() correctly recognized "Customer Return" as positive inbound (+133), "return" as (+1), and "sale" as outbound (-133).`
    )
  } finally {
    setAuthContextOverrideForTesting(null)
  }

  console.log('==================================================================')
  const passCount = testResults.filter((t) => t.status === 'PASS').length
  const failCount = testResults.filter((t) => t.status === 'FAIL').length
  console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${testResults.length} Returns Tests`)
  console.log('==================================================================\n')

  if (failCount > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runReturnsTestSuite().catch((err) => {
  console.error('\n❌ UNEXPECTED ERROR IN RETURNS SUITE:', err)
  process.exit(1)
})
