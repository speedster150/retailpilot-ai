-- Migration: 20260912000000_low_stock_alerts.sql
-- Description: Audit and state tracking table for Low Stock Auto-Alerts dispatched to Make.com

create table if not exists public.low_stock_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  stock_level numeric not null,
  reorder_level numeric not null,
  deficit numeric not null,
  status text not null check (status in ('dispatched', 'failed', 'suppressed_duplicate')),
  webhook_url_masked text,
  response_status integer,
  error_message text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes for performance and duplicate detection
create index if not exists idx_low_stock_alerts_org_product_store
  on public.low_stock_alerts (organization_id, product_id, store_id, created_at desc);

create index if not exists idx_low_stock_alerts_status
  on public.low_stock_alerts (status);

-- Enable Row Level Security (RLS)
alter table public.low_stock_alerts enable row level security;

-- RLS Policy: Authorized store staff can view their organization's alerts
create policy "Staff can view organization low stock alerts"
  on public.low_stock_alerts
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );

-- RLS Policy: Authorized store staff can insert alert audit records
create policy "Staff can insert organization low stock alerts"
  on public.low_stock_alerts
  for insert
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );
