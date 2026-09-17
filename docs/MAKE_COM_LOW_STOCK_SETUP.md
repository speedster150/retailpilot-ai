# Make.com Low Stock Auto-Alert Integration Guide

**Scenario Name**: `RetailPilot AI — Low Stock Auto-Alert Orchestrator`
**Automation Type**: External Event-Driven Webhook Automation
**Target Milestone**: Step 11.1
**RetailPilot API Endpoint**: `POST /api/automation/low-stock`
**Internal Server Action**: `triggerLowStockAlertScan` (`app/(dashbaord)/inventory/alert-actions.ts`)
**Audit Table**: `public.low_stock_alerts` (PostgreSQL / Supabase)

---

## 1. Architecture & Integration Overview

```
[RetailPilot Low Stock Detection]
  │  (Cron Schedule or On-Demand Cashier/Manager Scan)
  ├── 1. Authoritative Stock Calculation (SUM(inventory_ledger))
  ├── 2. Comparison against products.reorder_level
  ├── 3. Duplicate Alert Suppression (low_stock_alerts audit history)
  └── 4. Failure-Safe Webhook Dispatch (8s timeout, non-blocking)
                 │
                 ▼ HTTPS POST JSON Payload
[Make.com Custom Webhook Trigger]
  │  (Listens at MAKE_LOW_STOCK_WEBHOOK_URL)
  ├── 1. Validates eventType === "inventory.low_stock"
  ├── 2. Parses Store, Product, Deficit, and Timestamp fields
  └── 3. Passes data to Flow Router
                 │
        ┌────────┴─────────────────────────────────┐
        ▼                                          ▼
[Branch A: Urgent Manager Alert]           [Branch B: Optional Mailchimp / Supplier]
  • Email / Slack / SMS notification        • Handled separately in dedicated step
  • Product SKU, Store, Deficit             • Low-stock customer/procurement digest
  • Direct link to PO creation              • (Documented only, not configured in 11.1)
```

---

## 2. Trigger Configuration & Webhook Specification

### A. Webhook Trigger Module
- **Module**: `Webhooks` &rarr; `Custom webhook`
- **Webhook Name**: `RetailPilot Low Stock Webhook`
- **IP Restrictions**: None (or restricted to RetailPilot deployment egress IPs)
- **Data Structure**: Determined automatically via JSON payload mapping (see below)

### B. RetailPilot Webhook JSON Payload Schema
When a product reaches or drops below its designated reorder level, RetailPilot dispatches the following JSON payload:

```json
{
  "eventId": "evt_1789227752701_e8g8ep",
  "eventType": "inventory.low_stock",
  "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "storeId": "store-downtown-01",
  "storeName": "Downtown Superstore",
  "productId": "prod-arabica-1kg",
  "productName": "Organic Arabica Coffee 1kg",
  "sku": "COF-ARA-01",
  "barcode": "8901234567890",
  "currentStock": 5,
  "reorderLevel": 20,
  "deficit": 15,
  "status": "low_stock",
  "timestamp": "2026-09-12T15:42:32.646Z"
}
```

### C. Payload Field Reference

| Field | Type | Description |
| :--- | :--- | :--- |
| `eventId` | string | Unique idempotency event token (`evt_<timestamp>_<random>`) |
| `eventType` | string | Fixed literal: `"inventory.low_stock"` |
| `organizationId` | UUID string | Multi-tenant organization identifier |
| `storeId` | UUID string | Store location identifier where the stock deficit exists |
| `storeName` | string | Human-readable store name |
| `productId` | UUID string | Product database identifier |
| `productName` | string | Product display name |
| `sku` | string / null | SKU code for inventory ordering |
| `barcode` | string / null | Barcode string for physical scanning |
| `currentStock` | number | Authoritative units currently on hand (`SUM(inventory_ledger)`) |
| `reorderLevel` | number | Threshold where restocking is triggered |
| `deficit` | number | Calculated shortfall (`reorderLevel - currentStock`) |
| `status` | string | Either `"low_stock"` (stock > 0) or `"out_of_stock"` (stock &le; 0) |
| `timestamp` | ISO 8601 | Exact UTC timestamp of detection |

---

## 3. Make.com Scenario Configuration (Step-by-Step)

### Step 1: Create Custom Webhook
1. In your Make.com organization, click **Create a new scenario**.
2. Name the scenario: `RetailPilot AI — Low Stock Auto-Alert Orchestrator`.
3. Add the initial module: **Webhooks** &rarr; **Custom webhook**.
4. Click **Add** to create a new webhook named `RetailPilot Low Stock Webhook`.
5. Copy the generated webhook URL (e.g. `https://hook.eu2.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`).
6. Paste the URL into your RetailPilot `.env.local` file:
   ```bash
   MAKE_LOW_STOCK_WEBHOOK_URL="https://hook.eu2.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```
7. In Make.com, click **Redetermine data structure** and send a test payload (via test script or cURL) so Make.com discovers the JSON attributes.

