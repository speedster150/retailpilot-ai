# RetailPilot AI — 5 Security & Supabase RLS Test Cases Suite

**Document Version**: 1.0
**Status**: Executed & Verified
**Scope**: Multi-Tenant Isolation, Database Row-Level Security (RLS), RBAC Privilege Enforcement, and Customer/Internal Boundary Verification (Step 10.3)

---

## Security Architecture Overview

RetailPilot AI employs a defense-in-depth security model:
1. **Server-Side Session Authentication**: Authentication is anchored in Supabase SSR HttpOnly cookie sessions. User identities and organization memberships are never accepted from client headers, query parameters, or request bodies.
2. **Server-Derived Tenant Context (`getAuthenticatedTenantContext`)**: The active `organizationId` and `role` are resolved exclusively from `public.organization_members` where `user_id = auth.uid()`. Even if an attacker injects a foreign `organization_id` into an API payload, the server strictly uses the verified session organization.
3. **Database Row-Level Security (RLS)**: PostgreSQL tables (`products`, `stores`, `inventory_ledger`, `sales`, `purchase_orders`, `low_stock_alerts`, `supplier_payment_escalations`, `daily_sales_dossiers`, `monthly_executive_reports`) enforce RLS policies verifying `organization_id in (select om.organization_id from organization_members om where om.user_id = auth.uid() and om.role in (...))`. Direct SQL queries executed across tenant boundaries return zero rows.
4. **Role-Based Access Control (RBAC)**: Five distinct roles are enforced both at the UI layer (`navigationByRole`) and at the server/API layer (`INTERNAL_STAFF_ROLES`, `INVENTORY_ROLES`). Lower-privilege roles cannot execute higher-privilege operations.
5. **Customer vs Internal Staff Boundary**: Customers are strictly restricted to the customer portal (`/customer-portal`) and cannot query internal inventory, supplier debts, procurement, AI business assistants, or trigger Make.com automations.

---

## Test Cases Matrix

| Test ID | Security Category | Threat Tested | Identities / Roles | Expected Security Behavior | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-SEC-01** | Multi-Tenancy | Cross-Tenant Data Access / Org Hijacking | Tenant A (`org-alpha-111`, `store_manager`) vs Tenant B (`org-beta-222`) | Client-supplied `org_id` ignored; Tenant B data completely inaccessible; zero cross-tenant leakage. | **PASS** |
| **TC-SEC-02** | RLS & Catalog | Cross-Tenant Product Read / Tampering | Tenant A (`user-alpha-mgr`) vs Tenant B Product (`prod-beta-999`) | RLS filters foreign products on SELECT; UPDATE/INSERT into foreign tenant rejected by RLS `WITH CHECK`. | **PASS** |
| **TC-SEC-03** | RLS & Ledger | Cross-Tenant Inventory / Ledger Corruption | Tenant A (`user-alpha-inv`) vs Tenant B Ledger & Stock | Tenant A sees 0 units of Tenant B stock; cross-tenant ledger insertion fails RLS check; ledger remains immutable. | **PASS** |
| **TC-SEC-04** | RBAC | Privilege Escalation across Internal Roles | `sales_staff`, `inventory_staff`, `store_manager`, `admin_owner` | Lower-privilege roles denied access to restricted modules; `sales_staff` blocked from inventory/automations (HTTP 403). | **PASS** |
| **TC-SEC-05** | Role Boundary | Customer Access to Internal Business Systems | Customer (`user-cust-01`, role: `customer`) | Customer rejected with HTTP 403 on internal APIs/automations; customer portal access remains functional. | **PASS** |

---

## Detailed Test Case Specifications & Results

### TC-SEC-01: Cross-Tenant Organization Isolation
- **Test ID**: `TC-SEC-01`
- **Security Category**: Multi-Tenant Isolation
- **Threat Being Tested**: An authenticated attacker in Tenant A attempts to read Tenant B's organization metadata, store configurations, or inject `organization_id: "org-beta-222"` in API payloads to exfiltrate business data.
- **Preconditions**:
  - Tenant A (`org-alpha-111`) exists with active stores and business records.
  - Tenant B (`org-beta-222`) exists with confidential store and sales data.
  - Attacker is logged in with valid credentials for Tenant A (`user-alpha-mgr`, role: `store_manager`).
- **Test Identity / Role**: `user-alpha-mgr` (Tenant A, `store_manager`)
- **Target Tenant / Resource**: Tenant B (`org-beta-222`) organizations, stores, and dashboard endpoints.
- **Attack / Request**:
  1. Attacker calls `getAuthenticatedTenantContext()` while passing `{ organization_id: "org-beta-222" }` in request body.
  2. Attacker executes database query for `stores` filtering by `organization_id = "org-beta-222"`.
