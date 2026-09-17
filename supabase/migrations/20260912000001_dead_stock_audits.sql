-- Migration: 20260912000001_dead_stock_audits.sql
-- Description: Audit and state tracking table for Bi-Weekly Dead Stock Audits orchestrated via Make.com

create table if not exists public.dead_stock_audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  total_dead_stock_items integer not null,
  total_tied_up_capital numeric not null,
  status text not null check (status in ('completed', 'dispatched', 'failed')),
  webhook_url_masked text,
  response_status integer,
  error_message text,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes for performance and reporting
create index if not exists idx_dead_stock_audits_org_store_created
  on public.dead_stock_audits (organization_id, store_id, created_at desc);

create index if not exists idx_dead_stock_audits_status
  on public.dead_stock_audits (status);

-- Enable Row Level Security (RLS)
alter table public.dead_stock_audits enable row level security;

-- RLS Policy: Authorized store staff can view their organization's dead stock audits
create policy "Staff can view organization dead stock audits"
  on public.dead_stock_audits
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );

-- RLS Policy: Authorized store staff can insert dead stock audit records
create policy "Staff can insert organization dead stock audits"
  on public.dead_stock_audits
  for insert
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );
