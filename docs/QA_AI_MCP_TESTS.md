# RetailPilot AI — 5 AI & MCP Test Cases Suite

**Document Version**: 1.0
**Status**: Executed & Verified
**Scope**: Natural Language Intent Routing, Live Database Grounding, Anti-Hallucination Boundaries, AI Tenant/RBAC Isolation, and AI Recommendation Disclaimers (Step 10.4)

---

## AI & MCP Architecture Overview

The RetailPilot AI Business Assistant connects the user interface to genuine database operations via the Model Context Protocol (MCP):

```
User Natural-Language Query
         │
         ▼
[Intent Detection & Entity Parsing] (detectToolIntent in lib/ai/assistant.ts)
         │
         ├── Unsupported / Speculative Intent? ──► Returns explicit scope boundary (No Hallucination)
         │
         ▼
[MCP Registry Dispatcher] (executeMCPTool in lib/mcp/registry.ts)
         │
         ├── Enforces AuthenticatedTenantContext (organizationId, role, Supabase RLS client)
         │
         ▼
[Official MCP Tools (All 5 Implemented)]
  ├── 1. get_low_stock_products
  ├── 2. get_dead_stock
  ├── 3. get_profitability
  ├── 4. get_supplier_outstanding
  └── 5. generate_business_report
         │
         ▼
[Live PostgreSQL / Supabase Database Records] (Immutable Ledger, Sales, Suppliers, POs)
         │
         ▼
[Response Synthesizer]
  ├── "### 📊 Live Database Facts" (Hard metrics from database query)
  ├── "### 💡 Actionable Insights & Recommendations" (Disclaimers & action plans)
  └── Mandatory algorithmic disclaimer tag
```

---

## 5 Required AI & MCP Test Cases Matrix

| Test ID | AI / MCP Capability | Query Tested | Expected MCP Tool | Actual Tool | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AI-01** | Natural Language → MCP Tool Routing | *"Which products are currently low in stock?"* | `get_low_stock_products` | `get_low_stock_products` | **PASS** |
| **TC-AI-02** | Live Database Grounding & Dynamic Sensitivity | *"What is our store profitability for August 2026?"* | `get_profitability` | `get_profitability` | **PASS** |
| **TC-AI-03** | Anti-Hallucination & Unsupported Fact Boundary | *"Which supplier will increase prices next month?"* | `None` (Out of database scope) | `None` (Scope bounded) | **PASS** |
| **TC-AI-04** | AI Tenant & RBAC Isolation Chain | Tenant A vs Tenant B queries; Customer role `/api/ai/chat` | Protected MCP Execution | Rejects Customer (403); isolates Tenant A | **PASS** |
| **TC-AI-05** | Recommendation Disclaimer & Fact Separation | *"Show me dead stock products with 60 days of zero sales"* | `get_dead_stock` | `get_dead_stock` | **PASS** |

---

## Complete 5 MCP Tools Surface Coverage

In addition to the 5 primary test cases, all 5 official MCP tools were verified for schema definition, intent detection, argument extraction, and database execution:

| # | MCP Tool Name | Definition & Schema | Intent Sample Query | Output Contract Verified |
| :-: | :--- | :--- | :--- | :--- |
| **1** | `get_low_stock_products` | `min_days`, `include_out_of_stock`, `store_id` | *"Which products are below reorder level?"* | Returns real-time stock deficits and reorder thresholds |
| **2** | `get_dead_stock` | `min_days`, `store_id` | *"Show me dead stock in the last 60 days"* | Calculates tied-up capital and zero-velocity SKUs |
| **3** | `get_profitability` | `store_id`, `start_date`, `end_date` | *"What is our profitability for August 2026?"* | Computes gross sales, COGS, expenses, net margin |
| **4** | `get_supplier_outstanding` | `min_due`, `overdue_only`, `supplier_id` | *"Which suppliers have overdue payments?"* | Aggregates unpaid PO liabilities and overdue balances |
| **5** | `generate_business_report` | `period_month`, `store_id` | *"Generate executive report for August 2026"* | Synthesizes full 4-pillar executive business report |

---

## Detailed Test Case Specifications & Results

### TC-AI-01: Natural Language → Correct MCP Tool
- **Test ID**: `TC-AI-01`
- **User Role**: `store_manager` (Tenant A)
- **Natural-Language Query**: `"Which products are currently low in stock?"`
- **Expected MCP Tool**: `get_low_stock_products`
- **Actual MCP Tool**: `get_low_stock_products`
- **Expected Behavior**: Intent detection accurately classifies query, dispatches to `get_low_stock_products` via MCP registry, queries database ledger, and returns formatted factual response.
- **Actual Behavior**: Classified query to `get_low_stock_products` with 0.95 confidence; executed live MCP tool; returned structured response detailing 1 item below reorder threshold.
- **Database Evidence**: Detected `prod-test-01` ("Organic Arabica Coffee 1kg") with currentStock = 15, reorderLevel = 20, deficit = 5.
- **AI Response Evidence**:
  ```markdown
  ### 📊 Live Database Facts
  * **Total Action Items:** 1 product(s) below reorder threshold.
  * **Critically Out of Stock:** 0 item(s).
  * **Low Stock (Below Threshold):** 1 item(s).
  #### Affected Inventory:
  * **Organic Arabica Coffee 1kg** (SKU: `COF-ARA-01`): **15** in stock (Reorder: 20, Deficit: **5** units)
  ```
- **Status**: **PASS**