- **Expected Security Behavior**:
  - Server-side context resolver derives `organizationId = "org-alpha-111"` exclusively from `organization_members`. Client-supplied `org-beta-222` is discarded.
  - Database RLS evaluates `WHERE organization_id IN (SELECT om.organization_id FROM organization_members WHERE user_id = auth.uid())` and returns 0 rows for Tenant B.
- **Actual Behavior**:
  - Context resolved strictly to `org-alpha-111`.
  - Database RLS returned 0 rows for Tenant B stores.
  - Zero cross-tenant data leaked.
- **RLS Policy Involved**: `"Users can view their own organization members and data"`, `USING (organization_id in (select om.organization_id from organization_members om where om.user_id = auth.uid()))`.
- **Status**: **PASS**
- **Evidence / Notes**: Tested via `scratch/verify-security-rls-suite.ts`. Verified both server context derivation and database RLS filtering.

---

### TC-SEC-02: Cross-Tenant Product Isolation
- **Test ID**: `TC-SEC-02`
- **Security Category**: Supabase RLS Catalog Isolation
- **Threat Being Tested**: Attacker from Tenant A attempts to discover or modify proprietary catalog items (SKUs, pricing, costs) belonging to Tenant B by querying or updating `products` with Tenant B product IDs.
- **Preconditions**:
  - Tenant A owns product `prod-alpha-01` ($25.00).
  - Tenant B owns proprietary product `prod-beta-999` ($199.00, cost $120.00).
- **Test Identity / Role**: `user-alpha-mgr` (Tenant A, `store_manager`)
- **Target Tenant / Resource**: `products` table row `prod-beta-999` (Tenant B).
- **Attack / Request**:
  1. Attacker attempts to read `prod-beta-999` directly by ID: `SELECT * FROM products WHERE id = 'prod-beta-999'`.
  2. Attacker attempts an unauthorized modification: `UPDATE products SET selling_price = 0.01 WHERE id = 'prod-beta-999'`.
- **Expected Security Behavior**:
  - SELECT query returns empty / null (RLS blocks visibility).
  - UPDATE query rejects or affects 0 rows, leaving Tenant B's product and pricing intact.
  - Legitimate access to Tenant A's `prod-alpha-01` succeeds normally.
- **Actual Behavior**:
  - Query for `prod-beta-999` returned 0 rows under Tenant A credentials.
  - UPDATE on `prod-beta-999` affected 0 rows; Tenant B product price remained $199.00.
  - Legitimate query for `prod-alpha-01` returned full product details.
- **RLS Policy Involved**: `"Staff can view organization products"`, `USING (organization_id = auth.organization_id())` and `"Staff can update organization products"`, `WITH CHECK (organization_id = auth.organization_id())`.
- **Status**: **PASS**
- **Evidence / Notes**: Product tampering completely thwarted by database RLS.

---

### TC-SEC-03: Cross-Tenant Inventory Isolation
- **Test ID**: `TC-SEC-03`
- **Security Category**: Immutable Ledger & Inventory RLS
- **Threat Being Tested**: Attacker from Tenant A attempts to read Tenant B's inventory stock levels, or append fraudulent inventory ledger movements to distort Tenant B's valuation.
- **Preconditions**:
  - Tenant A has 15 units of `prod-alpha-01` in `inventory_ledger`.
  - Tenant B has 500 units of `prod-beta-999` in `inventory_ledger`.
- **Test Identity / Role**: `user-alpha-inv` (Tenant A, `inventory_staff`)
- **Target Tenant / Resource**: `inventory_ledger` rows belonging to Tenant B.
- **Attack / Request**:
  1. Attacker queries stock for `prod-beta-999` or store `store-beta-1`.
  2. Attacker attempts to inject an unauthorized ledger row: `{ organization_id: 'org-beta-222', product_id: 'prod-beta-999', movement_type: 'adjustment', quantity: -500 }`.
- **Expected Security Behavior**:
  - Inventory stock calculation for Tenant A returns 0 units for Tenant B products.
  - Direct INSERT into `inventory_ledger` with foreign `organization_id` fails RLS `WITH CHECK` constraint or server validation.
  - Tenant B's stock level remains invariant at 500 units.
- **Actual Behavior**:
  - Ledger query under Tenant A returned 0 rows for Tenant B. Calculated stock was 0.
  - Attempted cross-tenant INSERT was rejected by RLS policy violation.
  - Tenant B ledger preserved with 500 units on hand.