### Step 2: Add Router & Manager Notification
1. Add a **Router** module following the webhook.
2. **Branch 1 (Manager Email / Slack)**:
   - Module: **Email** (`Send an email`) or **Slack** (`Create a Message`).
   - **Recipient**: Store Manager email (or Slack channel `#store-alerts`).
   - **Subject**: `[URGENT LOW STOCK] {{productName}} ({{sku}}) at {{storeName}}`
   - **Body (HTML / Text)**:
     ```html
     <h3>⚠️ RetailPilot Low Stock Alert</h3>
     <p>The following product has dropped below its reorder threshold:</p>
     <ul>
       <li><strong>Product:</strong> {{productName}}</li>
       <li><strong>SKU:</strong> {{sku}}</li>
       <li><strong>Store:</strong> {{storeName}}</li>
       <li><strong>Current Stock:</strong> {{currentStock}} units</li>
       <li><strong>Reorder Level:</strong> {{reorderLevel}} units</li>
       <li><strong>Deficit:</strong> {{deficit}} units needing reorder</li>
       <li><strong>Detected At:</strong> {{timestamp}}</li>
     </ul>
     <p>Please review and initiate a Purchase Order in RetailPilot AI.</p>
     ```

### Step 3: Failure Handling & Safety
1. Right-click on the Notification module and select **Add error handler**.
2. Select **Ignore** or **Commit** to ensure unexpected notification errors do not cause the scenario to loop or throw unhandled exceptions.
3. Save the scenario and toggle the scheduling switch to **ON (Immediately / As data arrives)**.

---

## 4. Security & Safety Invariants

1. **Credential Hygiene**:
   - Webhook URLs contain private tokens and must **never** be checked into version control, logged in plaintext, or exposed in client responses.
   - RetailPilot automatically masks all webhook URLs in audit logs using `maskWebhookUrl` (e.g. `https://hook.eu2.make.com/abc...5678`).
2. **Strict Server-Derived Tenant Context**:
   - The automation endpoint `POST /api/automation/low-stock` enforces server session derivation via `getAuthenticatedTenantContext(INVENTORY_ROLES)`.
   - Client requests cannot forge `organization_id`. Customer accounts are strictly rejected with `HTTP 403 Forbidden`.
3. **Database & Ledger Immutability**:
   - The low-stock automation is strictly **read-only** with respect to inventory and financials.
   - Make.com **never** writes to `inventory_ledger`, `products`, `sales`, or `purchase_orders`.
   - Webhook network timeouts or HTTP 500 errors **never** corrupt database transactions or roll back existing stock.
4. **Duplicate Suppression & Cooldown**:
   - Before dispatching an alert, RetailPilot inspects `public.low_stock_alerts` for the same `(organization_id, product_id, store_id)`.
   - If a previous alert was dispatched and current stock has not deteriorated further within the 24-hour cooldown period, the alert status is recorded as `suppressed_duplicate` and external webhooks are skipped.

---

## 5. Verification Test Procedure

### Automated Test Execution
Run the dedicated test suite:
```bash
npx tsx tests/verify-low-stock-suite.ts
```
Expected output:
- **Test 1**: Stock condition detection (Normal vs At Reorder vs Below Reorder) &rarr; **PASS**
- **Test 2**: Duplicate alert suppression for unchanged conditions &rarr; **PASS**
- **Test 3**: Worsened condition triggers fresh alert &rarr; **PASS**
- **Test 4**: Multi-store location filtering &rarr; **PASS**
- **Test 5**: Multi-tenant isolation &rarr; **PASS**
- **Test 6**: Webhook failure safety & ledger immutability &rarr; **PASS**
- **Test 7**: RBAC and customer role rejection &rarr; **PASS**
- **Test 8**: Webhook URL masking in audit logs &rarr; **PASS**

### Manual cURL Webhook Ping
To test your live Make.com webhook directly:
```bash
curl -X POST "<YOUR_MAKE_LOW_STOCK_WEBHOOK_URL>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_test_ping_001",
    "eventType": "inventory.low_stock",
    "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "storeId": "store-downtown-01",
    "storeName": "Downtown Superstore",
    "productId": "prod-coffee-01",
    "productName": "Organic Arabica Coffee 1kg",
    "sku": "COF-ARA-01",
    "barcode": "8901234567890",
    "currentStock": 4,
    "reorderLevel": 20,
    "deficit": 16,
    "status": "low_stock",
    "timestamp": "2026-09-12T15:45:00.000Z"
  }'
```

---

## 6. Current Implementation Status & Next Steps

- **RetailPilot Automation Engine**: 100% Implemented & Verified.
- **Audit Logging Table (`low_stock_alerts`)**: Migrated with RLS.
- **Server Actions & API Routes**: Implemented and RBAC-guarded.
- **External Make.com Scenario**: Awaiting live Make.com account credentials / webhook creation.
- **Mailchimp Branch**: Documented as future optional branch (to be handled in separate step).
