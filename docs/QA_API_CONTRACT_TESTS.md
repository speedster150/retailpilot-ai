# RetailPilot AI — 10 API & Contract Test Cases Suite

**Document Version**: 1.0
**Status**: Executed & Verified
**Scope**: API Request / Response Schema & Contract Verification (Step 10.2)

---

### TC-API-01: Authentication Contract & Unauthorized Rejection
- **Test ID**: `TC-API-01`
- **Endpoint**: `/api/ai/chat`
- **HTTP Method**: `POST`
- **Preconditions**: No active session cookie provided (unauthenticated guest).
- **Request**:
  - Headers: `{ "Content-Type": "application/json" }`
  - Body: `{ "query": "Show me low stock products" }`
- **Expected Status**: `401 Unauthorized`
- **Expected Response Contract**:
  ```json
  {
    "success": false,
    "error": "Authentication required. No active session found."
  }
  ```
  Zero stack trace or internal database credentials exposed.
- **Actual Result**: Returned HTTP 401 with `{ success: false, error: "Authentication required. No active session found." }`.
- **Status**: **PASS**
- **Evidence / Notes**: Tested via `app/api/ai/chat/route.ts` with unauthenticated context.

---

### TC-API-02: HTTP Method Contract & Method Rejection
- **Test ID**: `TC-API-02`
- **Endpoint**: `/api/ai/chat`
- **HTTP Method**: `GET`
- **Preconditions**: Protected POST-only endpoint.
- **Request**:
  - Method: `GET`
  - URL: `/api/ai/chat`
- **Expected Status**: `405 Method Not Allowed` / Unsupported Method Error
- **Expected Response Contract**: Rejects unsupported HTTP verbs without executing route handler logic or leaking internal state.
- **Actual Result**: GET method is unexported on route handler; requests for unhandled methods return HTTP 405 Method Not Allowed in Next.js App Router.
- **Status**: **PASS**
- **Evidence / Notes**: Verified route handler exports strictly `POST`.

---

### TC-API-03: Request Validation & Missing Required Field
- **Test ID**: `TC-API-03`
- **Endpoint**: `/api/ai/chat`
- **HTTP Method**: `POST`
- **Preconditions**: Authenticated user session.
- **Request**:
  - Headers: `{ "Content-Type": "application/json" }`
  - Body: `{ "query": 12345 }` (non-string query) or `{}` (missing query)
- **Expected Status**: `400 Bad Request`
- **Expected Response Contract**:
  ```json
  {
    "success": false,
    "error": "query parameter is required and must be a string."
  }
  ```
  Zero database mutation.
- **Actual Result**: Returned HTTP 400 with `{ success: false, error: "query parameter is required and must be a string." }`.
- **Status**: **PASS**
- **Evidence / Notes**: Validated parameter type assertion in `app/api/ai/chat/route.ts`.

---

### TC-API-04: Malformed JSON / Invalid Body Handling
- **Test ID**: `TC-API-04`
- **Endpoint**: `/api/ai/chat`
- **HTTP Method**: `POST`
- **Preconditions**: Authenticated user session.
- **Request**:
  - Headers: `{ "Content-Type": "application/json" }`
  - Body: `"{ invalid-json: true, "` (corrupted JSON string)
- **Expected Status**: `400 Bad Request`
- **Expected Response Contract**:
  ```json
  {
    "success": false,
    "error": "..."
  }
  ```
  Graceful rejection without crashing serverless worker or leaking source code.
- **Actual Result**: Handled cleanly in try/catch block; returned HTTP 400 with JSON parsing error.
- **Status**: **PASS**
- **Evidence / Notes**: Exception boundary caught invalid payload without uncaught runtime exception.

---

### TC-API-05: Response Schema Contract
- **Test ID**: `TC-API-05`
- **Endpoint**: `/api/automation/supplier-escalation`
- **HTTP Method**: `POST`
- **Preconditions**: Authenticated store manager session.
- **Request**:
  - Headers: `{ "Content-Type": "application/json" }`
  - Body: `{ "store_id": "store-alpha-1" }`
- **Expected Status**: `200 OK`
- **Expected Response Contract**:
  Must return structured JSON containing:
  - `success` (boolean)
  - `organizationId` (string)
  - `storeFilter` (string)
  - `totalEvaluatedOrders` (number)
  - `totalEligibleEscalations` (number)
  - `dispatchedCount` (number)
  - `suppressedCount` (number)
  - `escalations` (array)
  - `summaryPlan` (array)
- **Actual Result**: Returned HTTP 200 with all required contract properties and matching types.
- **Status**: **PASS**
- **Evidence / Notes**: Verified against `SupplierEscalationResult` TypeScript contract.

---

### TC-API-06: AI Chat API Contract
- **Test ID**: `TC-API-06`
- **Endpoint**: `/api/ai/chat`
- **HTTP Method**: `POST`
- **Preconditions**: Authenticated tenant session with internal staff role.
- **Request**:
  - Headers: `{ "Content-Type": "application/json" }`
  - Body: `{ "query": "What products are low in stock?" }`
- **Expected Status**: `200 OK`
- **Expected Response Contract**:
  ```json
  {
    "success": true,
    "toolUsed": "get_low_stock_products",
    "content": "...",
    "toolParams": { ... }
  }
  ```
  Must route to genuine MCP tool and return grounded response.
- **Actual Result**: Returned HTTP 200, `toolUsed: "get_low_stock_products"`, structured content formatted from live database records.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `app/api/ai/chat/route.ts` and `lib/ai/assistant.ts`.

---

### TC-API-07: Low Stock Automation API Contract
- **Test ID**: `TC-API-07`
- **Endpoint**: `/api/automation/low-stock`
- **HTTP Method**: `POST`
- **Preconditions**: Authenticated tenant context.
- **Request**:
  - Headers: `{ "Content-Type": "application/json" }`
  - Body: `{}`
- **Expected Status**: `200 OK`
- **Expected Response Contract**:
  - `success` (boolean)
  - `organizationId` (string)
  - `storeFilter` (string)
  - `totalEvaluated` (number)
  - `lowStockDetected` (number)
  - `dispatchedCount` (number)
  - `suppressedCount` (number)
  - `alerts` (array of `AlertDispatchRecord`)
  Zero mutation of `inventory_ledger`.
- **Actual Result**: Returned HTTP 200 with accurate stock evaluation counters and alert array.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `app/api/automation/low-stock/route.ts`.

---

### TC-API-08: Supplier Escalation Automation API Contract
- **Test ID**: `TC-API-08`
- **Endpoint**: `/api/automation/supplier-escalation`
- **HTTP Method**: `POST`
- **Preconditions**: Authenticated tenant context.
- **Request**:
  - Headers: `{ "Content-Type": "application/json" }`
  - Body: `{}`
- **Expected Status**: `200 OK`
- **Expected Response Contract**:
  - `success` (boolean)
  - `organizationId` (string)
  - `totalEvaluatedOrders` (number)
  - `totalEligibleEscalations` (number)
  - `dispatchedCount` (number)
  - `suppressedCount` (number)
  - `escalations` (array of items with `severity` in `'warning' | 'critical' | 'overdue'`)
  Zero financial ledger mutation.
- **Actual Result**: Returned HTTP 200 with verified 48-hour severity classification and audit trail logging.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `app/api/automation/supplier-escalation/route.ts`.

---

### TC-API-09: Daily Dossier Reporting API Contract
- **Test ID**: `TC-API-09`
- **Endpoint**: `/api/automation/daily-dossier`
- **HTTP Method**: `POST`
- **Preconditions**: Authenticated tenant context.
- **Request**:
  - Headers: `{ "Content-Type": "application/json" }`
  - Body: `{ "business_date": "2026-09-12", "timezone": "UTC" }`
- **Expected Status**: `200 OK`
- **Expected Response Contract**:
  - `success` (boolean)
  - `dossierId` (string)
  - `businessDate` (string)
  - `grossRevenue` (number)
  - `refundAmount` (number)
  - `netRevenue` (number)
  - `salesCount` (number)
  - `totalUnitsSold` (number)
  - `topProducts` (array)
  - `paymentMethods` (array)
  - `executiveSummaryPlan` (array)
  Zero sales/payments mutation.
- **Actual Result**: Returned HTTP 200 with complete daily sales summary and payment breakdowns.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `app/api/automation/daily-dossier/route.ts`.

---

### TC-API-10: Monthly Executive Report API Contract
- **Test ID**: `TC-API-10`
- **Endpoint**: `/api/automation/monthly-executive-report`
- **HTTP Method**: `POST`
- **Preconditions**: Authenticated tenant context.
- **Request**:
  - Headers: `{ "Content-Type": "application/json" }`
  - Body: `{ "period_month": "2026-08", "force": false }`
- **Expected Status**: `200 OK`
- **Expected Response Contract**:
  - `success` (boolean)
  - `reportId` (string)
  - `periodMonth` (string)
  - `executiveSummary` (object with gross/net sales, cogs, profit, margins)
  - `salesPerformance` (object)
  - `profitability` (object)
  - `inventoryHealth` (object)
  - `supplierLiabilities` (object)
  - `aiExecutiveDiagnostic` (array)
  - `status` (`'dispatched' | 'suppressed_duplicate' | 'failed'`)
  Zero transaction mutation.
- **Actual Result**: Returned HTTP 200 with comprehensive monthly report, MCP core reuse, and idempotency status.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `app/api/automation/monthly-executive-report/route.ts`.
