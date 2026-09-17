# RetailPilot AI — Production Deployment & Future Cloud CI/CD Guide

## Overview

RetailPilot AI is an enterprise multi-tenant intelligent retail management SaaS application built with Next.js 16 (App Router), TypeScript, TailwindCSS, and Supabase (PostgreSQL with Row Level Security).

This document outlines the architecture, procedures, and specifications for:
1. **Current Deployment Target**: GitHub → Vercel → Supabase
2. **Future Cloud Deployment Target**: GitHub → CI/CD Pipeline → General Cloud Infrastructure (AWS ECS / EKS, Azure Container Apps, GCP Cloud Run, or Kubernetes) → Supabase / Managed PostgreSQL

---

## 1. Architecture Flow

### Current Architecture
```
[Developer / Git Push]
         │
         ▼
[GitHub Repository]
         │
         ▼ (Automatic Git Integration)
  [Vercel Platform]
   ├── Build: next build (Turbopack)
   ├── Edge Middleware: proxy.ts
   └── Serverless Functions: Next.js Server Components & Route Handlers
         │
         ▼ (TLS / HTTPS)
[Supabase Managed PostgreSQL]
   ├── Supabase Auth (Cookie-based Sessions)
   ├── Multi-tenant Row Level Security (RLS)
   └── Immutable Inventory Ledger
```

### Future Cloud Architecture (Containerized / Cloud Native)
```
[Developer / Git Push]
         │
         ▼
[GitHub Repository]
         │
         ▼
[CI Pipeline (GitHub Actions / GitLab CI)]
   ├── 1. Dependency Install: npm ci
   ├── 2. Type Check: npm run typecheck (tsc --noEmit)
   ├── 3. Code Quality: npm run lint (ESLint 9)
   ├── 4. Automated Tests: npm test (Integration / Invariant Suites)
   └── 5. Production Build: npm run build
         │
         ▼ (On Main / Release Tag)
[CD Pipeline (Automated Deployment)]
   ├── Docker Image Build & Tag
   ├── Push to Container Registry (AWS ECR / GCP Artifact Registry / Azure ACR)
   ├── Apply Database Migrations (Supabase CLI / CI Runner)
   └── Rolling Update to Cloud Orchestrator (AWS ECS, GCP Cloud Run, Azure Container Apps)
         │
         ▼
[Cloud Load Balancer / Ingress] ─── Health Check: /api/health
         │
         ▼
[Stateless Container Pods / Tasks]
   └── Node.js next start
         │
         ▼
[Managed PostgreSQL (Supabase / RDS / Cloud SQL)]
```

---

## 2. Environment Variables

All environment-specific configuration is loaded through `process.env`. Never hardcode keys or credentials.

| Variable Name | Required | Scope | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Client + Server | Public HTTPS URL of the Supabase project. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Yes** | Client + Server | Client-safe publishable/anon key used with cookie sessions. |
| `MAKE_LOW_STOCK_WEBHOOK_URL` | Optional | Server-only | Make.com webhook endpoint for low stock alerts. |
| `MAKE_DEAD_STOCK_WEBHOOK_URL` | Optional | Server-only | Make.com webhook endpoint for dead stock audit alerts. |
| `MAKE_SUPPLIER_ESCALATION_WEBHOOK_URL`| Optional | Server-only | Make.com webhook endpoint for supplier payment escalations. |
| `MAKE_DAILY_DOSSIER_WEBHOOK_URL` | Optional | Server-only | Make.com webhook endpoint for daily sales dossiers. |
| `MAKE_MONTHLY_REPORT_WEBHOOK_URL` | Optional | Server-only | Make.com webhook endpoint for monthly executive summaries. |
| `BUSINESS_TIMEZONE` | Optional | Server-only | Timezone string for reports (e.g. `Asia/Kolkata` or `UTC`). |

> [!NOTE]
> `NEXT_PUBLIC_` prefixed variables are inlined at build time for browser execution. All other variables remain strictly server-side.

---

## 3. Build & Runtime Commands

The repository provides standardized, deterministic scripts for both local development and CI/CD environments:

