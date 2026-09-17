# RetailPilot AI — 25 Functional Test Cases Suite

**Document Version**: 1.0
**Status**: Executed & Verified
**Scope**: End-to-End Business Functional Tests (Step 10.1)

---

### TC-FUNC-01: Authentication & User Login
- **Module**: Auth
- **Test Name**: Verify user login and session cookie establishment
- **Preconditions**: User is registered with valid credentials in Supabase Auth and active in `organization_members`.
- **Test Data**: Email: `manager@retailpilot.ai`, Password: `ValidPassword123!`
- **Steps**:
  1. Submit credentials to `supabase.auth.signInWithPassword`.
  2. Inspect returned session, access token, and user identity.
  3. Validate session user ID and authentication status.
- **Expected Result**: Authentication succeeds, returns user profile, session token established.
- **Actual Result**: Authentication succeeded; user identity retrieved with authenticated status.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via Supabase client session validation and `lib/auth/context.ts`.

---

### TC-FUNC-02: Protected Dashboard Access & Redirects
- **Module**: Auth / Layout
- **Test Name**: Enforce protected route access and redirect unauthenticated requests
- **Preconditions**: Unauthenticated guest (no active session cookies).
- **Test Data**: Route: `/dashboard`
- **Steps**:
  1. Attempt to access `/dashboard` without authorization cookies.
  2. Evaluate `getAuthenticatedTenantContext()`.
- **Expected Result**: Request is rejected with `401 Unauthorized` or redirect to `/login`.
- **Actual Result**: `getAuthenticatedTenantContext()` returned `{ success: false, status: 401, error: 'Authentication required. No active session found.' }`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `lib/auth/context.ts` barrier.

---

### TC-FUNC-03: Organization & Tenant Context Derivation
- **Module**: Multi-Tenancy
- **Test Name**: Derive organization tenant context strictly from verified session
- **Preconditions**: User belongs to organization `org-tenant-alpha` with role `store_manager`.
- **Test Data**: User ID: `user-mgr-01`, Org ID: `org-tenant-alpha`
- **Steps**:
  1. Call `getAuthenticatedTenantContext(INVENTORY_ROLES)`.
  2. Verify derived `organizationId` matches database membership.
  3. Confirm tenant context cannot be overridden by client request params.
- **Expected Result**: `organizationId` is derived exclusively from server session.
- **Actual Result**: Derived `organizationId: 'org-tenant-alpha'` and `role: 'store_manager'`.
- **Status**: **PASS**
- **Evidence / Notes**: Tested across all automation and API handlers.

---

### TC-FUNC-04: Product Creation & Validation
- **Module**: Catalog
- **Test Name**: Create new product with barcode, SKU, cost price, and selling price
- **Preconditions**: User has `inventory_staff` or `store_manager` role.
- **Test Data**: Name: `'Organic Arabica Coffee 1kg'`, SKU: `'COF-ARA-01'`, Cost: `12.50`, Price: `28.00`, Reorder: `15`
- **Steps**:
  1. Validate product schema fields (name, SKU, cost, price).
  2. Insert into `products` table for the tenant.
  3. Verify record persistence and retrieval.
- **Expected Result**: Product is saved with valid positive monetary values and active status.
- **Actual Result**: Product saved with ID `prod-test-01`, cost `$12.50`, price `$28.00`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified with catalog persistence tests.

---

### TC-FUNC-05: Product Editing & Status Updates
- **Module**: Catalog
- **Test Name**: Edit existing product details and toggle active status
- **Preconditions**: Product exists in tenant catalog.
- **Test Data**: Product ID: `prod-test-01`, New Price: `32.00`, Status: `true`
- **Steps**:
  1. Query existing product.
  2. Update `selling_price` from `28.00` to `32.00`.
  3. Persist and retrieve updated product.
- **Expected Result**: Product selling price updated to `$32.00` while preserving ID and SKU.
- **Actual Result**: Updated product retrieved with price `$32.00`.
- **Status**: **PASS**
- **Evidence / Notes**: Confirmed field modification without record duplication.

---

### TC-FUNC-06: Category Management & FK Validation
- **Module**: Catalog
- **Test Name**: Create category and associate products with category foreign key
- **Preconditions**: Active tenant organization.
- **Test Data**: Category: `'Beverages & Coffee'`, Code: `'BEV'`
- **Steps**:
  1. Insert category record into `categories`.
  2. Associate product `prod-test-01` with `category_id`.
  3. Validate relational integrity.
- **Expected Result**: Product references valid category belonging to the same tenant.
- **Actual Result**: Product successfully linked to category `BEV`.
- **Status**: **PASS**
- **Evidence / Notes**: Foreign key constraint verified.

---

### TC-FUNC-07: Supplier Creation & Contact Validation
- **Module**: Suppliers
- **Test Name**: Register supplier with payment terms and contact details
- **Preconditions**: Authorized store manager or admin.
- **Test Data**: Name: `'Atlas Roasters Ltd'`, Terms: `'Net 30'`, Email: `'ap@atlasroasters.com'`
- **Steps**:
  1. Validate email and phone formatting.
  2. Insert supplier record into `suppliers`.
  3. Query supplier by organization.
- **Expected Result**: Supplier created with parsed payment terms.
- **Actual Result**: Supplier created with terms `'Net 30'` (30 days parsed).
- **Status**: **PASS**
- **Evidence / Notes**: Validated via `lib/finance/supplier-outstanding.ts` term parser.

---

### TC-FUNC-08: Product-Supplier Relationship
- **Module**: Suppliers / Catalog
- **Test Name**: Associate supplier with procured purchase order lines
- **Preconditions**: Active supplier and active product in catalog.
- **Test Data**: Supplier ID: `supp-atlas`, Product ID: `prod-test-01`
- **Steps**:
  1. Create PO linking supplier to product lines.
  2. Verify supplier ID is maintained across PO records.
- **Expected Result**: Purchase order correctly links product to designated supplier.
- **Actual Result**: PO items successfully reference product and supplier ID.
- **Status**: **PASS**
- **Evidence / Notes**: Cross-table relationship verified.

---

### TC-FUNC-09: Purchase Order Creation & Line Items
- **Module**: Purchases
- **Test Name**: Generate purchase order with multiple line items and total amount
- **Preconditions**: Supplier and products exist.
- **Test Data**: 100 units of `'COF-ARA-01'` @ `$12.50` = `$1,250.00`
- **Steps**:
  1. Create PO header with status `'ordered'`.
  2. Insert line item with quantity `100` and unit cost `$12.50`.
  3. Calculate order total.
- **Expected Result**: PO created with status `'ordered'` and total obligation `$1,250.00`.
- **Actual Result**: PO created with order total `$1,250.00`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified with `purchase_orders` and `purchase_order_items`.

---

### TC-FUNC-10: Purchase Order Status Workflow
- **Module**: Purchases
- **Test Name**: Transition purchase order from 'ordered' to 'received'
- **Preconditions**: PO exists in `'ordered'` status.
- **Test Data**: PO ID: `po-1001`
- **Steps**:
  1. Create initial PO in `'ordered'` status.
  2. Transition status to `'received'` upon delivery verification.
- **Expected Result**: PO status updates to `'received'`.
- **Actual Result**: PO status updated to `'received'`.
- **Status**: **PASS**
- **Evidence / Notes**: Transition state verified.

---

### TC-FUNC-11: Goods Receipt / GRN Recording
- **Module**: Procurement
- **Test Name**: Record Goods Receipt Note (GRN) against purchase order
- **Preconditions**: PO exists in active status.
- **Test Data**: GRN Number: `'GRN-2026-008'`, Received Qty: `100`
- **Steps**:
  1. Create goods receipt record referencing PO ID.
  2. Insert goods receipt items.
  3. Set status to `'completed'`.
- **Expected Result**: GRN recorded with received timestamp and link to PO.
- **Actual Result**: GRN created and linked to PO with status `'completed'`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `goods_receipts`.

---

### TC-FUNC-12: Immutable Inventory Ledger Update
- **Module**: Inventory
- **Test Name**: Post immutable purchase entry to inventory ledger upon goods receipt
- **Preconditions**: Valid completed GRN.
- **Test Data**: Movement Type: `'purchase'`, Quantity: `+100`, Store: `store-alpha-1`
- **Steps**:
  1. Insert record into `inventory_ledger`.
  2. Verify movement type is strictly in positive inbound set.
  3. Confirm no update or delete is permitted on historical ledger rows.
- **Expected Result**: Ledger record appended with quantity `100` and timestamp.
- **Actual Result**: Ledger entry appended; quantity `100`, movement `'purchase'`.
- **Status**: **PASS**
- **Evidence / Notes**: Ledger immutability verified.

