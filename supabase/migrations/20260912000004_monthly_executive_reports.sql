-- Migration: 20260912000004_monthly_executive_reports.sql
-- Description: Audit and state tracking table for Monthly Executive AI Reports orchestrated via Make.com

create table if not exists public.monthly_executive_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_month text not null,
  gross_revenue numeric not null default 0,
  net_revenue numeric not null default 0,
  net_profit numeric not null default 0,
  profit_margin numeric not null default 0,
  low_stock_count integer not null default 0,
  dead_stock_value numeric not null default 0,
  supplier_liabilities numeric not null default 0,
  status text not null check (status in ('dispatched', 'failed', 'suppressed_duplicate')),
  webhook_url_masked text,
  response_status integer,
  error_message text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes for duplicate detection, reporting, and idempotency queries
create index if not exists idx_monthly_exec_reports_org_period
  on public.monthly_executive_reports (organization_id, period_month);

create index if not exists idx_monthly_exec_reports_status_created
  on public.monthly_executive_reports (status, created_at desc);

-- Enable Row Level Security (RLS)
alter table public.monthly_executive_reports enable row level security;

-- RLS Policy: Authorized store and finance managers can view monthly executive reports
create policy "Staff can view organization monthly executive reports"
  on public.monthly_executive_reports
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );

-- RLS Policy: Authorized store and finance staff can insert monthly executive reports
create policy "Staff can insert organization monthly executive reports"
  on public.monthly_executive_reports
  for insert
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );
