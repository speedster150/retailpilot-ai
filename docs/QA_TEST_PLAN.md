# RetailPilot AI — QA Test Plan & Strategy

## 1. QA Objectives

RetailPilot AI is an enterprise multi-tenant retail management platform with AI-driven inventory analytics, Model Context Protocol (MCP) tooling, automated background workflows via Make.com, and immutable inventory accounting.

The primary objectives of this Quality Assurance (QA) strategy are:
1. **Functional Integrity**: Validate all core retail workflows (catalog, procurement, goods receipt, immutable ledger accounting, POS sales, customer management, returns, expenses, inter-store transfers, and executive reporting).
2. **Multi-Tenant Isolation & RLS Security**: Verify that no organization can view, modify, or leak data into another organization.
3. **Role-Based Access Control (RBAC)**: Ensure internal staff roles (`admin_owner`, `store_manager`, `inventory_staff`, `sales_staff`) operate strictly within permissions, and external `customer` roles are barred from internal business data and actions.
4. **Data Immutability & Financial Invariance**: Guarantee that inventory ledger records and sales financial logs remain immutable, with zero fabricated or unverified transactions.
5. **AI Business Assistant & MCP Verification**: Ensure all natural language business questions are answered exclusively through verified database-backed MCP tools rather than LLM hallucinations.
6. **Automation Reliability & Failure Safety**: Verify that all scheduled and event-driven Make.com automation workflows handle failures gracefully without crashing or mutating operational ledgers.

---

## 2. Test Strategy & 50-Case Coverage Target

To fulfill the capstone requirement, the test suite is partitioned into **50 comprehensive test cases** across 5 distinct testing tiers:

| Test Category | Target Cases | Scope & Methodology | Step Status |
| :--- | :---: | :--- | :---: |
| **1. Functional Tests** | **25** | End-to-end retail business workflows from auth to AI assistant. | **Active (Step 10.1)** |
| **2. API & Contract Tests**| **10** | Schema contracts, REST endpoints, HTTP status codes, and payload schemas. | Step 10.2 |
| **3. Security & RLS Tests** | **5** | Row-Level Security, multi-tenant barriers, cross-tenant leak tests, RBAC privilege escalation. | Step 10.3 |
| **4. AI & MCP Tool Tests** | **5** | Tool registry invocation, parameter validation, grounding, and response structuring. | Step 10.4 |
| **5. UI & Mobile POS Tests**| **5** | Responsive layout, mobile POS usability, accessibility, keyboard navigation. | Step 10.5 |
| **TOTAL** | **50** | Complete Production Quality Assurance Suite | — |

---

## 3. Environment & Configuration

- **Runtime**: Node.js v20+ / Next.js 15+ App Router
- **Database**: Supabase PostgreSQL with Row Level Security (RLS) enabled
- **Authentication**: Supabase SSR Session Cookie Auth
- **Execution Engine**: TypeScript (`npx tsx`) automated test harnesses
- **Compiler / Linter**: TypeScript 5 (`npx tsc --noEmit`), ESLint 9 (`npm run lint`)

---

## 4. Functional Test Matrix (25 Cases)

The complete functional test definitions and execution records are maintained in [docs/QA_FUNCTIONAL_TESTS.md](file:///c:/Users/Dell/Downloads/R%20documents/projects/retailpilot-ai/docs/QA_FUNCTIONAL_TESTS.md).

| Test ID | Module | Feature / Description | Type | Execution Status |
| :--- | :--- | :--- | :---: | :---: |
| `TC-FUNC-01` | Auth | User Login & Cookie Session Establishment | Automated / E2E | **PASS** |
| `TC-FUNC-02` | Auth / Layout | Protected Dashboard Route Protection & Redirects | Automated / Unit | **PASS** |
| `TC-FUNC-03` | Multi-Tenancy | Server-Side Tenant Context Derivation | Automated / Unit | **PASS** |
| `TC-FUNC-04` | Catalog | Product Creation & Validation | Automated / Action | **PASS** |
| `TC-FUNC-05` | Catalog | Product Editing & Updating | Automated / Action | **PASS** |
| `TC-FUNC-06` | Catalog | Category Management & FK Validation | Automated / Action | **PASS** |
| `TC-FUNC-07` | Suppliers | Supplier Creation & Contact Validation | Automated / Action | **PASS** |
| `TC-FUNC-08` | Suppliers | Product-Supplier Association | Automated / Action | **PASS** |
| `TC-FUNC-09` | Purchases | Purchase Order Creation & Line Items | Automated / Action | **PASS** |
| `TC-FUNC-10` | Purchases | Purchase Order Status Workflow | Automated / Service | **PASS** |
| `TC-FUNC-11` | Procurement | Goods Receipt / GRN Recording | Automated / Action | **PASS** |
| `TC-FUNC-12` | Inventory | Immutable Inventory Ledger Update | Automated / Service | **PASS** |
| `TC-FUNC-13` | Inventory | Current Stock Calculation (Ledger Sum) | Automated / Service | **PASS** |
| `TC-FUNC-14` | Inventory | Low-Stock Threshold Detection | Automated / Service | **PASS** |
| `TC-FUNC-15` | Catalog | Product Search, SKU & Status Filtering | Automated / Service | **PASS** |
| `TC-FUNC-16` | POS | POS Sale Record Creation | Automated / Service | **PASS** |
| `TC-FUNC-17` | POS | Sale Items, Quantities & Financial Totals | Automated / Service | **PASS** |
| `TC-FUNC-18` | Payments | Payment Recording & Payment Methods | Automated / Service | **PASS** |
| `TC-FUNC-19` | Customers | Customer Profile Creation & Validation | Automated / Service | **PASS** |
| `TC-FUNC-20` | Customers | Customer Purchase History & Loyalty Points | Automated / Service | **PASS** |
| `TC-FUNC-21` | Returns | Sales Returns & Refund Processing | Automated / Service | **PASS** |
| `TC-FUNC-22` | Expenses | Store Operating Expenses Recording | Automated / Service | **PASS** |
| `TC-FUNC-23` | Inventory | Inter-Store Inventory Transfer (`transfer_in/out`)| Automated / Service | **PASS** |
| `TC-FUNC-24` | Reports | Monthly Executive Business Report Generation | Automated / Service | **PASS** |
| `TC-FUNC-25` | AI Assistant | AI Assistant Query via Genuine MCP Tooling | Automated / Service | **PASS** |

---

## 5. Execution & Evidence Strategy

- **Automated Verification**: Test cases are executed using deterministic test environments via `scratch/verify-functional-suite.ts`. All test steps run actual application code, server actions, mathematical validators, and services.
- **Evidence Recording**: Each test case documents execution output, timestamps, exact assertions, and immutable state verifications.
- **Defect Tracking**: Any failures discovered during testing must be recorded, fixed, re-verified, and passed prior to QA sign-off.
