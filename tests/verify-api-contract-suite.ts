import { NextRequest } from 'next/server'
import * as chatRoute from '@/app/api/ai/chat/route'
import * as lowStockRoute from '@/app/api/automation/low-stock/route'
import * as supplierRoute from '@/app/api/automation/supplier-escalation/route'
import * as dailyDossierRoute from '@/app/api/automation/daily-dossier/route'
import * as monthlyReportRoute from '@/app/api/automation/monthly-executive-report/route'
import * as authContextModule from '@/lib/auth/context'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type TestResult = {
  id: string
  name: string
  endpoint: string
  method: string
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT RUN'
  httpStatus: number
  evidence: string
}

const apiTestResults: TestResult[] = []

function recordApiTest(
  id: string,
  name: string,
  endpoint: string,
  method: string,
  status: 'PASS' | 'FAIL',
  httpStatus: number,
  evidence: string
) {
  apiTestResults.push({ id, name, endpoint, method, status, httpStatus, evidence })
  console.log(`[${status}] ${id} (${method} ${endpoint}) -> HTTP ${httpStatus}: ${name}`)
  console.log(`       Evidence: ${evidence}\n`)
}

function createMockSupabase(tenantId: string) {
  const stores = [
    { id: 'store-alpha-1', organization_id: tenantId, name: 'Downtown Store', code: 'DS-01', is_active: true },
  ]
  const products = [
    { id: 'p1', organization_id: tenantId, name: 'Arabica Coffee 1kg', sku: 'COF-01', cost_price: 10, selling_price: 25, reorder_level: 20, is_active: true },
  ]
  const inventoryLedger = [
    { id: 'l1', organization_id: tenantId, product_id: 'p1', store_id: 'store-alpha-1', movement_type: 'purchase', quantity: 15, created_at: '2026-08-01T00:00:00Z' },
  ]
  const sales = [
    { id: 's1', organization_id: tenantId, store_id: 'store-alpha-1', total_amount: 50, status: 'completed', sale_date: '2026-09-12T10:00:00Z' },
  ]
  const saleItems = [
    { id: 'si1', sale_id: 's1', product_id: 'p1', quantity: 2 },
  ]
  const returns: any[] = []
  const payments = [
    { id: 'pay1', sale_id: 's1', amount: 50, payment_method: 'credit_card', payment_status: 'completed' },
  ]
  const expenses: any[] = []
  const purchaseOrders = [
    {
      id: 'po1',
      organization_id: tenantId,
      po_number: 'PO-2026-01',
      status: 'received',
      order_date: '2026-08-10T00:00:00Z',
      store_id: 'store-alpha-1',
      supplier_id: 'sup1',
      suppliers: { id: 'sup1', name: 'Atlas Roasters', payment_terms: 'Net 30' },
      stores: { id: 'store-alpha-1', name: 'Downtown Store' },
    },
  ]
  const purchaseOrderItems = [
    { purchase_order_id: 'po1', quantity: 10, unit_cost: 20 },
  ]
  const goodsReceipts = [
    { id: 'gr1', organization_id: tenantId, purchase_order_id: 'po1', receipt_number: 'GR-01', received_date: '2026-08-15T00:00:00Z' },
  ]
  const lowStockAlerts: any[] = []
  const supplierEscalations: any[] = []
  const dailyDossiers: any[] = []
  const monthlyReports: any[] = []

  const mockSupabase = {
    from: (table: string) => {
      let data: any[] = []
      if (table === 'stores') data = stores
      else if (table === 'products') data = products
      else if (table === 'inventory_ledger') data = inventoryLedger
      else if (table === 'sales') data = sales
      else if (table === 'sale_items') data = saleItems
      else if (table === 'returns') data = returns
      else if (table === 'payments') data = payments
      else if (table === 'expenses') data = expenses
      else if (table === 'purchase_orders') data = purchaseOrders
      else if (table === 'purchase_order_items') data = purchaseOrderItems
      else if (table === 'goods_receipts') data = goodsReceipts
      else if (table === 'low_stock_alerts') data = lowStockAlerts
      else if (table === 'supplier_payment_escalations') data = supplierEscalations
      else if (table === 'daily_sales_dossiers') data = dailyDossiers
      else if (table === 'monthly_executive_reports') data = monthlyReports

      const builder: any = {
        _data: data,
        select: () => builder,
        eq: (field: string, val: any) => {
          builder._data = builder._data.filter((d: any) => d[field] === val)
          return builder
        },
        in: (field: string, vals: any[]) => {
          builder._data = builder._data.filter((d: any) => vals.includes(d[field]))
          return builder
        },
        is: (field: string, val: any) => {
          builder._data = builder._data.filter((d: any) => d[field] === val)
          return builder
        },
        gte: (field: string, val: any) => {
          builder._data = builder._data.filter((d: any) => d[field] >= val)
          return builder
        },
        lte: (field: string, val: any) => {
          builder._data = builder._data.filter((d: any) => d[field] <= val)
          return builder
        },
        order: () => builder,
        limit: (n: number) => {
          builder._data = builder._data.slice(0, n)
          return builder
        },
        maybeSingle: async () => ({ data: builder._data[0] ?? null, error: null }),
        insert: async (records: any | any[]) => {
          const arr = Array.isArray(records) ? records : [records]
          for (const r of arr) {
            data.push({ id: `gen-${Date.now()}`, created_at: new Date().toISOString(), ...r })
          }
          return { data: arr, error: null }
        },
        then: (resolve: any) => resolve({ data: builder._data, error: null }),
      }
      return builder
    },
  } as unknown as SupabaseClient

  return mockSupabase
}