---

### TC-FUNC-13: Current Stock Calculation from Ledger
- **Module**: Inventory
- **Test Name**: Compute current on-hand stock by summing ledger movements
- **Preconditions**: Ledger contains `+100` (purchase) and `-15` (sale).
- **Test Data**: Product: `prod-test-01`, Store: `store-alpha-1`
- **Steps**:
  1. Query ledger movements for product and store.
  2. Sum positive and negative movements using `calculateInventoryStock()`.
- **Expected Result**: Current stock equals `100 - 15 = 85` units.
- **Actual Result**: `calculateInventoryStock()` returned `currentStock: 85`.
- **Status**: **PASS**
- **Evidence / Notes**: Mathematical reconciliation verified.

---

### TC-FUNC-14: Low-Stock Threshold Detection
- **Module**: Inventory
- **Test Name**: Identify products at or below reorder level
- **Preconditions**: Product with reorder level `20` and current stock `15`.
- **Test Data**: Stock: `15`, Reorder Level: `20`, Deficit: `5`
- **Steps**:
  1. Invoke `getLowStockProducts()`.
  2. Verify product is flagged as `'low_stock'`.
- **Expected Result**: Product detected with status `'low_stock'` and deficit `5`.
- **Actual Result**: Product flagged with `status: 'low_stock'` and `deficit: 5`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `lib/inventory/stock.ts`.

---

### TC-FUNC-15: Product Search & SKU Filtering
- **Module**: Catalog
- **Test Name**: Filter products by SKU, search term, and category
- **Preconditions**: Multiple products in catalog.
- **Test Data**: Search query: `'COF'`, SKU prefix: `'COF-ARA'`
- **Steps**:
  1. Query products with pattern match on name or SKU.
  2. Verify search result accuracy.
- **Expected Result**: Returns matching coffee products; excludes unrelated items.
- **Actual Result**: Matching product returned with exact SKU match.
- **Status**: **PASS**
- **Evidence / Notes**: Filter criteria verified.

---

### TC-FUNC-16: POS Sale Record Creation
- **Module**: POS
- **Test Name**: Create POS sales transaction with invoice number and store reference
- **Preconditions**: Store and products exist.
- **Test Data**: Invoice: `'INV-2026-0042'`, Total: `$64.00`
- **Steps**:
  1. Insert sales header into `sales` table.
  2. Set status to `'completed'`.
- **Expected Result**: Sale header created with store ID, total amount, and completed status.
- **Actual Result**: Sale created with ID `sale-42`, status `'completed'`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `sales` table.

---

### TC-FUNC-17: Sale Items & Line Totals
- **Module**: POS
- **Test Name**: Record sale line items and decrement stock via ledger
- **Preconditions**: Active sale header.
- **Test Data**: 2 units of `'COF-ARA-01'` @ `$32.00` = `$64.00`
- **Steps**:
  1. Insert line item into `sale_items`.
  2. Insert `-2` movement into `inventory_ledger` with type `'sale'`.
- **Expected Result**: Sale items persisted and inventory ledger reflects outbound deduction.
- **Actual Result**: Line item recorded, ledger decremented by `2`.
- **Status**: **PASS**
- **Evidence / Notes**: POS itemization verified.

---

### TC-FUNC-18: Payment Recording & Payment Methods
- **Module**: Payments
- **Test Name**: Record completed payment for sale transaction
- **Preconditions**: Completed sale header.
- **Test Data**: Amount: `$64.00`, Method: `'credit_card'`, Status: `'completed'`
- **Steps**:
  1. Insert payment into `payments` table referencing `sale_id`.
  2. Verify payment status is `'completed'`.
- **Expected Result**: Payment logged and linked to sale invoice.
- **Actual Result**: Payment recorded with method `'credit_card'`, amount `$64.00`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `payments` table.

---

### TC-FUNC-19: Customer Creation & Validation
- **Module**: Customers
- **Test Name**: Register customer profile with phone and email
- **Preconditions**: Authorized store staff.
- **Test Data**: Name: `'John Doe'`, Phone: `'+1-555-0144'`, Email: `'john.doe@example.com'`
- **Steps**:
  1. Insert customer record into `customers`.
  2. Verify customer retrieval by phone or ID.
