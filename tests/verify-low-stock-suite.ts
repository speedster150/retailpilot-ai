import { detectAndDispatchLowStockAlerts, maskWebhookUrl } from '@/lib/automation/low-stock-alert'
import { INVENTORY_ROLES, type AuthenticatedTenantContext } from '@/lib/auth/context'
import type { SupabaseClient, User } from '@supabase/supabase-js'

// Mock state store for low_stock_alerts audit table
type AlertRecord = {
  id: string
  organization_id: string
  store_id: string
  product_id: string
  stock_level: number
  reorder_level: number
  deficit: number
  status: 'dispatched' | 'failed' | 'suppressed_duplicate'
  webhook_url_masked: string
  response_status?: number
  error_message?: string
  payload: any
  created_at: string
}

function createMockEnvironment(tenantId: string, options: {
  stores?: any[]
  products?: any[]
  ledger?: any[]
  alerts?: AlertRecord[]
} = {}) {
  const stores = options.stores ?? [
    { id: 'store-alpha-1', organization_id: tenantId, name: 'Downtown Store', code: 'DT-01', is_active: true },
    { id: 'store-alpha-2', organization_id: tenantId, name: 'Uptown Store', code: 'UT-02', is_active: true },
  ]

  const products = options.products ?? [
    // p1: In stock (stock 50 > reorder 20)
    { id: 'prod-normal', organization_id: tenantId, name: 'High Stock Oats', sku: 'OAT-01', barcode: '1001', reorder_level: 20, is_active: true },
    // p2: Exactly at reorder level (stock 15 == reorder 15)
    { id: 'prod-at-reorder', organization_id: tenantId, name: 'Threshold Granola', sku: 'GRA-02', barcode: '1002', reorder_level: 15, is_active: true },
    // p3: Below reorder level (stock 5 < reorder 25, deficit 20)
    { id: 'prod-below-reorder', organization_id: tenantId, name: 'Low Stock Milk', sku: 'MLK-03', barcode: '1003', reorder_level: 25, is_active: true },
  ]

  const ledger = options.ledger ?? [
    // prod-normal in store-alpha-1: 50 received -> stock = 50
    { id: 'l1', organization_id: tenantId, product_id: 'prod-normal', store_id: 'store-alpha-1', movement_type: 'purchase', quantity: 50 },
    // prod-at-reorder in store-alpha-1: 15 received -> stock = 15
    { id: 'l2', organization_id: tenantId, product_id: 'prod-at-reorder', store_id: 'store-alpha-1', movement_type: 'purchase', quantity: 15 },
    // prod-below-reorder in store-alpha-1: 10 received, 5 sold -> stock = 5
    { id: 'l3', organization_id: tenantId, product_id: 'prod-below-reorder', store_id: 'store-alpha-1', movement_type: 'purchase', quantity: 10 },
    { id: 'l4', organization_id: tenantId, product_id: 'prod-below-reorder', store_id: 'store-alpha-1', movement_type: 'sale', quantity: 5 },
  ]

  const alertsAudit: AlertRecord[] = options.alerts ?? []

  const mockSupabase = {
    from: (table: string) => {
      let data: any[] = []
      if (table === 'stores') data = stores
      else if (table === 'products') data = products
      else if (table === 'inventory_ledger') data = ledger
      else if (table === 'low_stock_alerts') data = alertsAudit

      const builder: any = {
        _data: data,
        select: () => builder,
        eq: (field: string, val: any) => {
          builder._data = builder._data.filter((d: any) => d[field] === val)
          return builder
        },
        order: () => builder,
        limit: (n: number) => {
          builder._data = builder._data.slice(0, n)
          return builder
        },
        insert: async (records: any[]) => {
          for (const r of records) {
            alertsAudit.push({
              id: `alert-${Date.now()}-${Math.random()}`,
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
    alertsAudit,
  }
}

async function runAutomationVerification() {
  console.log('==================================================================')
  console.log('RETAILPILOT AI — STEP 9.1 LOW STOCK AUTO-ALERT MAKE.COM TESTS')
  console.log('==================================================================\n')

  // Intercept global.fetch for webhook testing
  const interceptedCalls: Array<{ url: string; body: any }> = []
  let simulateWebhookStatus = 200
  let simulateNetworkFailure = false

  const originalFetch = global.fetch
  global.fetch = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url
    const body = init?.body ? JSON.parse(init.body) : null
    interceptedCalls.push({ url, body })

    if (simulateNetworkFailure) {
      throw new Error('ECONNREFUSED: Make.com webhook endpoint unreachable')
    }

    if (simulateWebhookStatus !== 200) {
      return new Response(JSON.stringify({ error: 'Internal server error on automation platform' }), {
        status: simulateWebhookStatus,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ status: 'success', executionId: 'make-exec-12345' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const mockWebhookUrl = 'https://hook.eu2.make.com/test-low-stock-secret-12345'
    const env = createMockEnvironment('org-alpha')

    // -------------------------------------------------------------
    // TEST 1: Stock conditions (Normal vs At Reorder vs Below Reorder)
    // -------------------------------------------------------------
    console.log('--- TEST 1: Stock condition detection (Normal vs At Reorder vs Below Reorder) ---')
    const result1 = await detectAndDispatchLowStockAlerts({
      supabase: env.supabase,
      organizationId: 'org-alpha',
      storeId: 'store-alpha-1',
      webhookUrl: mockWebhookUrl,
    })

    console.log('Total evaluated:', result1.totalEvaluated)
    console.log('Low stock detected:', result1.lowStockCount)
    console.log('Dispatched count:', result1.dispatchedCount)
    console.log('Alerts:', result1.alerts.map(a => `${a.productName} (${a.currentStock}/${a.reorderLevel}) -> ${a.status}`))

    // High Stock Oats (50 > 20) -> should NOT trigger alert
    const normalAlert = result1.alerts.find(a => a.productId === 'prod-normal')
    if (normalAlert) throw new Error('Test 1 failed: High Stock Oats should NOT trigger low-stock alert')

    // Threshold Granola (15 == 15) -> SHOULD trigger alert (at reorder level)
    const atReorderAlert = result1.alerts.find(a => a.productId === 'prod-at-reorder')
    if (!atReorderAlert || atReorderAlert.status !== 'dispatched') {
      throw new Error('Test 1 failed: Threshold Granola at reorder level was not dispatched')
    }

    // Low Stock Milk (5 < 25, deficit 20) -> SHOULD trigger alert (below reorder level)
    const belowReorderAlert = result1.alerts.find(a => a.productId === 'prod-below-reorder')
    if (!belowReorderAlert || belowReorderAlert.status !== 'dispatched' || belowReorderAlert.deficit !== 20) {
      throw new Error('Test 1 failed: Low Stock Milk below reorder level was not dispatched with deficit 20')
    }

    // Verify webhook payloads sent
    if (interceptedCalls.length !== 2) {
      throw new Error(`Test 1 failed: expected 2 webhook calls, got ${interceptedCalls.length}`)
    }
    const milkPayload = interceptedCalls.find(c => c.body.productId === 'prod-below-reorder')?.body
    console.log('Webhook payload sample for Low Stock Milk:')
    console.log(JSON.stringify(milkPayload, null, 2))

    if (milkPayload.eventType !== 'inventory.low_stock') throw new Error('Invalid eventType in payload')
    if (milkPayload.deficit !== 20) throw new Error('Invalid deficit in payload')
    if (milkPayload.currentStock !== 5) throw new Error('Invalid currentStock in payload')
    console.log('✅ TEST 1 PASSED: Stock condition rules verified accurately.\n')

    // -------------------------------------------------------------
    // TEST 2: Duplicate Alert Suppression
    // -------------------------------------------------------------
    console.log('--- TEST 2: Duplicate Alert Suppression for Unchanged Condition ---')
    interceptedCalls.length = 0 // reset calls tracker

    // Scan again immediately with exact same stock condition
    const result2 = await detectAndDispatchLowStockAlerts({
      supabase: env.supabase,
      organizationId: 'org-alpha',
      storeId: 'store-alpha-1',
      webhookUrl: mockWebhookUrl,
    })

    console.log('Dispatched count on repeat scan:', result2.dispatchedCount)
    console.log('Suppressed count on repeat scan:', result2.suppressedCount)
    console.log('Intercepted webhook calls on repeat scan:', interceptedCalls.length)

    if (result2.dispatchedCount !== 0) throw new Error('Test 2 failed: duplicate alert was not suppressed!')
    if (result2.suppressedCount !== 2) throw new Error('Test 2 failed: expected 2 suppressed alerts')
    if (interceptedCalls.length !== 0) throw new Error('Test 2 failed: webhook should NOT be called for duplicate conditions')
    console.log('✅ TEST 2 PASSED: Duplicate alert suppression successfully verified.\n')

    // -------------------------------------------------------------
    // TEST 3: Worsened Condition (Stock drops further -> Triggers new alert)
    // -------------------------------------------------------------
    console.log('--- TEST 3: Worsened condition triggers fresh alert ---')
    interceptedCalls.length = 0

    // Simulate additional sale of 3 units of milk (stock drops from 5 to 2, deficit increases to 23)
    env.ledger.push({
      id: 'l5',
      organization_id: 'org-alpha',
      product_id: 'prod-below-reorder',
      store_id: 'store-alpha-1',
      movement_type: 'sale',
      quantity: 3,
    })

    const result3 = await detectAndDispatchLowStockAlerts({
      supabase: env.supabase,
      organizationId: 'org-alpha',
      storeId: 'store-alpha-1',
      webhookUrl: mockWebhookUrl,
    })

    console.log('Dispatched count on stock drop:', result3.dispatchedCount)
    console.log('Suppressed count on stock drop:', result3.suppressedCount)
    const milkWorsened = result3.alerts.find(a => a.productId === 'prod-below-reorder')
    console.log('Milk alert on worsened condition:', milkWorsened?.status, 'Current stock:', milkWorsened?.currentStock, 'Deficit:', milkWorsened?.deficit)

    if (milkWorsened?.status !== 'dispatched' || milkWorsened?.currentStock !== 2 || milkWorsened?.deficit !== 23) {
      throw new Error('Test 3 failed: worsened stock condition did not trigger new alert!')
    }
    if (interceptedCalls.length !== 1) throw new Error('Test 3 failed: expected 1 webhook call for worsened condition')
    console.log('✅ TEST 3 PASSED: Worsened condition triggered fresh alert.\n')

    // -------------------------------------------------------------
    // TEST 4: Multiple Stores Isolation
    // -------------------------------------------------------------
    console.log('--- TEST 4: Multiple Stores Evaluation ---')
    interceptedCalls.length = 0

    // Evaluate across store-alpha-2 (which has 0 stock for all items -> out_of_stock)
    const resultStore2 = await detectAndDispatchLowStockAlerts({
      supabase: env.supabase,
      organizationId: 'org-alpha',
      storeId: 'store-alpha-2',
      webhookUrl: mockWebhookUrl,
    })

    console.log('Store-alpha-2 evaluated:', resultStore2.totalEvaluated)
    console.log('Store-alpha-2 dispatched:', resultStore2.dispatchedCount)
    if (resultStore2.dispatchedCount !== 3) {
      throw new Error(`Test 4 failed: expected 3 alerts for store-2 with zero stock, got ${resultStore2.dispatchedCount}`)
    }
    console.log('✅ TEST 4 PASSED: Store location filtering and multi-store handling verified.\n')

    // -------------------------------------------------------------
    // TEST 5: Tenant Isolation
    // -------------------------------------------------------------
    console.log('--- TEST 5: Tenant Isolation ---')
    interceptedCalls.length = 0
    const envBeta = createMockEnvironment('org-beta', {
      products: [
        { id: 'prod-beta-1', organization_id: 'org-beta', name: 'Beta Product', sku: 'BETA-01', reorder_level: 10, is_active: true },
      ],
      ledger: [
        { id: 'lb1', organization_id: 'org-beta', product_id: 'prod-beta-1', store_id: 'store-beta-1', movement_type: 'purchase', quantity: 2 },
      ],
      stores: [
        { id: 'store-beta-1', organization_id: 'org-beta', name: 'Beta Store', code: 'BS-01', is_active: true },
      ],
    })

    const resultBeta = await detectAndDispatchLowStockAlerts({
      supabase: envBeta.supabase,
      organizationId: 'org-beta',
      webhookUrl: mockWebhookUrl,
    })

    console.log('Tenant Beta low stock count:', resultBeta.lowStockCount)
    const betaAlert = resultBeta.alerts[0]
    if (betaAlert.productId !== 'prod-beta-1') throw new Error('Test 5 failed: wrong product for tenant beta')
    // Ensure Beta alert payload has organizationId = 'org-beta'
    const betaWebhookBody = interceptedCalls.find(c => c.body.productId === 'prod-beta-1')?.body
    if (betaWebhookBody.organizationId !== 'org-beta') throw new Error('Test 5 failed: tenant isolation breach in webhook payload')
    console.log('✅ TEST 5 PASSED: Strict tenant isolation maintained.\n')

    // -------------------------------------------------------------
    // TEST 6: Webhook Failure & Network Timeout Safety
    // -------------------------------------------------------------
    console.log('--- TEST 6: Webhook failure safety & ledger immutability ---')
    interceptedCalls.length = 0

    // Setup HTTP 500 error from Make.com
    simulateWebhookStatus = 500
    const ledgerBeforeCount = env.ledger.length
    const ledgerBeforeStock = env.ledger.reduce((acc, l) => acc + (l.quantity || 0), 0)

    const resultFailure = await detectAndDispatchLowStockAlerts({
      supabase: env.supabase,
      organizationId: 'org-alpha',
      storeId: 'store-alpha-1',
      webhookUrl: mockWebhookUrl,
      cooldownHours: 0, // force re-evaluation
    })

    console.log('Failure run result success:', resultFailure.success)
    console.log('Failed alerts count:', resultFailure.failedCount)
    console.log('Sample failed error message:', resultFailure.alerts[0]?.error)

    if (resultFailure.failedCount === 0) throw new Error('Test 6 failed: webhook failure was not captured')

    // Now simulate network failure (throw exception)
    simulateNetworkFailure = true
    const resultNetworkErr = await detectAndDispatchLowStockAlerts({
      supabase: env.supabase,
      organizationId: 'org-alpha',
      storeId: 'store-alpha-1',
      webhookUrl: mockWebhookUrl,
      cooldownHours: 0,
    })
    console.log('Network exception result success:', resultNetworkErr.success)
    console.log('Network exception failed count:', resultNetworkErr.failedCount)
    console.log('Network exception error recorded:', resultNetworkErr.alerts[0]?.error)

    // Check ledger immutability
    const ledgerAfterCount = env.ledger.length
    const ledgerAfterStock = env.ledger.reduce((acc, l) => acc + (l.quantity || 0), 0)
    console.log('Ledger row count before/after webhook failure:', ledgerBeforeCount, '->', ledgerAfterCount)
    console.log('Ledger sum before/after webhook failure:', ledgerBeforeStock, '->', ledgerAfterStock)

    if (ledgerBeforeCount !== ledgerAfterCount || ledgerBeforeStock !== ledgerAfterStock) {
      throw new Error('CRITICAL FAILURE: Webhook error corrupted or modified the inventory ledger!')
    }
    console.log('✅ TEST 6 PASSED: Webhook errors handled safely without affecting inventory ledger.\n')

    // -------------------------------------------------------------
    // TEST 7: RBAC Authorization & Customer Rejection
    // -------------------------------------------------------------
    console.log('--- TEST 7: RBAC & Customer Role Rejection ---')
    console.log('Customer authorized in INVENTORY_ROLES:', INVENTORY_ROLES.has('customer'))
    if (INVENTORY_ROLES.has('customer')) {
      throw new Error('Test 7 failed: customer role must NOT have access to inventory automation!')
    }
    console.log('✅ TEST 7 PASSED: Customer role strictly forbidden.\n')

    // -------------------------------------------------------------
    // TEST 8: URL Masking
    // -------------------------------------------------------------
    console.log('--- TEST 8: Webhook URL Masking for Audit Safety ---')
    const masked = maskWebhookUrl('https://hook.eu2.make.com/abcd1234efgh5678')
    console.log('Original: https://hook.eu2.make.com/abcd1234efgh5678')
    console.log('Masked:', masked)
    if (masked.includes('abcd1234efgh5678')) {
      throw new Error('Test 8 failed: webhook secret was not masked!')
    }
    console.log('✅ TEST 8 PASSED: Webhook URLs masked securely.\n')

    console.log('==================================================================')
    console.log('ALL STEP 9.1 LOW STOCK AUTO-ALERT AUTOMATION TESTS PASSED!')
    console.log('==================================================================')
  } finally {
    global.fetch = originalFetch
  }
}

runAutomationVerification().catch((err) => {
  console.error('VERIFICATION ERROR:', err)
  process.exit(1)
})