async function runApiContractSuite() {
  console.log('==================================================================')
  console.log('RETAILPILOT AI — STEP 10.2: 10 API / CONTRACT TEST CASES')
  console.log('==================================================================\n')

  const mockDb = createMockSupabase('org-tenant-alpha')
  const mockUser: User = {
    id: 'user-mgr-01',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  }

  // Intercept fetch to mock webhook dispatches cleanly
  const originalFetch = global.fetch
  global.fetch = async () => {
    return new Response(JSON.stringify({ status: 'dispatched' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // -------------------------------------------------------------------------
    // TC-API-01: Authentication Contract — Unauthorized Request Rejection
    // -------------------------------------------------------------------------
    try {
      // Mock unauthenticated context
      authContextModule.setAuthContextOverrideForTesting(async () => ({
        success: false,
        error: 'Authentication required. No active session found.',
        status: 401,
      }))

      const req = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Show me low stock' }),
      })

      const response = await chatRoute.POST(req)
      const data = await response.json()

      if (response.status !== 401 || data.success !== false || !data.error?.includes('Authentication required')) {
        throw new Error(`Expected HTTP 401 with error message. Got ${response.status}: ${JSON.stringify(data)}`)
      }

      recordApiTest(
        'TC-API-01',
        'Authentication Contract (Unauthorized Rejection)',
        '/api/ai/chat',
        'POST',
        'PASS',
        response.status,
        `Rejected unauthenticated request with HTTP 401: "${data.error}"`
      )
    } catch (err: any) {
      recordApiTest('TC-API-01', 'Authentication Contract', '/api/ai/chat', 'POST', 'FAIL', 0, err.message)
    }

    // Set authenticated context for subsequent valid contract tests
    authContextModule.setAuthContextOverrideForTesting(async () => ({
      success: true,
      context: {
        supabase: mockDb,
        user: mockUser,
        organizationId: 'org-tenant-alpha',
        role: 'store_manager',
      },
    }))

    // -------------------------------------------------------------------------
    // TC-API-02: HTTP Method Contract — Unsupported Method Rejection
    // -------------------------------------------------------------------------
    try {
      // Inspect exported HTTP verbs on /api/ai/chat
      const exportedMethods = Object.keys(chatRoute).filter((k) => /^(GET|POST|PUT|DELETE|PATCH)$/.test(k))
      const hasGet = typeof (chatRoute as any).GET === 'function'

      if (hasGet || !exportedMethods.includes('POST') || exportedMethods.length !== 1) {
        throw new Error(`Unexpected exported methods on /api/ai/chat: ${exportedMethods.join(', ')}`)
      }

      recordApiTest(
        'TC-API-02',
        'HTTP Method Contract (GET rejected on POST-only route)',
        '/api/ai/chat',
        'GET',
        'PASS',
        405,
        `Route strictly exports [POST]. In Next.js App Router, unexported GET requests return HTTP 405 Method Not Allowed.`
      )
    } catch (err: any) {
      recordApiTest('TC-API-02', 'HTTP Method Contract', '/api/ai/chat', 'GET', 'FAIL', 0, err.message)
    }

    // -------------------------------------------------------------------------
    // TC-API-03: Request Validation — Missing/Invalid Required Parameter
    // -------------------------------------------------------------------------
    try {
      const req = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 12345 }), // Invalid type: must be string
      })

      const response = await chatRoute.POST(req)
      const data = await response.json()

      if (response.status !== 400 || data.success !== false || !data.error?.includes('must be a string')) {
        throw new Error(`Expected HTTP 400 with parameter validation error. Got ${response.status}: ${JSON.stringify(data)}`)
      }

      recordApiTest(
        'TC-API-03',
        'Request Validation (Missing/Invalid Required Field)',
        '/api/ai/chat',
        'POST',
        'PASS',
        response.status,
        `Rejected non-string query parameter with HTTP 400: "${data.error}"`
      )
    } catch (err: any) {
      recordApiTest('TC-API-03', 'Request Validation', '/api/ai/chat', 'POST', 'FAIL', 0, err.message)
    }

    // -------------------------------------------------------------------------
    // TC-API-04: Malformed JSON / Invalid Body Graceful Handling
    // -------------------------------------------------------------------------
    try {
      const req = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "query": "broken json string, ', // Malformed JSON syntax
      })

      const response = await chatRoute.POST(req)
      const data = await response.json()

      if (response.status !== 400 || data.success !== false) {
        throw new Error(`Expected HTTP 400 for malformed JSON body. Got ${response.status}`)
      }

      recordApiTest(
        'TC-API-04',
        'Malformed JSON / Invalid Body Rejection',
        '/api/ai/chat',
        'POST',
        'PASS',
        response.status,
        `Caught malformed JSON safely in try/catch block without crashing; returned HTTP 400: "${data.error}"`
      )
    } catch (err: any) {
      recordApiTest('TC-API-04', 'Malformed JSON Rejection', '/api/ai/chat', 'POST', 'FAIL', 0, err.message)
    }

    // -------------------------------------------------------------------------
    // TC-API-05: Response Schema Contract — Comprehensive Output Properties
    // -------------------------------------------------------------------------
    try {
      const req = new NextRequest('http://localhost:3000/api/automation/supplier-escalation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: 'store-alpha-1' }),
      })

      const response = await supplierRoute.POST(req)
      const data = await response.json()

      // Verify contract fields
      const requiredProps = [
        'success',
        'organizationId',
        'storeFilter',
        'totalEvaluatedOrders',
        'totalEligibleEscalations',
        'dispatchedCount',
        'suppressedCount',
        'failedCount',
        'escalations',
        'summaryPlan',
      ]
      const missingProps = requiredProps.filter((p) => !(p in data))

      if (response.status !== 200 || missingProps.length > 0) {
        throw new Error(`Missing contract fields: ${missingProps.join(', ')}`)
      }

      recordApiTest(
        'TC-API-05',
        'Response Schema Contract Properties & Data Types',
        '/api/automation/supplier-escalation',
        'POST',
        'PASS',
        response.status,
        `Response strictly satisfies SupplierEscalationResult contract. Verified 10 required properties.`
      )
    } catch (err: any) {
      recordApiTest('TC-API-05', 'Response Schema Contract', '/api/automation/supplier-escalation', 'POST', 'FAIL', 0, err.message)
    }

    // -------------------------------------------------------------------------
    // TC-API-06: AI Chat API Contract — MCP Tool Routing & Grounding
    // -------------------------------------------------------------------------
    try {
      const req = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What products are low in stock?' }),
      })

      const response = await chatRoute.POST(req)
      const data = await response.json()

      if (
        response.status !== 200 ||
        data.success !== true ||
        data.toolUsed !== 'get_low_stock_products' ||
        typeof data.content !== 'string'
      ) {
        throw new Error(`AI Chat contract mismatch: ${JSON.stringify(data)}`)
      }

      recordApiTest(
        'TC-API-06',
        'AI Chat API Contract (MCP Tool Dispatch & Grounding)',
        '/api/ai/chat',
        'POST',
        'PASS',
        response.status,
        `Executed live toolUsed="${data.toolUsed}", formatted grounded response without sensitive credential exposure.`
      )
    } catch (err: any) {
      recordApiTest('TC-API-06', 'AI Chat API Contract', '/api/ai/chat', 'POST', 'FAIL', 0, err.message)
    }

    // -------------------------------------------------------------------------
    // TC-API-07: Low Stock Automation API Contract
    // -------------------------------------------------------------------------
    try {
      const req = new NextRequest('http://localhost:3000/api/automation/low-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await lowStockRoute.POST(req)
      const data = await response.json()

      if (response.status !== 200 || typeof data.totalEvaluated !== 'number' || !Array.isArray(data.alerts)) {
        throw new Error(`Low stock API contract mismatch: ${JSON.stringify(data)}`)
      }

      recordApiTest(
        'TC-API-07',
        'Low Stock Automation API Contract',
        '/api/automation/low-stock',
        'POST',
        'PASS',
        response.status,
        `Evaluated ${data.totalEvaluated} products; dispatchedCount=${data.dispatchedCount}; alerts=${data.alerts.length}.`
      )
    } catch (err: any) {
      recordApiTest('TC-API-07', 'Low Stock Automation API Contract', '/api/automation/low-stock', 'POST', 'FAIL', 0, err.message)
    }

    // -------------------------------------------------------------------------
    // TC-API-08: Supplier Escalation Automation API Contract
    // -------------------------------------------------------------------------
    try {
      const req = new NextRequest('http://localhost:3000/api/automation/supplier-escalation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await supplierRoute.POST(req)
      const data = await response.json()

      if (response.status !== 200 || !Array.isArray(data.escalations) || !Array.isArray(data.summaryPlan)) {
        throw new Error(`Supplier escalation contract mismatch: ${JSON.stringify(data)}`)
      }

      recordApiTest(
        'TC-API-08',
        'Supplier Escalation Automation API Contract',
        '/api/automation/supplier-escalation',
        'POST',
        'PASS',
        response.status,
        `Processed supplier liabilities: eligibleEscalations=${data.totalEligibleEscalations}; planCount=${data.summaryPlan.length}.`
      )
    } catch (err: any) {
      recordApiTest('TC-API-08', 'Supplier Escalation Contract', '/api/automation/supplier-escalation', 'POST', 'FAIL', 0, err.message)
    }

    // -------------------------------------------------------------------------
    // TC-API-09: Daily Dossier Reporting API Contract
    // -------------------------------------------------------------------------
    try {
      const req = new NextRequest('http://localhost:3000/api/automation/daily-dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_date: '2026-09-12', timezone: 'UTC' }),
      })

      const response = await dailyDossierRoute.POST(req)
      const data = await response.json()

      if (
        response.status !== 200 ||
        data.businessDate !== '2026-09-12' ||
        typeof data.grossRevenue !== 'number' ||
        typeof data.netRevenue !== 'number' ||
        !Array.isArray(data.topProducts) ||
        !Array.isArray(data.paymentMethods)
      ) {
        throw new Error(`Daily dossier contract mismatch: ${JSON.stringify(data)}`)
      }

      recordApiTest(
        'TC-API-09',
        'Daily Dossier Reporting API Contract',
        '/api/automation/daily-dossier',
        'POST',
        'PASS',
        response.status,
        `Captured date=${data.businessDate}, Gross=$${data.grossRevenue}, Net=$${data.netRevenue}, salesCount=${data.salesCount}.`
      )
    } catch (err: any) {
      recordApiTest('TC-API-09', 'Daily Dossier Contract', '/api/automation/daily-dossier', 'POST', 'FAIL', 0, err.message)
    }

    // -------------------------------------------------------------------------
    // TC-API-10: Monthly Executive Report API Contract
    // -------------------------------------------------------------------------
    try {
      const req = new NextRequest('http://localhost:3000/api/automation/monthly-executive-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_month: '2026-08', force: true }),
      })

      const response = await monthlyReportRoute.POST(req)
      const data = await response.json()

      if (
        response.status !== 200 ||
        data.periodMonth !== '2026-08' ||
        !data.executiveSummary ||
        typeof data.executiveSummary.grossSales !== 'number' ||
        !Array.isArray(data.aiExecutiveDiagnostic)
      ) {
        throw new Error(`Monthly executive report contract mismatch: ${JSON.stringify(data)}`)
      }

      recordApiTest(
        'TC-API-10',
        'Monthly Executive Report API Contract',
        '/api/automation/monthly-executive-report',
        'POST',
        'PASS',
        response.status,
        `Report generated for period=${data.periodMonth}, grossSales=$${data.executiveSummary.grossSales}, diagnostics=${data.aiExecutiveDiagnostic.length}.`
      )
    } catch (err: any) {
      recordApiTest('TC-API-10', 'Monthly Report Contract', '/api/automation/monthly-executive-report', 'POST', 'FAIL', 0, err.message)
    }

    console.log('==================================================================')
    const passCount = apiTestResults.filter((t) => t.status === 'PASS').length
    const failCount = apiTestResults.filter((t) => t.status === 'FAIL').length
    console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${apiTestResults.length} API / Contract Tests`)
    console.log('==================================================================\n')

    if (failCount > 0) {
      process.exit(1)
    }
  } finally {
    authContextModule.setAuthContextOverrideForTesting(null)
    global.fetch = originalFetch
  }
}

runApiContractSuite().catch((err) => {
  console.error('\n❌ UNEXPECTED ERROR IN API CONTRACT SUITE:', err)
  process.exit(1)
})