---

### TC-AI-02: Live Database Grounding & Dynamic Sensitivity
- **Test ID**: `TC-AI-02`
- **User Role**: `store_manager` (Tenant A)
- **Natural-Language Query**: `"What is our store profitability for August 2026?"`
- **Expected MCP Tool**: `get_profitability`
- **Actual MCP Tool**: `get_profitability`
- **Expected Behavior**: AI returns financial metrics derived strictly from live sales and ledger entries. Modifying the underlying database data dynamically changes the AI response; zero hardcoded numbers are used.
- **Actual Behavior**:
  1. Base state: Gross Sales = $50.00, COGS = $20.00, Net Profit = $30.00 (60.00% margin).
  2. Database dynamic mutation: Inserted second sale of $100.00 (COGS $40.00).
  3. Re-queried AI: Gross Sales updated dynamically to $150.00, COGS to $60.00, Net Profit to $90.00.
- **Database Evidence**: State before: 1 sale record ($50.00). State after: 2 sale records ($150.00). AI response tracked database change precisely.
- **AI Response Evidence**:
  Base response contained: `* **Gross Sales:** **$50.00**... Net Profit: **$30.00**`.
  Updated response contained: `* **Gross Sales:** **$150.00**... Net Profit: **$90.00**`.
- **Status**: **PASS**

---

### TC-AI-03: Anti-Hallucination & Unsupported Fact Boundary
- **Test ID**: `TC-AI-03`
- **User Role**: `store_manager` (Tenant A)
- **Natural-Language Query**: `"Which supplier will increase prices next month?"`
- **Expected MCP Tool**: `None` (Query is outside verifiable database scope)
- **Actual MCP Tool**: `None`
- **Expected Behavior**: The AI assistant must not speculate, must not invent future price increases, must not fabricate vendor decisions, and must clearly declare its boundaries.
- **Actual Behavior**: The assistant recognized the query as outside database facts, rejected hallucination, and presented its explicit operational boundaries without asserting unverified facts.
- **Database Evidence**: Zero tables store uncommitted future wholesale vendor speculations.
- **AI Response Evidence**:
  ```markdown
  I am your RetailPilot AI Business Assistant connected directly to your store's live MCP data layer.
  I can assist you with:
  1. Low Stock Alerts: "What products are low in stock?"
  2. Dead Stock Analysis: "Show me dead stock."
  3. Store Profitability: "What is my profitability?"
  4. Supplier Liabilities: "Which suppliers have overdue payments?"
  5. Executive Reports: "Generate my executive report for August 2026."
  Please ask a question relating to your store's inventory, profitability, payables, or executive reports.
  ```
- **Status**: **PASS**

---

### TC-AI-04: AI Tenant & RBAC Isolation Chain
- **Test ID**: `TC-AI-04`
- **User Role**: `customer` (Tenant A) and `store_manager` (Tenant A vs Tenant B)
- **Natural-Language Query**: `"What products are low in stock?"` (issued across roles and tenants)
- **Expected MCP Tool**: Enforce tenant barriers and reject unauthorized roles.
- **Actual MCP Tool**: `get_low_stock_products`
- **Expected Behavior**:
  1. Customer invoking `/api/ai/chat` is rejected with HTTP 403.
  2. Tenant A user executing AI queries sees only Tenant A's products; Tenant B's data is inaccessible.
  3. Client passing `organization_id: "org-beta-222"` in request body cannot override server-derived tenant context.
- **Actual Behavior**:
  1. Customer query was rejected with HTTP 403 `Access denied. Role "customer" is not authorized for this operation.`
  2. Tenant A AI assistant returned 1 low-stock item (`Organic Arabica Coffee 1kg`) belonging to Tenant A; Tenant B's item (`prod-beta-999`) was not returned.
  3. Tenant context derivation in `getAuthenticatedTenantContext` ignored client-supplied tenant ID.
- **Database Evidence**: Cross-tenant data isolation verified across AI → MCP → Database query pipeline.
- **AI Response Evidence**: Tenant B's confidential products were completely absent from Tenant A AI responses.
- **Status**: **PASS**

---

### TC-AI-05: Recommendation Disclaimer & Fact Separation
- **Test ID**: `TC-AI-05`
- **User Role**: `store_manager` (Tenant A)
- **Natural-Language Query**: `"Show me dead stock products with 60 days of zero sales"`
- **Expected MCP Tool**: `get_dead_stock`
- **Actual MCP Tool**: `get_dead_stock`
- **Expected Behavior**:
  - Response clearly separates factual data (`### 📊 Live Database Facts`) from recommendations (`### 💡 Actionable Insights & Recommendations`).
  - Every recommendation is explicitly prefixed with `AI-generated recommendation`.
  - A prominent disclaimer block alerts the user that recommendations require authorized staff review before execution.
- **Actual Behavior**:
  - Response separated facts from recommendations into distinct Markdown sections.
  - Actionable insights prefixed with `* **AI-generated recommendation:** ...`.
  - Concluded with mandatory disclaimer:
    `> ⚠️ **AI-generated recommendation:** Operational recommendations are generated algorithmically to assist store decision-making and must be reviewed by authorized staff before executing markdown or clearance promotions.`
- **Database Evidence**: Executed `get_dead_stock` calculating tied-up capital from live sales velocity.
- **AI Response Evidence**: Verified presence of both `Live Database Facts` header and `AI-generated recommendation` disclaimer block.
- **Status**: **PASS**
