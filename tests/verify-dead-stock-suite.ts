import { executeDeadStockBiweeklyAudit, type DeadStockAuditResult } from '@/lib/automation/dead-stock-audit'
import { getDeadStockProducts } from '@/lib/inventory/dead-stock'
import type { SupabaseClient } from '@supabase/supabase-js'

console.log('==================================================================')
console.log('RETAILPILOT AI — STEP 11.2 DEAD STOCK BI-WEEKLY AUDIT TEST SUITE')
console.log('==================================================================\n')

type MockDbOptions = {
  stores?: any[]
  products?: any[]
  ledger?: any[]
  sales?: any[]
  saleItems?: any[]
  deadStockAudits?: any[]
}

function createMockEnvironment(tenantId: string, options: MockDbOptions = {}) {
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
  const seventyDaysAgo = new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000).toISOString()

  const stores = options.stores ?? [
    { id: 'store-1', organization_id: tenantId, name: 'Downtown Store', code: 'DT-01', is_active: true },
  ]

  const products = options.products ?? [
    // p1: Never sold, created 90 days ago, stock = 10, cost = $60 -> Value = $600 -> Critical dead stock
    { id: 'p1-never-sold-old', organization_id: tenantId, name: 'Vintage Oak Chair', sku: 'CHR-01', cost_price: 60, reorder_level: 5, is_active: true, created_at: ninetyDaysAgo },
    // p2: Never sold, created 10 days ago (NEW product) -> Stock = 5 -> MUST NOT be flagged as dead stock
    { id: 'p2-new-product', organization_id: tenantId, name: 'Fresh Arrival Lamp', sku: 'LMP-02', cost_price: 30, reorder_level: 2, is_active: true, created_at: tenDaysAgo },
    // p3: Sold 70 days ago, stock = 8, cost = $35 -> Value = $280 -> High dead stock
    { id: 'p3-dormant-sale', organization_id: tenantId, name: 'Brass Desk Clock', sku: 'CLK-03', cost_price: 35, reorder_level: 2, is_active: true, created_at: ninetyDaysAgo },
    // p4: Sold 10 days ago (Active velocity) -> Stock = 15 -> MUST NOT be flagged as dead stock
    { id: 'p4-active-velocity', organization_id: tenantId, name: 'Organic Coffee Beans', sku: 'COF-04', cost_price: 12, reorder_level: 10, is_active: true, created_at: ninetyDaysAgo },
    // p5: Zero stock (out of stock), never sold -> MUST NOT be flagged (no tied-up working capital)
    { id: 'p5-zero-stock', organization_id: tenantId, name: 'Out of Stock Teapot', sku: 'TEA-05', cost_price: 25, reorder_level: 5, is_active: true, created_at: ninetyDaysAgo },
  ]

  const ledger = options.ledger ?? [
    { id: 'l1', organization_id: tenantId, product_id: 'p1-never-sold-old', store_id: 'store-1', movement_type: 'opening', quantity: 10, created_at: ninetyDaysAgo },
    { id: 'l2', organization_id: tenantId, product_id: 'p2-new-product', store_id: 'store-1', movement_type: 'purchase', quantity: 5, created_at: tenDaysAgo },
    { id: 'l3', organization_id: tenantId, product_id: 'p3-dormant-sale', store_id: 'store-1', movement_type: 'purchase', quantity: 10, created_at: ninetyDaysAgo },
    { id: 'l3-sale', organization_id: tenantId, product_id: 'p3-dormant-sale', store_id: 'store-1', movement_type: 'sale', quantity: 2, created_at: seventyDaysAgo },
    { id: 'l4', organization_id: tenantId, product_id: 'p4-active-velocity', store_id: 'store-1', movement_type: 'purchase', quantity: 20, created_at: ninetyDaysAgo },
    { id: 'l4-sale', organization_id: tenantId, product_id: 'p4-active-velocity', store_id: 'store-1', movement_type: 'sale', quantity: 5, created_at: tenDaysAgo },
  ]

  const sales = options.sales ?? [
    { id: 's3', organization_id: tenantId, store_id: 'store-1', sale_date: seventyDaysAgo, status: 'completed' },
    { id: 's4', organization_id: tenantId, store_id: 'store-1', sale_date: tenDaysAgo, status: 'completed' },
  ]

  const saleItems = options.saleItems ?? [
    { id: 'si3', sale_id: 's3', product_id: 'p3-dormant-sale', quantity: 2 },
    { id: 'si4', sale_id: 's4', product_id: 'p4-active-velocity', quantity: 5 },
  ]

  const auditLogs: any[] = options.deadStockAudits ?? []

  const mockSupabase = {
    from: (table: string) => {
      let data: any[] = []
      if (table === 'stores') data = stores
      else if (table === 'products') data = products
      else if (table === 'inventory_ledger') data = ledger
      else if (table === 'sales') data = sales
      else if (table === 'sale_items') data = saleItems
      else if (table === 'dead_stock_audits') data = auditLogs

      const builder: any = {
        _data: [...data],
        select: (cols: string) => builder,
        eq: (field: string, val: any) => {
          builder._data = builder._data.filter((d: any) => d[field] === val)
          return builder
        },
        in: (field: string, vals: any[]) => {
          builder._data = builder._data.filter((d: any) => vals.includes(d[field]))
          return builder
        },
        order: () => builder,
        limit: (n: number) => {
          builder._data = builder._data.slice(0, n)
          return builder
        },
        insert: async (records: any[]) => {
          for (const r of records) {
            auditLogs.push({
              id: `audit-${Date.now()}-${Math.random()}`,
              created_at: new Date().toISOString(),
              ...r,
            })
          }
          return { data: records, error: null }
        },
        then: (resolve: any) => {
          resolve({ data: builder._data, error: null })
        },
      }
      return builder
    },
  } as unknown as SupabaseClient

  return {
    supabase: mockSupabase,
    stores,
    products,
    ledger,
    auditLogs,
  }
}