- **Expected Result**: Customer created with zero initial loyalty points.
- **Actual Result**: Customer created with ID `cust-01`, loyalty points `0`.
- **Status**: **PASS**
- **Evidence / Notes**: Customer model verified.

---

### TC-FUNC-20: Customer Purchase History & Loyalty Points
- **Module**: Customers
- **Test Name**: Link sales to customer profile and accumulate loyalty points
- **Preconditions**: Active customer profile.
- **Test Data**: Customer ID: `cust-01`, Sale Amount: `$64.00`, Points Earned: `6`
- **Steps**:
  1. Link sale header to `customer_id`.
  2. Increment customer `loyalty_points`.
- **Expected Result**: Sale is linked to customer and loyalty points updated.
- **Actual Result**: Customer points incremented to `6`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified customer purchase linkage.

---

### TC-FUNC-21: Sales Returns & Refund Processing
- **Module**: Returns
- **Test Name**: Process sales return, log refund amount, and return stock to ledger
- **Preconditions**: Completed sale transaction.
- **Test Data**: Refund Amount: `$32.00` (1 item returned), Status: `'completed'`
- **Steps**:
  1. Insert record into `returns` table with status `'completed'`.
  2. Insert `+1` movement into `inventory_ledger` with type `'return'`.
- **Expected Result**: Return logged, refund recorded, stock replenished by 1 unit.
- **Actual Result**: Return logged with `$32.00` refund and ledger increased by `1`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `returns` and `inventory_ledger`.

---

### TC-FUNC-22: Operating Expenses Tracking
- **Module**: Expenses
- **Test Name**: Record store operational expense and categorize
- **Preconditions**: Active store in organization.
- **Test Data**: Category: `'Utilities'`, Amount: `$150.00`, Store: `store-alpha-1`
- **Steps**:
  1. Insert expense record into `expenses`.
  2. Verify expense is accounted in net profit calculations.
- **Expected Result**: Expense logged with approved status and store reference.
- **Actual Result**: Expense logged with amount `$150.00`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `expenses` table.

---

### TC-FUNC-23: Inter-Store Inventory Transfers
- **Module**: Inventory
- **Test Name**: Execute inventory transfer between two stores via balanced ledger movements
- **Preconditions**: Two active stores (`store-alpha-1` and `store-alpha-2`).
- **Test Data**: Quantity: `10`, Product: `prod-test-01`
- **Steps**:
  1. Post `-10` movement with type `'transfer_out'` for `store-alpha-1`.
  2. Post `+10` movement with type `'transfer_in'` for `store-alpha-2`.
  3. Verify organization-wide net inventory remains unchanged.
- **Expected Result**: Source store decrements by 10, destination store increments by 10, org total unchanged.
- **Actual Result**: Store 1 stock dropped by 10; Store 2 stock increased by 10; org net delta = 0.
- **Status**: **PASS**
- **Evidence / Notes**: Balanced double-entry transfer verified.

---

### TC-FUNC-24: Executive Business Reports Generation
- **Module**: Reports
- **Test Name**: Aggregate monthly sales, COGS, expenses, and profitability metrics
- **Preconditions**: Completed sales, expenses, and inventory records exist.
- **Test Data**: Period: `'2026-08'`
- **Steps**:
  1. Call `generateExecutiveBusinessReport({ organizationId, periodMonth: '2026-08' })`.
  2. Verify gross sales, COGS, operating expenses, and net profit.
- **Expected Result**: Accurate financial summary produced with zero hallucinated figures.
- **Actual Result**: Executive report generated with gross sales, net profit, and profit margin.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `lib/reports/business-report.ts`.

---

### TC-FUNC-25: AI Business Assistant & MCP Query
- **Module**: AI Assistant
- **Test Name**: Process natural language business query via genuine MCP tool dispatch
- **Preconditions**: Authenticated tenant session.
- **Test Data**: Query: `'Which items are low in stock?'`
- **Steps**:
  1. Send query to `runAssistantQuery()`.
  2. Verify intent router selects `get_low_stock_products` MCP tool.
  3. Verify response is formatted from live database records.
- **Expected Result**: Tool `get_low_stock_products` executed, returns structured low stock items.
- **Actual Result**: Tool `get_low_stock_products` executed, returned live stock data and AI recommendations.
- **Status**: **PASS**
- **Evidence / Notes**: Verified via `lib/ai/assistant.ts` and MCP registry.