| Command | Purpose | When Used |
| :--- | :--- | :--- |
| `npm ci` | Clean, reproducible dependency installation | CI pipelines and Docker builds |
| `npm run typecheck` | Full TypeScript validation (`tsc --noEmit`) | CI pre-merge gate |
| `npm run lint` | ESLint 9 validation across `app/` and `lib/` | CI pre-merge gate |
| `npm test` | Automated verification test runner | CI pipeline / pre-deployment |
| `npm run build` | Next.js production compilation (`next build`) | CI build & container assembly |
| `npm start` | Production Node.js server (`next start`) | Production container runtime |

---

## 4. Cloud Portability & Stateless Design

RetailPilot AI is architected for seamless cloud portability:

1. **Stateless HTTP MCP Server**: The Model Context Protocol (MCP) server at `/api/mcp` uses web-standard streaming handlers (`legacy: 'stateless'`) and derives tenant context from authenticated cookie sessions. It requires no sticky sessions or local socket persistence.
2. **Standardized Proxy Routing**: Request protection and session rehydration are managed in `proxy.ts` (Next.js 16 standard), allowing portable execution across both Vercel Edge runtime and Node.js container runtimes.
3. **No Local File Persistence**: No persistent state, uploads, or session tokens are written to local disk. Everything is safely persisted in Supabase PostgreSQL and Supabase Auth.
4. **Health Check Probe**: An unauthenticated, zero-credential endpoint is available at `/api/health`:
   ```bash
   curl -I https://your-domain.com/api/health
   # HTTP/1.1 200 OK
   # {"status":"ok","service":"retailpilot-ai","timestamp":"...","uptimeSeconds":...}
   ```

---

## 5. Docker Containerization Specification (Future Cloud Target)

For general cloud environments (AWS ECS, Google Cloud Run, Azure Container Apps), use a multi-stage Dockerfile:

```dockerfile
# ------------------------------------------------------------------------------
# Stage 1: Dependency Installation
# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Production Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pass build-time environment arguments
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run typecheck
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime Runner
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
```

---

## 6. Database Migrations & Schema Management

All database migrations are stored in Git under `supabase/migrations/`:

```
supabase/migrations/
├── 20260908000000_complete_goods_receipt.sql
├── 20260912000000_low_stock_alerts.sql
├── 20260912000001_dead_stock_audits.sql
├── 20260912000002_supplier_payment_escalations.sql
├── 20260912000003_daily_sales_dossiers.sql
└── 20260912000004_monthly_executive_reports.sql
```

### Migration Execution Procedure
1. **Local Development / Preview**:
   ```bash
   npx supabase db push
   ```
2. **Production Deployment**:
   - Run migrations prior to deploying new container versions via the Supabase CLI:
     ```bash
     npx supabase db push --db-url "$DATABASE_URL"
     ```
   - Ensure all schema changes are backwards-compatible (expand-and-contract pattern) so currently active application containers continue operating during rolling deploys.

---

## 7. Secrets Management Best Practices

1. **Vercel Target**: Configure environment variables via the Vercel Project Settings dashboard (`Production` and `Preview` environments).
2. **AWS Target**: Store sensitive keys in AWS Secrets Manager or AWS Systems Manager Parameter Store, and inject them into ECS task definitions.
3. **GCP Target**: Store in Google Cloud Secret Manager and reference in Cloud Run service configurations.
4. **Azure Target**: Store in Azure Key Vault and reference in Azure Container Apps secrets.
5. **Never Commit Secrets**: Verified that `.env*` is in `.gitignore`, with `!.env.example` as the sole tracked template.

---

## 8. Rollback & Zero-Downtime Strategy

1. **Vercel Rollback**: Instant one-click rollback via the Vercel Deployments dashboard to the previous stable immutable deployment hash.
2. **Cloud Container Rollback**: Deployments should use rolling updates (`minimumHealthyPercent: 100`, `maximumPercent: 200`) or blue/green traffic splitting. If the `/api/health` check fails on new pods, the orchestrator automatically halts traffic cutover and retains existing healthy containers.
3. **Database Safety**: The immutable inventory ledger (`inventory_movements`) and strict RLS policies guarantee that transaction logs cannot be corrupted by rollbacks.