async function runTests() {
  const tenantId = 'org-test-dead-stock-01'

  // --- TEST 1: Dead Stock Detection Logic ---
  console.log('--- TEST 1: Dead Stock Engine Qualification & Filtering ---')
  const env1 = createMockEnvironment(tenantId)
  const deadStockResult = await getDeadStockProducts({
    supabase: env1.supabase,
    organizationId: tenantId,
    minDays: 60,
  })

  if (!deadStockResult.success) {
    throw new Error(`TEST 1 Failed: ${deadStockResult.error}`)
  }

  // Expect exactly 2 items: p1-never-sold-old and p3-dormant-sale
  if (deadStockResult.totalDeadStockItems !== 2) {
    throw new Error(`TEST 1 Failed: Expected 2 dead stock items, got ${deadStockResult.totalDeadStockItems}`)
  }

  const p1 = deadStockResult.items.find(i => i.productId === 'p1-never-sold-old')
  const p3 = deadStockResult.items.find(i => i.productId === 'p3-dormant-sale')
  const p2 = deadStockResult.items.find(i => i.productId === 'p2-new-product')
  const p4 = deadStockResult.items.find(i => i.productId === 'p4-active-velocity')

  if (!p1 || p1.deadStockStatus !== 'never_sold' || p1.inventoryValue !== 600) {
    throw new Error('TEST 1 Failed: p1 (old never-sold item) not correctly calculated')
  }
  if (!p3 || p3.deadStockStatus !== 'dead_stock' || p3.inventoryValue !== 280) {
    throw new Error('TEST 1 Failed: p3 (dormant 70-day sale) not correctly calculated')
  }
  if (p2) {
    throw new Error('TEST 1 Failed: p2 (new product < 60 days) falsely flagged as dead stock')
  }
  if (p4) {
    throw new Error('TEST 1 Failed: p4 (active product sold 10 days ago) falsely flagged as dead stock')
  }

  console.log(`[PASS] Qualified items: ${deadStockResult.totalDeadStockItems}, Total Tied-up Capital: $${deadStockResult.totalDeadStockValue}`)
  console.log('✅ TEST 1 PASSED: Dead stock qualification, age threshold, and velocity filtering verified.\n')

  // --- TEST 2: Executive Liquidation Plan & Disclaimer ---
  console.log('--- TEST 2: Liquidation Strategy & Mandatory AI Disclaimer ---')
  let interceptedPayload: any = null
  const mockWebhookUrl = 'https://hook.eu1.make.com/mock_dead_stock_test_123456'

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: any, options: any) => {
    if (typeof url === 'string' && url.includes('make.com')) {
      interceptedPayload = JSON.parse(options.body)
      return {
        ok: true,
        status: 200,
        text: async () => 'Accepted',
      } as Response
    }
    return originalFetch(url, options)
  }) as typeof fetch

  try {
    const auditRes: DeadStockAuditResult = await executeDeadStockBiweeklyAudit({
      supabase: env1.supabase,
      organizationId: tenantId,
      webhookUrl: mockWebhookUrl,
    })

    if (!auditRes.success) {
      throw new Error(`TEST 2 Failed: Audit execution returned unsuccessful: ${auditRes.error}`)
    }

    if (!auditRes.dispatchedToWebhook) {
      throw new Error('TEST 2 Failed: dispatchedToWebhook should be true when webhook succeeds')
    }

    if (auditRes.liquidationPlan.length === 0) {
      throw new Error('TEST 2 Failed: Liquidation plan must contain executive recommendations')
    }

    // Verify all recommendations contain the required tag
    for (const rec of auditRes.liquidationPlan) {
      if (!rec.startsWith('AI-generated recommendation:')) {
        throw new Error(`TEST 2 Failed: Recommendation missing AI disclaimer: "${rec}"`)
      }
    }

    if (!auditRes.disclaimer.includes('AI-generated recommendation:')) {
      throw new Error('TEST 2 Failed: Global disclaimer missing AI tag')
    }

    // Verify Webhook Payload
    if (!interceptedPayload) {
      throw new Error('TEST 2 Failed: Webhook payload was not intercepted')
    }

    if (interceptedPayload.eventType !== 'inventory.dead_stock_biweekly_audit') {
      throw new Error(`TEST 2 Failed: Unexpected eventType "${interceptedPayload.eventType}"`)
    }

    if (interceptedPayload.totalDeadStockItems !== 2 || interceptedPayload.totalTiedUpCapital !== 880) {
      throw new Error(`TEST 2 Failed: Webhook payload totals mismatch (${interceptedPayload.totalDeadStockItems}, $${interceptedPayload.totalTiedUpCapital})`)
    }

    // Verify Supabase Audit Record
    if (env1.auditLogs.length !== 1) {
      throw new Error(`TEST 2 Failed: Expected 1 audit log record, got ${env1.auditLogs.length}`)
    }

    const log = env1.auditLogs[0]
    if (log.status !== 'dispatched' || log.total_dead_stock_items !== 2 || log.total_tied_up_capital !== 880) {
      throw new Error(`TEST 2 Failed: Audit log properties mismatch: status=${log.status}, items=${log.total_dead_stock_items}`)
    }

    if (!log.webhook_url_masked.includes('...') || !log.webhook_url_masked.endsWith('3456')) {
      throw new Error(`TEST 2 Failed: Webhook URL not safely masked: ${log.webhook_url_masked}`)
    }

    console.log(`[PASS] Webhook dispatched to ${log.webhook_url_masked} with ${interceptedPayload.items.length} item recommendations`)
    console.log('✅ TEST 2 PASSED: Executive liquidation plan, AI disclaimer, and audit logging verified.\n')
  } finally {
    globalThis.fetch = originalFetch
  }

  // --- TEST 3: Graceful Webhook Timeout / Failure Safety ---
  console.log('--- TEST 3: Failure-Safe Dispatch (Ledger Immutability) ---')
  const env3 = createMockEnvironment(tenantId)

  // Simulate network failure
  globalThis.fetch = (async () => {
    throw new Error('ECONNREFUSED: Make.com connection timeout')
  }) as typeof fetch

  try {
    const failedRes = await executeDeadStockBiweeklyAudit({
      supabase: env3.supabase,
      organizationId: tenantId,
      webhookUrl: 'https://hook.eu1.make.com/fail_test',
    })

    // Must not crash the audit result
    if (!failedRes.success) {
      throw new Error('TEST 3 Failed: executeDeadStockBiweeklyAudit should succeed gracefully even when webhook fails')
    }

    if (failedRes.dispatchedToWebhook !== false) {
      throw new Error('TEST 3 Failed: dispatchedToWebhook should be false on failure')
    }

    const log3 = env3.auditLogs[0]
    if (log3.status !== 'failed') {
      throw new Error(`TEST 3 Failed: Expected audit status 'failed', got '${log3.status}'`)
    }

    console.log(`[PASS] Failure handled gracefully: audit recorded with status '${log3.status}' and error '${log3.error_message}'`)
    console.log('✅ TEST 3 PASSED: Webhook failures handled safely without exceptions.\n')
  } finally {
    globalThis.fetch = originalFetch
  }

  console.log('==================================================================')
  console.log('ALL STEP 11.2 DEAD STOCK BI-WEEKLY AUDIT TESTS PASSED!')
  console.log('==================================================================')
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err)
  process.exit(1)
})