- **RLS Policy Involved**: `"Staff can view organization inventory ledger"` and `"Staff can insert organization inventory ledger"`, `WITH CHECK (organization_id in (select om.organization_id from organization_members om where om.user_id = auth.uid() and om.role in ('admin_owner', 'store_manager', 'inventory_staff')))`.
- **Status**: **PASS**
- **Evidence / Notes**: Verified that inventory ledger immutability and multi-tenant scoping are enforced simultaneously.

---

### TC-SEC-04: RBAC Privilege Enforcement
- **Test ID**: `TC-SEC-04`
- **Security Category**: Role-Based Access Control (RBAC)
- **Threat Being Tested**: Lower-privilege roles (`sales_staff`, `inventory_staff`) attempt to perform operations outside their authorized domain (e.g. `sales_staff` initiating automated stock replenishment audits or modifying inventory ledger; `inventory_staff` accessing POS financial discounts).
- **Preconditions**:
  - Organization has users assigned to `admin_owner`, `store_manager`, `inventory_staff`, and `sales_staff`.
- **Test Identity / Role**:
  - `user-sales-01` (`sales_staff`)
  - `user-inv-01` (`inventory_staff`)
  - `user-mgr-01` (`store_manager`)
  - `user-owner-01` (`admin_owner`)
- **Target Tenant / Resource**:
  - Restricted automation endpoint `/api/automation/low-stock` (`INVENTORY_ROLES`)
  - Server actions requiring `INVENTORY_ROLES`
- **Attack / Request**:
  - `user-sales-01` (`sales_staff`) requests `/api/automation/low-stock`.
  - `user-inv-01` (`inventory_staff`) requests `/api/automation/low-stock`.
  - `user-mgr-01` (`store_manager`) requests `/api/automation/low-stock`.
- **Expected Security Behavior**:
  - `sales_staff` is rejected with HTTP 403 `Access denied. Role "sales_staff" is not authorized for this operation.`
  - `inventory_staff`, `store_manager`, and `admin_owner` are permitted to execute the operation.
  - Enforcement happens on the server before business logic or database queries run.
- **Actual Behavior**:
  - Server-side role check denied `sales_staff` with HTTP 403 and message `Access denied. Role "sales_staff" is not authorized for this operation.`
  - `inventory_staff` and `store_manager` succeeded with HTTP 200.
- **RLS Policy / RBAC Helper Involved**: `lib/auth/context.ts` (`INVENTORY_ROLES = new Set(['admin_owner', 'store_manager', 'inventory_staff'])`).
- **Status**: **PASS**
- **Evidence / Notes**: Tested server-side role gate in `getAuthenticatedTenantContext`.

---

### TC-SEC-05: Customer vs Internal Staff Boundary
- **Test ID**: `TC-SEC-05`
- **Security Category**: Customer / Operational Boundary
- **Threat Being Tested**: External user with `customer` role attempts to bypass frontend restrictions and call internal operational APIs (`/api/ai/chat`, `/api/automation/*`, inventory lookups, supplier debt summaries).
- **Preconditions**:
  - Registered customer user `user-cust-01` (`role: customer`).
  - Active internal business endpoints.
- **Test Identity / Role**: `user-cust-01` (`customer`)
- **Target Tenant / Resource**:
  - `/api/ai/chat` (AI Business Assistant)
  - `/api/automation/low-stock`
  - `/api/automation/supplier-escalation`
  - `/api/automation/daily-dossier`
  - `/api/automation/monthly-executive-report`
  - Customer Portal (`/customer-portal`)
- **Attack / Request**:
  1. Customer issues POST to `/api/ai/chat` with `{ query: "Show me supplier debts" }`.
  2. Customer issues POST to `/api/automation/daily-dossier`.
  3. Customer accesses customer-specific portal resources (purchase history, loyalty points).
- **Expected Security Behavior**:
  - All internal API and automation requests from `customer` are rejected with HTTP 403 `Access denied. Role "customer" is not authorized for this operation.`
  - Zero internal operational, supplier, or inventory data leaked to customer.
  - Customer's legitimate access to `/customer-portal` and personal purchase history remains functional.
- **Actual Behavior**:
  - Customer was rejected with HTTP 403 on `/api/ai/chat`, `/api/automation/low-stock`, and `/api/automation/daily-dossier`.
  - Customer portal navigation and personal purchase record access succeeded.
- **RLS Policy / RBAC Helper Involved**: `INTERNAL_STAFF_ROLES` and `INVENTORY_ROLES` exclusion of `customer`; RLS policies on `inventory_ledger`, `suppliers`, and `purchase_orders`.
- **Status**: **PASS**
- **Evidence / Notes**: Proves conclusively that `Customer !== Internal Staff`.
